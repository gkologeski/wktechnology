import { formatDateTime } from "@/lib/crm";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Can } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import {
  usePipelines,
  useEnsureDefaultPipeline,
  defaultTicketStages,
  type Pipeline,
} from "@/lib/pipelines";
import { PageHeader } from "@/components/page-header";
import { useAutoCreateParam } from "@/hooks/use-auto-create-param";
import { Button } from "@/components/ui/button";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { QuickCreateCompanyDialog } from "@/components/record/quick-create-dialogs";
import { useRelatedIds } from "@/hooks/use-related-ids";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import {
  AssigneeFilter,
  ASSIGNEE_ALL,
  ASSIGNEE_ME,
  ASSIGNEE_NONE,
} from "@/components/entity/assignee-filter";
import { BulkAssignDialog } from "@/components/bulk-assign-dialog";
import {
  Plus,
  LayoutGrid,
  Rows3,
  Columns2,
  Trash2,
  Search,
  Briefcase,
  X,
  UserCheck,
  ArrowRightLeft,
  Settings2,
  User,
  Building2,
  Target,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { filterByView, type ViewKey } from "@/components/tickets/tickets-sidebar";
import { TicketsBoard } from "@/components/tickets/tickets-board";
import { TicketsSplitView } from "@/components/tickets/tickets-split-view";
import {
  STATUSES,
  PRIORITIES,
  PRIORITY_COLOR_VAR,
  type TicketRow,
} from "@/components/tickets/types";
import { useServerFn } from "@tanstack/react-start";
import { notifyTicketStatusChange } from "@/lib/tickets-notify.functions";
import { SlaBadge } from "@/components/sla/sla-badge";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { deleteRowGuarded, deleteRowsGuarded, partialDeleteMessage } from "@/lib/delete-guard";
import { ticketResponsibleId } from "@/lib/entity/responsible";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: TicketsPage,
});

type Layout = "table" | "split" | "board";
type Draft = Partial<TicketRow>;

const VIEW_TABS: { key: ViewKey; label: string }[] = [
  { key: "all", label: "Todos os tickets" },
  { key: "mine", label: "Meus tickets abertos" },
  { key: "unassigned", label: "Não atribuídos" },
  { key: "urgent", label: "Urgentes" },
  { key: "overdue", label: "Vencidos" },
  { key: "closed_today", label: "Fechados hoje" },
];

function TicketsPage() {
  const location = useLocation();
  if (location.pathname !== "/tickets") return <Outlet />;
  return <TicketsIndex />;
}

function TicketsIndex() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeInvalidate([{ table: "tickets", queryKeys: [["tickets"]] }]);
  const navigate = useNavigate();
  const notifyStatus = useServerFn(notifyTicketStatusChange);
  useEnsureDefaultPipeline("ticket");
  const { pipelines, selected: pipeline, selectedId, setSelectedId } = usePipelines("ticket");

  const [view, setView] = useState<ViewKey>("all");
  const [layout, setLayout] = useState<Layout>("table");
  const layoutTouchedRef = useRef(false);
  const handleLayoutChange = (v: string) => {
    layoutTouchedRef.current = true;
    setLayout(v as Layout);
  };
  useEffect(() => {
    if (layoutTouchedRef.current) return;
    const dv = pipeline?.default_view;
    if (dv === "board" || dv === "table" || dv === "split") {
      setLayout(dv);
    }
  }, [pipeline?.id, pipeline?.default_view]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TicketRow | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [pendingCompanyName, setPendingCompanyName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>(ASSIGNEE_ALL);
  const [assignOpen, setAssignOpen] = useState(false);
  const TICKETS_FOCUS_KEY = "tickets:focusMode";
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(TICKETS_FOCUS_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TICKETS_FOCUS_KEY, focusMode ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [focusMode]);
  const related = useRelatedIds({
    contactId: draft.contact_id ?? null,
    companyId: draft.company_id ?? null,
    dealId: draft.deal_id ?? null,
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as TicketRow[];
    },
  });

  const contactIds = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.contact_id).filter(Boolean) as string[])),
    [tickets],
  );
  const companyIds = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.company_id).filter(Boolean) as string[])),
    [tickets],
  );

  const { data: contacts = [] } = useQuery({
    queryKey: ["tickets", "contact-lookups", contactIds.join(",")],
    enabled: contactIds.length > 0,
    queryFn: async () =>
      (await supabase.from("contacts").select("id,first_name,last_name").in("id", contactIds))
        .data ?? [],
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["tickets", "company-lookups", companyIds.join(",")],
    enabled: companyIds.length > 0,
    queryFn: async () =>
      (await supabase.from("companies").select("id,name").in("id", companyIds)).data ?? [],
  });

  const { data: sourceOptions = [] } = useQuery({
    queryKey: ["tickets", "distinct-sources"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("source")
        .not("source", "is", null)
        .limit(1000);
      const set = new Set<string>();
      (data ?? []).forEach((r) => r.source && set.add(String(r.source)));
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
  });
  const { data: members = [] } = useWorkspaceMembers();

  const lookups = useMemo(() => {
    const contactMap = new Map<string, string>();
    for (const c of contacts)
      contactMap.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Contato");
    const companyMap = new Map<string, string>();
    for (const c of companies) companyMap.set(c.id, c.name);
    const ownerMap = new Map<string, string>();
    for (const m of members) ownerMap.set(m.user_id, m.full_name || "Usuário");
    return { contacts: contactMap, companies: companyMap, owners: ownerMap };
  }, [contacts, companies, members]);

  const filtered = useMemo(() => {
    let list = filterByView(tickets, view, user?.id ?? null);
    if (pipeline?.id) list = list.filter((t) => !t.pipeline_id || t.pipeline_id === pipeline.id);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    if (ownerFilter !== ASSIGNEE_ALL) {
      list = list.filter((t) => {
        const responsible = ticketResponsibleId(t);
        if (ownerFilter === ASSIGNEE_NONE) return responsible == null;
        if (ownerFilter === ASSIGNEE_ME) return !!user?.id && responsible === user.id;
        return responsible === ownerFilter;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const contact = t.contact_id ? (lookups.contacts.get(t.contact_id) ?? "") : "";
        const company = t.company_id ? (lookups.companies.get(t.company_id) ?? "") : "";
        return [t.subject, t.description ?? "", contact, company]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }
    return list;
  }, [tickets, view, pipeline?.id, priorityFilter, ownerFilter, search, lookups, user?.id]);

  function openNew() {
    setEditing(null);
    setDraft({ status: "new", priority: "medium", assignee_id: user?.id });
    setOpen(true);
  }
  useAutoCreateParam(openNew);

  function openEdit(t: TicketRow) {
    navigate({ to: "/tickets/$id", params: { id: t.id } });
  }

  async function save() {
    if (!user) return;
    if (!draft.subject?.trim()) {
      toast.error("Informe um assunto.");
      return;
    }
    const payload = {
      subject: draft.subject!,
      description: draft.description ?? null,
      status: draft.status ?? "new",
      priority: draft.priority ?? "medium",
      source: draft.source ?? null,
      contact_id: draft.contact_id || null,
      company_id: draft.company_id || null,
      deal_id: draft.deal_id || null,
      assignee_id: draft.assignee_id || user.id,
      due_at: draft.due_at || null,
      pipeline_id: pipeline?.id ?? null,
      stage: editing?.stage ?? draft.status ?? "new",
      resolved_at:
        (draft.status ?? "new") === "resolved" || (draft.status ?? "new") === "closed"
          ? (editing?.resolved_at ?? new Date().toISOString())
          : null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase
        .from("tickets")
        .update(payload as never)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("tickets")
        .insert({ ...payload, owner_id: user.id } as never));
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    if (editing && editing.status !== payload.status) {
      notifyStatus({ data: { ticket_id: editing.id, new_status: payload.status } }).catch(() => {});
    }
    toast.success(editing ? "Ticket atualizado." : "Ticket criado.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  async function removeOne(id: string) {
    if (!(await confirmDialog("Excluir este ticket?"))) return;
    const res = await deleteRowGuarded("tickets", id);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => t.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkUpdate(patch: Partial<TicketRow>) {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("tickets").update(patch).in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (patch.status) {
      for (const id of ids) {
        notifyStatus({ data: { ticket_id: id, new_status: patch.status as string } }).catch(
          () => {},
        );
      }
    }
    toast.success(`${ids.length} ticket(s) atualizado(s).`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!(await confirmDialog(`Excluir ${selected.size} ticket(s)?`))) return;
    const ids = Array.from(selected);
    const res = await deleteRowsGuarded("tickets", ids);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    if (res.deleted < res.requested)
      toast.warning(partialDeleteMessage(res.deleted, res.requested));
    else toast.success(`${res.deleted} ticket(s) excluído(s).`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  const viewCounts = useMemo(() => {
    const m = new Map<ViewKey, number>();
    for (const v of VIEW_TABS) m.set(v.key, filterByView(tickets, v.key, user?.id ?? null).length);
    return m;
  }, [tickets, user?.id]);

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Help desk estilo HubSpot."
        actions={
          <Can permission="techsales.tickets.manage.workspace">
            <Button
              size="sm"
              onClick={openNew}
              className="bg-[color:var(--hs-orange)] text-[color:var(--hs-orange-foreground)] hover:bg-[color:var(--hs-orange)]/90"
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar tickets
            </Button>
          </Can>
        }
      />

      {/* Saved views as top tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)} className="mt-2">
        <TabsList className="h-9 flex-wrap">
          {VIEW_TABS.map((v) => (
            <TabsTrigger key={v.key} value={v.key} className="text-xs gap-1.5">
              {v.label}
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {viewCounts.get(v.key) ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
          <SelectTrigger className="h-9 w-[260px] font-medium">
            <SelectValue placeholder="Selecione pipeline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os pipelines</SelectItem>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.is_default && " · padrão"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button asChild variant="ghost" size="sm" className="h-9 px-2">
          <Link to="/settings/pipelines">
            <Settings2 className="h-4 w-4" />
          </Link>
        </Button>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tickets…"
            className="pl-8 h-9 w-full sm:w-[240px]"
          />
        </div>

        <AssigneeFilter value={ownerFilter} onChange={setOwnerFilter} className="w-[200px]" />

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Layout tabs */}
      <Tabs value={layout} onValueChange={handleLayoutChange} className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="table">
              <Rows3 className="h-3.5 w-3.5 mr-1" /> Tabela
            </TabsTrigger>
            <TabsTrigger value="board">
              <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Quadro
            </TabsTrigger>
            <TabsTrigger value="split">
              <Columns2 className="h-3.5 w-3.5 mr-1" /> Split
            </TabsTrigger>
          </TabsList>
          {layout === "board" && (
            <Button
              size="sm"
              variant={focusMode ? "default" : "outline"}
              onClick={() => setFocusMode(!focusMode)}
              aria-pressed={focusMode}
              title="Reordena por urgência (SLA, estagnação, prioridade) e esmaece itens sem urgência"
              className="h-8"
            >
              <Target className="h-4 w-4 mr-1" />
              Foco em SLA
            </Button>
          )}
        </div>

        <TabsContent value="table" className="mt-4">
          {selected.size > 0 && (
            <BulkActionBar count={selected.size} onClear={clearSelection}>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setAssignOpen(true)}>
                <UserCheck className="h-3.5 w-3.5 mr-1" />
                Atribuir
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7">
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s.value}
                      onSelect={() => bulkUpdate({ status: s.value })}
                    >
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7">
                    Prioridade
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {PRIORITIES.map((p) => (
                    <DropdownMenuItem
                      key={p.value}
                      onSelect={() => bulkUpdate({ priority: p.value })}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Can
                any={[
                  "techservice.tickets.delete.workspace",
                  "techsales.tickets.manage.workspace",
                  "techsales.tickets.delete.workspace",
                  "techsales.tickets.delete.own",
                ]}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-destructive"
                  onClick={bulkDelete}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Excluir
                </Button>
              </Can>
            </BulkActionBar>
          )}

          <div className="rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                      Nenhum ticket nesta view.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((t) => {
                  const responsible = ticketResponsibleId(t);

                  return (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => openEdit(t)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(t.id)}
                          onCheckedChange={() => toggle(t.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[320px]">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-0.5 rounded-sm shrink-0"
                            style={{ background: PRIORITY_COLOR_VAR[t.priority] }}
                            aria-hidden
                          />
                          <span className="truncate">{t.subject}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{
                            background: `color-mix(in oklab, ${PRIORITY_COLOR_VAR[t.priority]} 14%, transparent)`,
                            color: PRIORITY_COLOR_VAR[t.priority],
                            borderColor: `color-mix(in oklab, ${PRIORITY_COLOR_VAR[t.priority]} 35%, transparent)`,
                          }}
                        >
                          {PRIORITIES.find((p) => p.value === t.priority)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="font-normal">
                            {STATUSES.find((s) => s.value === t.status)?.label}
                          </Badge>
                          <SlaBadge
                            compact
                            resolutionDueAt={
                              (t as TicketRow & { sla_resolution_due_at?: string | null })
                                .sla_resolution_due_at
                            }
                            resolutionBreached={
                              (t as TicketRow & { sla_resolution_breached?: boolean })
                                .sla_resolution_breached
                            }
                            resolvedAt={
                              (t as TicketRow & { resolved_at?: string | null }).resolved_at
                            }
                            firstResponseDueAt={
                              (t as TicketRow & { sla_first_response_due_at?: string | null })
                                .sla_first_response_due_at
                            }
                            firstResponseAt={
                              (t as TicketRow & { sla_first_response_at?: string | null })
                                .sla_first_response_at
                            }
                            firstResponseBreached={
                              (t as TicketRow & { sla_first_response_breached?: boolean })
                                .sla_first_response_breached
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.contact_id ? (lookups.contacts.get(t.contact_id) ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.company_id ? (lookups.companies.get(t.company_id) ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <AssigneeCell assignedTo={responsible} className="text-xs" />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(t.created_at)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Can permission="techsales.tickets.manage.workspace">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeOne(t.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="board" className="mt-4">
          <TicketsBoard
            pipeline={
              pipeline ??
              ({
                id: "__fallback__",
                name: "Pipeline de Tickets",
                entity: "ticket",
                is_default: true,
                stages: defaultTicketStages(),
              } as Pipeline)
            }
            tickets={filtered}
            lookups={lookups}
            focusMode={focusMode}
            selectable
            canDelete
            onOpen={openEdit}
          />
        </TabsContent>

        <TabsContent value="split" className="mt-4">
          <TicketsSplitView tickets={filtered} lookups={lookups} onOpenFull={openEdit} />
        </TabsContent>
      </Tabs>

      {/* Dialog: create/edit ticket */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar ticket" : "Novo ticket"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Assunto *</Label>
              <Input
                value={draft.subject ?? ""}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Descrição</Label>
              <RichHtmlEditor
                value={draft.description ?? ""}
                onChange={(html) => setDraft({ ...draft, description: html })}
                minHeight={140}
                placeholder="Descreva o ticket…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={draft.status ?? "new"}
                onValueChange={(v) => setDraft({ ...draft, status: v as TicketRow["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={draft.priority ?? "medium"}
                onValueChange={(v) => setDraft({ ...draft, priority: v as TicketRow["priority"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select
                value={draft.assignee_id ?? ""}
                onValueChange={(v) => setDraft({ ...draft, assignee_id: v || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fonte</Label>
              <Select
                value={draft.source ?? "__none__"}
                onValueChange={(v) => setDraft({ ...draft, source: v === "__none__" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {sourceOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input
                type="datetime-local"
                value={draft.due_at ? draft.due_at.slice(0, 16) : ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    due_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contato</Label>
              <EntityCombobox
                entity="contacts"
                select="id, first_name, last_name, email"
                searchColumn="first_name"
                searchColumns={["first_name", "last_name", "email", "phone"]}
                labelFrom={(r) => {
                  const row = r as { first_name?: string; last_name?: string; email?: string };
                  return (
                    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
                    row.email ||
                    "Contato"
                  );
                }}
                hintFrom={(r) => (r as { email?: string }).email ?? null}
                value={draft.contact_id ?? null}
                onChange={(id) => setDraft({ ...draft, contact_id: id })}
                placeholder="Selecionar contato…"
                icon={User}
                priorityIds={related.contacts.filter((id) => id !== draft.contact_id)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <EntityCombobox
                entity="companies"
                select="id, name, domain"
                searchColumns={["name", "domain"]}
                labelFrom={(r) => String((r as { name?: string }).name ?? "")}
                hintFrom={(r) => (r as { domain?: string }).domain ?? null}
                value={draft.company_id ?? null}
                onChange={(id) => setDraft({ ...draft, company_id: id })}
                placeholder="Selecionar empresa…"
                icon={Building2}
                priorityIds={related.companies.filter((id) => id !== draft.company_id)}
                onCreateNew={(name) => {
                  setPendingCompanyName(name);
                  setCreateCompanyOpen(true);
                }}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Negócio</Label>
              <EntityCombobox
                entity="deals"
                select="id, name, value, currency"
                labelFrom={(r) => String((r as { name?: string }).name ?? "")}
                value={draft.deal_id ?? null}
                onChange={(id) => setDraft({ ...draft, deal_id: id })}
                placeholder="Selecionar negócio…"
                icon={Briefcase}
                priorityIds={related.deals.filter((id) => id !== draft.deal_id)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={save}
              className="bg-[color:var(--hs-orange)] text-[color:var(--hs-orange-foreground)] hover:bg-[color:var(--hs-orange)]/90"
            >
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuickCreateCompanyDialog
        open={createCompanyOpen}
        onOpenChange={setCreateCompanyOpen}
        initialName={pendingCompanyName}
        onCreated={(id) => setDraft((d) => ({ ...d, company_id: id }))}
      />
      <BulkAssignDialog
        open={assignOpen}
        setOpen={setAssignOpen}
        table="tickets"
        column="assignee_id"
        ids={Array.from(selected)}
        onDone={() => {
          clearSelection();
          qc.invalidateQueries({ queryKey: ["tickets"] });
        }}
      />
    </div>
  );
}
