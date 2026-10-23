import { HrAccessError } from "@/components/hr-access";
import { useHrCapabilities } from "@/lib/access-control/use-hr-capabilities";
import { usePermissions } from "@/lib/access-control/use-permissions";
// TechPeople · Sprint 6 — Onboarding & Offboarding panel (ficha da pessoa)
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ClipboardList,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Ban,
  MinusCircle,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/components/ui/confirm-dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listOnbPlans,
  getOnbPlanWithTasks,
  createOnbPlan,
  updateOnbPlan,
  deleteOnbPlan,
  upsertOnbTask,
  setOnbTaskStatus,
  deleteOnbTask,
  listOnbTemplates,
  ONB_KINDS,
  ONB_KIND_LABELS,
  ONB_PLAN_STATUSES,
  ONB_PLAN_STATUS_LABELS,
  ONB_TASK_STATUSES,
  ONB_TASK_STATUS_LABELS,
  type OnbKind,
  type OnbPlanStatus,
  type OnbTaskStatus,
  type OnbTaskRow,
  type OnbPlanRow,
} from "@/lib/people/onboarding.functions";

import { IsoDatePicker } from "@/components/iso-date-picker";
import { formatIsoDate } from "@/lib/iso-date";
const planStatusTone: Record<OnbPlanStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-emerald-500/10 text-emerald-700",
  canceled: "bg-rose-500/10 text-rose-700",
};

const taskStatusTone: Record<OnbTaskStatus, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-primary",
  done: "text-emerald-600",
  blocked: "text-rose-600",
  skipped: "text-muted-foreground",
};

function TaskStatusIcon({ status }: { status: OnbTaskStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4" />;
    case "in_progress":
      return <Clock className="h-4 w-4" />;
    case "blocked":
      return <Ban className="h-4 w-4" />;
    case "skipped":
      return <MinusCircle className="h-4 w-4" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
}

export function OnboardingPanel({ personId }: { personId: string }) {
  const { canAny, workspaceId } = usePermissions();
  const allowedKinds = ONB_KINDS.filter(
    (kind) =>
      canAny([`techpeople.${kind}.create.workspace`, `techpeople.${kind}.create.own`]) &&
      canAny(["workspace", "team", "own"].map((s) => `techpeople.${kind}.view.${s}`)),
  );
  const qc = useQueryClient();
  const listFn = useServerFn(listOnbPlans);
  const delPlanFn = useServerFn(deleteOnbPlan);

  const {
    data: plans = [],
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["person-onb-plans", personId, workspaceId],
    queryFn: () => listFn({ data: { person_id: personId } }),
    staleTime: 15_000,
  });

  const access = useHrCapabilities(
    "onboarding_plans",
    plans.map((p) => p.id),
  );
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const delMut = useMutation({
    mutationFn: (id: string) => delPlanFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-onb-plans", personId] });
      toast.success("Plano removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isError) return <HrAccessError retry={() => void refetch()} />;
  if (isLoading) return <p role="status">Carregando planos…</p>;
  return (
    <div className="space-y-4">
      {access.isError && <HrAccessError retry={() => void access.refetch()} />}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Onboarding & Offboarding
            </CardTitle>
            <CardDescription>
              Checklists de admissão e desligamento aplicados a esta pessoa.
            </CardDescription>
          </div>
          {allowedKinds.length > 0 ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo plano
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {plans.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Nenhum plano criado ainda.
            </div>
          ) : (
            plans.map((plan) => {
              const prog = plan.progress ?? { total: 0, done: 0 };
              const pct = prog.total > 0 ? (prog.done / prog.total) * 100 : 0;
              const isExpanded = expanded === plan.id;
              return (
                <Card key={plan.id} className="border-l-4 border-l-primary/40">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left flex-1"
                        onClick={() => setExpanded(isExpanded ? null : plan.id)}
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                        <div>
                          <div className="text-sm font-medium">
                            {ONB_KIND_LABELS[plan.kind]}
                            {plan.started_at ? ` · início ${plan.started_at}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {prog.done}/{prog.total} tarefas concluídas
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <Badge className={planStatusTone[plan.status]} variant="outline">
                          {ONB_PLAN_STATUS_LABELS[plan.status]}
                        </Badge>
                        {access.for(plan.id).can_delete ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={async () => {
                              if (await confirmDialog("Excluir plano e todas suas tarefas?")) {
                                delMut.mutate(plan.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5 mt-2" />
                  </CardHeader>
                  {isExpanded ? (
                    <CardContent className="p-4 pt-2">
                      <PlanTasks planId={plan.id} plan={plan} />
                    </CardContent>
                  ) : null}
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      {open && allowedKinds.length > 0 ? (
        <NewPlanDialog
          personId={personId}
          allowedKinds={allowedKinds}
          key={allowedKinds.join(",")}
          onClose={() => setOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["person-onb-plans", personId] });
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function PlanTasks({ planId, plan }: { planId: string; plan: OnbPlanRow }) {
  const { workspaceId } = usePermissions();
  const qc = useQueryClient();
  const getFn = useServerFn(getOnbPlanWithTasks);
  const setStatusFn = useServerFn(setOnbTaskStatus);
  const upsertFn = useServerFn(upsertOnbTask);
  const delFn = useServerFn(deleteOnbTask);
  const updatePlanFn = useServerFn(updateOnbPlan);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["onb-plan", planId, workspaceId],
    queryFn: () => getFn({ data: { id: planId } }),
    staleTime: 5_000,
  });

  const planAccess = useHrCapabilities("onboarding_plans", [planId]);
  const taskAccess = useHrCapabilities("onboarding_tasks", data?.tasks.map((t) => t.id) ?? []);
  const canWrite = planAccess.for(planId).can_update;
  const canCreateTask = planAccess.for(planId).can_create_child;
  const [editingTask, setEditingTask] = useState<OnbTaskRow | "new" | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["onb-plan", planId] });
    qc.invalidateQueries({ queryKey: ["person-onb-plans"] });
  };

  const setStatusMut = useMutation({
    mutationFn: (v: { id: string; status: OnbTaskStatus }) => setStatusFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Tarefa removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const planStatusMut = useMutation({
    mutationFn: (status: OnbPlanStatus) => updatePlanFn({ data: { id: planId, status } }),
    onSuccess: () => {
      invalidate();
      toast.success("Status do plano atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isError) return <HrAccessError retry={() => void refetch()} />;
  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Carregando…</div>;
  }

  if (!data) return <p role="alert">Plano indisponível ou sem acesso.</p>;
  const tasks = data.tasks;

  return (
    <div className="space-y-3">
      {(planAccess.isError || taskAccess.isError) && (
        <HrAccessError
          retry={() => {
            void planAccess.refetch();
            void taskAccess.refetch();
          }}
        />
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs text-muted-foreground">Status do plano:</Label>
        <Select
          value={plan.status}
          disabled={!canWrite}
          onValueChange={(v) => planStatusMut.mutate(v as OnbPlanStatus)}
        >
          <SelectTrigger className="h-8 w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ONB_PLAN_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ONB_PLAN_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {plan.target_completion_date ? (
          <span className="text-xs text-muted-foreground">
            Prazo: {plan.target_completion_date}
          </span>
        ) : null}
        <div className="ml-auto">
          {canCreateTask ? (
            <Button size="sm" variant="outline" onClick={() => setEditingTask("new")}>
              <Plus className="h-4 w-4 mr-2" /> Nova tarefa
            </Button>
          ) : null}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">
          Nenhuma tarefa neste plano.
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-2 p-2 rounded border bg-card hover:bg-muted/40"
            >
              <button
                type="button"
                className={`mt-0.5 ${taskStatusTone[t.status]}`}
                onClick={() =>
                  taskAccess.for(t.id).can_update &&
                  setStatusMut.mutate({
                    id: t.id,
                    status: t.status === "done" ? "pending" : "done",
                  })
                }
                disabled={!taskAccess.for(t.id).can_update || setStatusMut.isPending}
                title={ONB_TASK_STATUS_LABELS[t.status]}
              >
                <TaskStatusIcon status={t.status} />
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}
                >
                  {t.title}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  {t.category ? <span>{t.category}</span> : null}
                  {t.due_date ? <span>· prazo {t.due_date}</span> : null}
                  {t.description ? <span className="truncate">· {t.description}</span> : null}
                </div>
              </div>
              <Select
                value={t.status}
                disabled={!taskAccess.for(t.id).can_update || setStatusMut.isPending}
                onValueChange={(v) => setStatusMut.mutate({ id: t.id, status: v as OnbTaskStatus })}
              >
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONB_TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ONB_TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <>
                {taskAccess.for(t.id).can_edit_settings ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditingTask(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                {taskAccess.for(t.id).can_delete ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={async () => {
                      if (await confirmDialog("Excluir tarefa?")) delMut.mutate(t.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </>
            </div>
          ))}
        </div>
      )}

      {editingTask &&
      (editingTask === "new" ? canCreateTask : taskAccess.for(editingTask.id).can_edit_settings) ? (
        <TaskDialog
          planId={planId}
          task={editingTask === "new" ? null : editingTask}
          nextIndex={tasks.length}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            invalidate();
            setEditingTask(null);
          }}
          upsert={upsertFn}
        />
      ) : null}
    </div>
  );
}

function NewPlanDialog({
  personId,
  allowedKinds,
  onClose,
  onCreated,
}: {
  personId: string;
  allowedKinds: OnbKind[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { workspaceId, canAny } = usePermissions();
  const listTplFn = useServerFn(listOnbTemplates);
  const createFn = useServerFn(createOnbPlan);

  const [kind, setKind] = useState<OnbKind>(allowedKinds[0]);
  const [templateId, setTemplateId] = useState<string>("__none__");
  const [startedAt, setStartedAt] = useState<string>(formatIsoDate(new Date()));
  const [target, setTarget] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const { data: templates = [] } = useQuery({
    queryKey: ["onb-templates", kind, workspaceId],
    queryFn: () => listTplFn({ data: { kind } }),
    staleTime: 30_000,
    enabled: canAny(
      ["workspace", "team", "own"].map((s) => `techpeople.onboarding_templates.view.${s}`),
    ),
  });

  const filteredTemplates = useMemo(() => templates.filter((t) => t.is_active), [templates]);

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          person_id: personId,
          template_id: templateId === "__none__" ? null : templateId,
          kind,
          status: "in_progress",
          started_at: startedAt || null,
          target_completion_date: target || null,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Plano criado");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo plano</DialogTitle>
          <DialogDescription>Aplique um checklist de admissão ou desligamento.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as OnbKind);
                setTemplateId("__none__");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedKinds.map((k) => (
                  <SelectItem key={k} value={k}>
                    {ONB_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar modelo…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem modelo (plano vazio)</SelectItem>
                {filteredTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.role_title ? ` · ${t.role_title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <IsoDatePicker
                ariaLabel="Início"
                value={startedAt}
                onChange={(v) => setStartedAt(v ?? "")}
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <IsoDatePicker
                ariaLabel="Prazo"
                value={target}
                onChange={(v) => setTarget(v ?? "")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={createMut.isPending} onClick={() => createMut.mutate()}>
            Criar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({
  planId,
  task,
  nextIndex,
  onClose,
  onSaved,
  upsert,
}: {
  planId: string;
  task: OnbTaskRow | null;
  nextIndex: number;
  onClose: () => void;
  onSaved: () => void;
  upsert: ReturnType<typeof useServerFn<typeof upsertOnbTask>>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [category, setCategory] = useState(task?.category ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [status, setStatus] = useState<OnbTaskStatus>(task?.status ?? "pending");
  const [isCritical, setIsCritical] = useState<boolean>(task?.is_critical ?? false);
  const [revocationSystem, setRevocationSystem] = useState<string>(task?.revocation_system ?? "");

  const mut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: task?.id ?? null,
          plan_id: planId,
          title,
          description: description || null,
          category: category || null,
          due_date: dueDate || null,
          status,
          order_index: task?.order_index ?? nextIndex,
          is_critical: isCritical,
          revocation_system: revocationSystem.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                value={category ?? ""}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="RH, TI, Financeiro…"
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <IsoDatePicker
                ariaLabel="Prazo"
                value={dueDate ?? ""}
                onChange={(v) => setDueDate(v ?? "")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OnbTaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ONB_TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ONB_TASK_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Item crítico de compliance</Label>
                <p className="text-xs text-muted-foreground">
                  Marque tarefas obrigatórias de desligamento (revogação de acesso, backup de dados,
                  termos assinados) para acompanhamento no painel de compliance.
                </p>
              </div>
              <Switch checked={isCritical} onCheckedChange={setIsCritical} />
            </div>
            {isCritical ? (
              <div className="space-y-2">
                <Label>Sistema alvo da revogação</Label>
                <Input
                  value={revocationSystem}
                  onChange={(e) => setRevocationSystem(e.target.value)}
                  placeholder="Google Workspace, Slack, GitHub, VPN…"
                />
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={mut.isPending || !title.trim()} onClick={() => mut.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
