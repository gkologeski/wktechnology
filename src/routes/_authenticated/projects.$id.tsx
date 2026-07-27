import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getProject,
  updateProject,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listMilestones,
  createMilestone,
  completeMilestone,
  deleteMilestone,
  listTimeEntries,
  logTime,
  deleteTimeEntry,
  listMembers,
  addMember,
  removeMember,
  getProjectFinancials,
} from "@/lib/projects.functions";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetailPage,
});

const STATUS_LABEL: Record<string, string> = {
  planning: "Planejamento",
  active: "Ativo",
  on_hold: "Em espera",
  done: "Concluído",
  cancelled: "Cancelado",
};

const TASK_COLUMNS = [
  { key: "todo", label: "A fazer" },
  { key: "doing", label: "Em andamento" },
  { key: "review", label: "Em revisão" },
  { key: "done", label: "Concluído" },
] as const;

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getProject);
  const update = useServerFn(updateProject);
  const fin = useServerFn(getProjectFinancials);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => get({ data: { id } }),
  });

  const { data: financials } = useQuery({
    queryKey: ["project-financials", id],
    queryFn: () => fin({ data: { projectId: id } }),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!project) return <div className="p-6 text-sm text-muted-foreground">Projeto não encontrado.</div>;

  const p: any = project;

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title={p.name}
        description={p.description ?? undefined}
        actions={
          <Select
            value={p.status}
            onValueChange={async (v) => {
              await update({ data: { id, patch: { status: v as any } } });
              qc.invalidateQueries({ queryKey: ["project", id] });
              qc.invalidateQueries({ queryKey: ["projects"] });
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricTile label="Horas apontadas" value={`${(financials?.loggedHours ?? 0).toFixed(1)}h`} />
        <MetricTile
          label="Custo realizado"
          value={financials?.hasRates ? formatCurrency(financials.realizedCost) : "n/d"}
          hint={!financials?.hasRates ? "Sem custo/hora definido" : undefined}
        />
        <MetricTile
          label="Receita billable"
          value={financials?.hasRates ? formatCurrency(financials.totalRevenue) : "n/d"}
        />
        <MetricTile
          label="Margem"
          value={financials?.hasRates ? formatCurrency(financials.margin) : "n/d"}
          tone={financials?.hasRates ? (financials.margin >= 0 ? "positive" : "negative") : undefined}
        />
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="tabular-nums font-medium">{p.progress ?? 0}%</span>
        </div>
        <Progress value={p.progress ?? 0} />
        <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
          {p.contracts && (
            <span>
              Contrato:{" "}
              <Link to="/contracts/$id" params={{ id: p.contracts.id }} className="text-foreground hover:underline">
                {p.contracts.number ?? p.contracts.title}
              </Link>
            </span>
          )}
          {p.services && (
            <span>
              Serviço:{" "}
              <Link to="/services/$id" params={{ id: p.services.id }} className="text-foreground hover:underline">
                {p.services.name}
              </Link>
            </span>
          )}
          {p.starts_at && <span>Início: {formatDateTime(p.starts_at).split(" ")[0]}</span>}
          {p.due_at && <span>Prazo: {formatDateTime(p.due_at).split(" ")[0]}</span>}
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="milestones">Marcos</TabsTrigger>
          <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
          <TabsTrigger value="members">Membros</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4">
          <TasksKanban projectId={id} />
        </TabsContent>
        <TabsContent value="milestones" className="mt-4">
          <MilestonesPanel projectId={id} />
        </TabsContent>
        <TabsContent value="timesheet" className="mt-4">
          <TimesheetPanel projectId={id} />
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <MembersPanel projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""
        } ${tone === "negative" ? "text-rose-600 dark:text-rose-400" : ""}`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

// ============= TASKS KANBAN =============

function TasksKanban({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listTasks);
  const upd = useServerFn(updateTask);
  const del = useServerFn(deleteTask);
  const [openCreate, setOpenCreate] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => list({ data: { projectId } }),
  });

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const c of TASK_COLUMNS) m.set(c.key, []);
    for (const t of tasks as any[]) m.get(t.status)?.push(t);
    return m;
  }, [tasks]);

  const move = async (taskId: string, status: string) => {
    await upd({ data: { id: taskId, patch: { status: status as any } } });
    qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova tarefa
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {TASK_COLUMNS.map((col) => (
          <div
            key={col.key}
            className="rounded-lg border bg-muted/30 p-3 min-h-64"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const taskId = e.dataTransfer.getData("text/plain");
              if (taskId) void move(taskId, col.key);
            }}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center justify-between">
              <span>{col.label}</span>
              <span className="tabular-nums">{grouped.get(col.key)?.length ?? 0}</span>
            </div>
            <div className="space-y-2">
              {(grouped.get(col.key) ?? []).map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  className="rounded-md border bg-card p-2 text-sm shadow-sm cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium flex-1">{t.title}</div>
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Remover tarefa?")) return;
                        await del({ data: { id: t.id } });
                        qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {t.due_at && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDateTime(t.due_at).split(" ")[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <NewTaskDialog projectId={projectId} open={openCreate} onOpenChange={setOpenCreate} />
    </div>
  );
}

function NewTaskDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTask);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await create({ data: { projectId, title: title.trim(), dueAt: dueAt || null } });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setTitle("");
      setDueAt("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= MILESTONES =============

function MilestonesPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listMilestones);
  const create = useServerFn(createMilestone);
  const complete = useServerFn(completeMilestone);
  const del = useServerFn(deleteMilestone);

  const { data: milestones = [] } = useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: () => list({ data: { projectId } }),
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [billable, setBillable] = useState(false);
  const [amount, setAmount] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    await create({
      data: {
        projectId,
        name: name.trim(),
        dueAt: dueAt || null,
        billable,
        billAmount: billable && amount ? Number(amount) : null,
      },
    });
    setName("");
    setDueAt("");
    setBillable(false);
    setAmount("");
    setOpenCreate(false);
    qc.invalidateQueries({ queryKey: ["project-milestones", projectId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo marco
        </Button>
      </div>
      <div className="rounded-lg border bg-card">
        {milestones.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum marco cadastrado.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(milestones as any[]).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.due_at ? formatDateTime(m.due_at).split(" ")[0] : "—"}
                  </TableCell>
                  <TableCell>{m.billable ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.bill_amount ? formatCurrency(Number(m.bill_amount)) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {m.status !== "done" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await complete({ data: { id: m.id } });
                            toast.success(
                              m.billable
                                ? "Marco concluído. Lançamento financeiro gerado."
                                : "Marco concluído.",
                            );
                            qc.invalidateQueries({ queryKey: ["project-milestones", projectId] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Falha");
                          }
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Remover marco?")) return;
                        await del({ data: { id: m.id } });
                        qc.invalidateQueries({ queryKey: ["project-milestones", projectId] });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo marco</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="billable" checked={billable} onCheckedChange={(v) => setBillable(!!v)} />
              <Label htmlFor="billable" className="cursor-pointer">
                Gera cobrança ao concluir
              </Label>
            </div>
            {billable && (
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= TIMESHEET =============

function TimesheetPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listTimeEntries);
  const log = useServerFn(logTime);
  const del = useServerFn(deleteTimeEntry);

  const { data: entries = [] } = useQuery({
    queryKey: ["project-time-entries", projectId],
    queryFn: () => list({ data: { projectId } }),
  });

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!date || !hours || Number(hours) <= 0) {
      toast.error("Informe data e horas");
      return;
    }
    setSaving(true);
    try {
      await log({
        data: { projectId, date, hours: Number(hours), description: description || null, billable },
      });
      setHours("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["project-time-entries", projectId] });
      qc.invalidateQueries({ queryKey: ["project-financials", projectId] });
      toast.success("Horas apontadas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" /> Apontar horas
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Horas</Label>
            <Input
              type="number"
              min="0"
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Checkbox id="tbill" checked={billable} onCheckedChange={(v) => setBillable(!!v)} />
              <Label htmlFor="tbill" className="text-xs cursor-pointer">
                Billable
              </Label>
            </div>
            <Button onClick={submit} disabled={saving} size="sm">
              Registrar
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum apontamento ainda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(entries as any[]).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{formatDateTime(e.entry_date).split(" ")[0]}</TableCell>
                  <TableCell className="text-sm">{e.description ?? "—"}</TableCell>
                  <TableCell>{e.billable ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(e.hours).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Remover apontamento?")) return;
                        await del({ data: { id: e.id } });
                        qc.invalidateQueries({ queryKey: ["project-time-entries", projectId] });
                        qc.invalidateQueries({ queryKey: ["project-financials", projectId] });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ============= MEMBERS =============

function MembersPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listMembers);
  const add = useServerFn(addMember);
  const rm = useServerFn(removeMember);
  const { data: members = [] } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => list({ data: { projectId } }),
  });
  const { data: wsMembers = [] } = useWorkspaceMembers();

  const [userId, setUserId] = useState("");
  const [roleInProject, setRoleInProject] = useState<"manager" | "contributor" | "viewer">("contributor");
  const [cost, setCost] = useState("");
  const [bill, setBill] = useState("");

  const existingIds = new Set((members as any[]).map((m) => m.user_id));
  const availableMembers = (wsMembers as any[]).filter((m) => !existingIds.has(m.user_id));

  const submit = async () => {
    if (!userId) {
      toast.error("Selecione um usuário");
      return;
    }
    try {
      await add({
        data: {
          projectId,
          userId,
          roleInProject,
          costRateHour: cost ? Number(cost) : null,
          billRateHour: bill ? Number(bill) : null,
        },
      });
      setUserId("");
      setCost("");
      setBill("");
      qc.invalidateQueries({ queryKey: ["project-members", projectId] });
      qc.invalidateQueries({ queryKey: ["project-financials", projectId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-medium mb-3">Adicionar membro</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Usuário</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((m: any) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name ?? m.email ?? m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={roleInProject} onValueChange={(v) => setRoleInProject(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="contributor">Colaborador</SelectItem>
                <SelectItem value="viewer">Observador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Custo/h</Label>
            <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Bill/h</Label>
            <Input type="number" min="0" step="0.01" value={bill} onChange={(e) => setBill(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={submit}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum membro.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Custo/h</TableHead>
                <TableHead className="text-right">Bill/h</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members as any[]).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.profiles?.full_name ?? m.profiles?.email ?? m.user_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.role_in_project}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.cost_rate_hour ? formatCurrency(Number(m.cost_rate_hour)) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.bill_rate_hour ? formatCurrency(Number(m.bill_rate_hour)) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Remover membro?")) return;
                        await rm({ data: { id: m.id } });
                        qc.invalidateQueries({ queryKey: ["project-members", projectId] });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
