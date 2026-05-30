import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, LayoutGrid, List as ListIcon, Trash2, Wand2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: TicketsPage,
});

const STATUSES = [
  { value: "new", label: "Novo" },
  { value: "open", label: "Em atendimento" },
  { value: "waiting", label: "Aguardando cliente" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Fechado" },
] as const;

const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
] as const;

const PRIORITY_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

type Ticket = {
  id: string;
  owner_id: string;
  subject: string;
  description: string | null;
  status: typeof STATUSES[number]["value"];
  priority: typeof PRIORITIES[number]["value"];
  source: string | null;
  assignee_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  due_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type Draft = Partial<Ticket>;

function TicketsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"board" | "list">("board");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [search, setSearch] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Ticket[];
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
  const { data: deals = [] } = useQuery({
    queryKey: ["deals", "select"],
    queryFn: async () => (await supabase.from("deals").select("id,name").order("name")).data ?? [],
  });
  const { data: macros = [] } = useQuery({
    queryKey: ["macros", "enabled"],
    queryFn: async () =>
      (await supabase.from("macros").select("id,name,shortcut,category,body").eq("enabled", true).order("name")).data ?? [],
  });

  function applyMacro(body: string) {
    const contact = contacts.find((c) => c.id === draft.contact_id);
    const company = companies.find((c) => c.id === draft.company_id);
    const firstName = contact?.first_name ?? "";
    const fullName = contact ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() : "";
    const text = body
      .replaceAll("{{contact_first_name}}", firstName)
      .replaceAll("{{contact_name}}", fullName)
      .replaceAll("{{company_name}}", company?.name ?? "")
      .replaceAll("{{ticket_subject}}", draft.subject ?? "")
      .replaceAll("{{agent_name}}", user?.email ?? "");
    const current = draft.description ?? "";
    setDraft({ ...draft, description: current ? `${current}\n\n${text}` : text });
    toast.success("Macro aplicada.");
  }

  const contactName = (id: string | null) => {
    if (!id) return "—";
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.first_name} ${c.last_name ?? ""}`.trim() : "—";
  };
  const companyName = (id: string | null) => companies.find((x) => x.id === id)?.name ?? "—";
  const dealName = (id: string | null) => deals.find((x) => x.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      [t.subject, t.description ?? "", companyName(t.company_id), contactName(t.contact_id)]
        .join(" ").toLowerCase().includes(q)
    );
  }, [tickets, search, contacts, companies]);

  const grouped = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    STATUSES.forEach((s) => map.set(s.value, []));
    filtered.forEach((t) => map.get(t.status)?.push(t));
    return map;
  }, [filtered]);

  function openNew() {
    setEditing(null);
    setDraft({ status: "new", priority: "medium" });
    setOpen(true);
  }

  function openEdit(t: Ticket) {
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
      resolved_at: draft.status === "resolved" || draft.status === "closed"
        ? (editing?.resolved_at ?? new Date().toISOString())
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

  async function remove(id: string) {
    if (!confirm("Excluir este ticket?")) return;
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  async function setStatus(t: Ticket, status: Ticket["status"]) {
    const patch = {
      status,
      resolved_at: (status === "resolved" || status === "closed") && !t.resolved_at
        ? new Date().toISOString()
        : t.resolved_at,
    };
    const { error } = await supabase.from("tickets").update(patch).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tickets"
        description="Atendimento e suporte estilo HubSpot Service."
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo ticket
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por assunto, descrição, contato, empresa…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="board"><LayoutGrid className="h-3.5 w-3.5 mr-1" /> Quadro</TabsTrigger>
          <TabsTrigger value="list"><ListIcon className="h-3.5 w-3.5 mr-1" /> Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {STATUSES.map((s) => {
              const items = grouped.get(s.value) ?? [];
              return (
                <div key={s.value} className="rounded-lg border bg-card">
                  <div className="px-3 py-2 border-b flex items-center justify-between">
                    <div className="text-sm font-medium">{s.label}</div>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="p-2 space-y-2 min-h-[80px] max-h-[70vh] overflow-auto">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openEdit(t)}
                        className="w-full text-left rounded-md border p-2 hover:bg-accent transition-colors"
                      >
                        <div className="text-sm font-medium line-clamp-2">{t.subject}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant={PRIORITY_VARIANT[t.priority]} className="capitalize">
                            {PRIORITIES.find((p) => p.value === t.priority)?.label}
                          </Badge>
                          {t.contact_id && <span className="truncate">{contactName(t.contact_id)}</span>}
                        </div>
                      </button>
                    ))}
                    {items.length === 0 && <p className="text-xs text-muted-foreground px-1 py-2">Vazio</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum ticket.</TableCell></TableRow>
                )}
                {filtered.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => openEdit(t)}>
                    <TableCell className="font-medium">{t.subject}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={t.status} onValueChange={(v) => setStatus(t, v as Ticket["status"])}>
                        <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANT[t.priority]}>
                        {PRIORITIES.find((p) => p.value === t.priority)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{contactName(t.contact_id)}</TableCell>
                    <TableCell>{companyName(t.company_id)}</TableCell>
                    <TableCell>{dealName(t.deal_id)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

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
              <div className="flex items-center justify-between">
                <Label>Descrição</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-7">
                      <Wand2 className="h-3.5 w-3.5 mr-1" /> Aplicar macro
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 overflow-auto w-64">
                    <DropdownMenuLabel>Respostas prontas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {macros.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma macro ativa.</div>
                    )}
                    {macros.map((m) => (
                      <DropdownMenuItem key={m.id} onSelect={() => applyMacro(m.body)} className="flex flex-col items-start gap-0.5">
                        <span className="text-sm">{m.name}</span>
                        {m.category && <span className="text-[10px] text-muted-foreground">{m.category}</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Textarea rows={4} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={draft.status ?? "new"} onValueChange={(v) => setDraft({ ...draft, status: v as Ticket["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={draft.priority ?? "medium"} onValueChange={(v) => setDraft({ ...draft, priority: v as Ticket["priority"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
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
              <Select value={draft.contact_id ?? "none"} onValueChange={(v) => setDraft({ ...draft, contact_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{`${c.first_name} ${c.last_name ?? ""}`.trim()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={draft.company_id ?? "none"} onValueChange={(v) => setDraft({ ...draft, company_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Negócio</Label>
              <Select value={draft.deal_id ?? "none"} onValueChange={(v) => setDraft({ ...draft, deal_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
