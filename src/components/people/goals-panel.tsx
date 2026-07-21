// Painel de Metas (OKR/KPI) da pessoa. Sprint 2 do TechPeople.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

import {
  listGoals,
  upsertGoal,
  deleteGoal,
  GOAL_METRIC_TYPES,
  GOAL_METRIC_LABELS,
  GOAL_STATUSES,
  GOAL_STATUS_LABELS,
  type GoalRow,
  type GoalMetricType,
  type GoalStatus,
} from "@/lib/people/performance.functions";

export function GoalsPanel({ personId, canWrite }: { personId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listGoals);
  const delFn = useServerFn(deleteGoal);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GoalRow | null>(null);

  const { data: goals = [] } = useQuery({
    queryKey: ["person-goals", personId],
    queryFn: () => listFn({ data: { person_id: personId } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-goals", personId] });
      toast.success("Meta removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova meta
          </Button>
        </div>
      ) : null}

      {goals.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            <Target className="h-6 w-6 mx-auto mb-2 opacity-60" />
            Nenhuma meta cadastrada.
          </CardContent>
        </Card>
      ) : (
        goals.map((g) => (
          <Card key={g.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{g.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                    <Badge variant="outline">{GOAL_METRIC_LABELS[g.metric_type]}</Badge>
                    <Badge variant="secondary">{GOAL_STATUS_LABELS[g.status]}</Badge>
                    {g.period_end ? <span>até {g.period_end}</span> : null}
                    {g.target_value !== null ? (
                      <span>
                        {g.current_value} / {g.target_value} {g.unit ?? ""}
                      </span>
                    ) : null}
                  </div>
                </div>
                {canWrite ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(g);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Remover meta?")) del.mutate(g.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
              <Progress value={Number(g.progress_pct) || 0} />
              {g.description ? (
                <div className="text-xs text-muted-foreground whitespace-pre-line">
                  {g.description}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}

      <GoalDialog open={open} onOpenChange={setOpen} personId={personId} goal={editing} />
    </div>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  personId,
  goal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
  goal: GoalRow | null;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertGoal);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [metricType, setMetricType] = useState<GoalMetricType>(goal?.metric_type ?? "kpi");
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "active");
  const [unit, setUnit] = useState(goal?.unit ?? "");
  const [target, setTarget] = useState(goal?.target_value?.toString() ?? "");
  const [current, setCurrent] = useState(goal?.current_value?.toString() ?? "0");
  const [progress, setProgress] = useState(goal?.progress_pct?.toString() ?? "0");
  const [periodStart, setPeriodStart] = useState(goal?.period_start ?? "");
  const [periodEnd, setPeriodEnd] = useState(goal?.period_end ?? "");
  const [weight, setWeight] = useState(goal?.weight?.toString() ?? "1");

  // Reset form when opening
  const key = goal?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (open && lastKey !== key) {
    setTitle(goal?.title ?? "");
    setDescription(goal?.description ?? "");
    setMetricType(goal?.metric_type ?? "kpi");
    setStatus(goal?.status ?? "active");
    setUnit(goal?.unit ?? "");
    setTarget(goal?.target_value?.toString() ?? "");
    setCurrent(goal?.current_value?.toString() ?? "0");
    setProgress(goal?.progress_pct?.toString() ?? "0");
    setPeriodStart(goal?.period_start ?? "");
    setPeriodEnd(goal?.period_end ?? "");
    setWeight(goal?.weight?.toString() ?? "1");
    setLastKey(key);
  }

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: goal?.id ?? null,
          person_id: personId,
          title,
          description: description || null,
          metric_type: metricType,
          status,
          unit: unit || null,
          target_value: target === "" ? null : Number(target),
          current_value: Number(current) || 0,
          progress_pct: Math.max(0, Math.min(100, Number(progress) || 0)),
          period_start: periodStart || null,
          period_end: periodEnd || null,
          weight: Number(weight) || 1,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person-goals", personId] });
      toast.success(goal ? "Meta atualizada" : "Meta criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={metricType} onValueChange={(v) => setMetricType(v as GoalMetricType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_METRIC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {GOAL_METRIC_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as GoalStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {GOAL_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Unidade</Label>
            <Input value={unit ?? ""} onChange={(e) => setUnit(e.target.value)} placeholder="%, R$, itens" />
          </div>
          <div className="space-y-1">
            <Label>Peso</Label>
            <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Valor atual</Label>
            <Input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Valor alvo</Label>
            <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Progresso (%)</Label>
            <Input type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Início</Label>
            <Input type="date" value={periodStart ?? ""} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fim</Label>
            <Input type="date" value={periodEnd ?? ""} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!title || save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
