import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePipelines } from "@/lib/pipelines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { CompanyPicker, type CompanyPickerValue } from "@/components/ui/company-picker";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, LayoutGrid, Rows3, Columns2, Trash2, Search, Briefcase, User, X, UserCheck, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { TicketsSidebar, filterByView, type ViewKey } from "@/components/tickets/tickets-sidebar";
import { TicketsBoard } from "@/components/tickets/tickets-board";
import { TicketsSplitView } from "@/components/tickets/tickets-split-view";
import { STATUSES, PRIORITIES, PRIORITY_COLOR_VAR, type TicketRow } from "@/components/tickets/types";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: TicketsPage,
});

type Layout = "table" | "split" | "board";
type Draft = Partial<TicketRow>;

function TicketsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { selected: pipeline } = usePipelines("ticket");

  const [view, setView] = useState<ViewKey>("all");
  const [layout, setLayout] = useState<Layout>("table");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TicketRow | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

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

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", "select"],
    queryFn: async () => (await supabase.from("contacts").select("id,first_name,last_name").order("first_name")).data ?? [],
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "select"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
  });
  const { data: members = [] } = useWorkspaceMembers();

  const lookups = useMemo(() => {
    const contactMap = new Map<string, string>();
    for (const c of contacts) contactMap.set(c.id, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Contato");
    const companyMap = new Map<string, string>();
    for (const c of companies) companyMap.set(c.id, c.name);
    const ownerMap = new Map<string, string>();
    for (const m of members) ownerMap.set(m.user_id, m.full_name || "Usuário");
    return { contacts: contactMap, companies: companyMap, owners: ownerMap };
  }, [contacts, companies, members]);

  // Apply view + search + priority filter
  const filtered = useMemo(() => {
    let list = filterByView(tickets, view, user?.id ?? null);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const contact = t.contact_id ? lookups.contacts.get(t.contact_id) ?? "" : "";
        const company = t.company_id ? lookups.companies.get(t.company_id) ?? "" : "";
        return [t.subject, t.description ?? "", contact, company].join(" ").toLowerCase().includes(q);
      });
    }
    return list;
  }, [tickets, view, priorityFilter, search, lookups, user?.id]);

  function openNew() {
    setEditing(null);
    setDraft({ status: "new", priority: "medium", assignee_id: user?.id });
    setOpen(true);
  }
  function openEdit(t: TicketRow) {
    setEditing(t);
    setDraft({ ...t });
    setOpen(true);
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
      resolved_at:
        draft.status === "resolved" || draft.status === "closed"
          ? editing?.resolved_at ?? new Date().toISOString()
          : null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("tickets").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("tickets").insert({ ...payload, owner_id: user.id }));
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Ticket atualizado." : "Ticket criado.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  async function removeOne(id: string) {
    if (!confirm("Excluir este ticket?")) return;
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
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
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} ticket(s) atualizado(s).`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} ticket(s)?`)) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("tickets").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} ticket(s) excluído(s).`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-3.5rem)] bg-background">
      <TicketsSidebar tickets={tickets} userId={user?.id ?? null} current={view} onChange={setView} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <header className="border-b bg-card px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Help Desk</h1>
            <p className="text-[11px] text-[var(--hs-text-muted)]">
              {filtered.length} {filtered.length === 1 ? "ticket" : "tickets"}
            </p>
          </div>

          <div className="ml-4 relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hs-text-muted)]" />
            <Input
              placeholder="Buscar tickets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={layout} onValueChange={(v) => setLayout(v as Layout)}>
            <TabsList className="h-8">
              <TabsTrigger value="table" className="text-xs h-6 px-2"><Rows3 className="h-3.5 w-3.5 mr-1" />Tabela</TabsTrigger>
              <TabsTrigger value="split" className="text-xs h-6 px-2"><Columns2 className="h-3.5 w-3.5 mr-1" />Split</TabsTrigger>
              <TabsTrigger value="board" className="text-xs h-6 px-2"><LayoutGrid className="h-3.5 w-3.5 mr-1" />Quadro</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button size="sm" onClick={openNew} className="h-8 bg-[var(--hs-orange)] text-[var(--hs-orange-foreground)] hover:bg-[var(--hs-orange)]/90">
            <Plus className="h-4 w-4 mr-1" /> Novo ticket
          </Button>
        </header>

        {/* Bulk bar */}
        {selected.size > 0 && layout === "table" && (
          <div className="border-b bg-[var(--hs-orange)]/8 px-4 py-2 flex items-center gap-2 text-sm">
            <span className="font-medium">{selected.size} selecionado(s)</span>
            <div className="h-4 w-px bg-border mx-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7"><UserCheck className="h-3.5 w-3.5 mr-1" />Atribuir</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {members.map((m) => (
                  <DropdownMenuItem key={m.user_id} onSelect={() => bulkUpdate({ assignee_id: m.user_id })}>
                    {m.full_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7"><ArrowRightLeft className="h-3.5 w-3.5 mr-1" />Status</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {STATUSES.map((s) => (
                  <DropdownMenuItem key={s.value} onSelect={() => bulkUpdate({ status: s.value })}>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7">Prioridade</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {PRIORITIES.map((p) => (
                  <DropdownMenuItem key={p.value} onSelect={() => bulkUpdate({ priority: p.value })}>
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={bulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir
            </Button>
            <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="text-center text-sm text-[var(--hs-text-muted)] py-12">Carregando tickets…</div>
          ) : layout === "board" ? (
            pipeline ? (
              <TicketsBoard pipeline={pipeline} tickets={filtered} lookups={lookups} onOpen={openEdit} />
            ) : (
              <div className="text-center text-sm text-[var(--hs-text-muted)] py-12">Configurando pipeline…</div>
            )
          ) : layout === "split" ? (
            <TicketsSplitView tickets={filtered} lookups={lookups} onOpenFull={openEdit} />
          ) : (
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
                    <TableHead>Atribuído a</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-[var(--hs-text-muted)] py-10">
                        Nenhum ticket nesta view.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((t) => {
                    const ownerName = t.assignee_id ? lookups.owners.get(t.assignee_id) : undefined;
                    return (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer"
                        onClick={() => openEdit(t)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
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
                          <Badge variant="secondary" className="font-normal">
                            {STATUSES.find((s) => s.value === t.status)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[var(--hs-text-muted)]">
                          {t.contact_id ? lookups.contacts.get(t.contact_id) ?? "—" : "—"}
                        </TableCell>
                        <TableCell className="text-[var(--hs-text-muted)]">
                          {t.company_id ? lookups.companies.get(t.company_id) ?? "—" : "—"}
                        </TableCell>
                        <TableCell>
                          {ownerName ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5 text-[9px]">
                                <AvatarFallback className="bg-secondary text-secondary-foreground">
                                  {ownerName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs">{ownerName}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--hs-text-muted)]">Não atribuído</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-[var(--hs-text-muted)] tabular-nums">
                          {new Date(t.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOne(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Dialog: create/edit ticket */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar ticket" : "Novo ticket"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Assunto *</Label>
              <Input value={draft.subject ?? ""} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={4} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={draft.status ?? "new"} onValueChange={(v) => setDraft({ ...draft, status: v as TicketRow["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={draft.priority ?? "medium"} onValueChange={(v) => setDraft({ ...draft, priority: v as TicketRow["priority"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Atribuído a</Label>
              <Select
                value={draft.assignee_id ?? ""}
                onValueChange={(v) => setDraft({ ...draft, assignee_id: v || null })}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fonte</Label>
              <Input placeholder="email, whatsapp, telefone…" value={draft.source ?? ""} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="datetime-local" value={draft.due_at ? draft.due_at.slice(0, 16) : ""} onChange={(e) => setDraft({ ...draft, due_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div className="space-y-1.5">
              <Label>Contato</Label>
              <EntityCombobox
                entity="contacts"
                select="id, first_name, last_name, email"
                searchColumn="first_name"
                orderBy="first_name"
                labelFrom={(r) => {
                  const row = r as { first_name?: string; last_name?: string; email?: string };
                  const n = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
                  return n || row.email || "Contato";
                }}
                hintFrom={(r) => (r as { email?: string }).email ?? null}
                value={draft.contact_id ?? null}
                onChange={(id) => setDraft({ ...draft, contact_id: id })}
                placeholder="Selecionar contato…"
                icon={User}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <CompanyPicker
                mode="pick"
                value={{
                  id: draft.company_id ?? null,
                  name: companies.find((c) => c.id === draft.company_id)?.name ?? "",
                }}
                onChange={(cv: CompanyPickerValue) => setDraft({ ...draft, company_id: cv.id })}
                placeholder="Selecionar empresa…"
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="bg-[var(--hs-orange)] text-[var(--hs-orange-foreground)] hover:bg-[var(--hs-orange)]/90">
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
