import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listGoals,
  upsertGoal,
  deleteGoal,
  computeGoalsProgress,
  GOAL_METRICS,
  GOAL_METRIC_LABELS,
  GOAL_PERIODS,
  GOAL_PERIOD_LABELS,
  type GoalMetric,
  type GoalPeriod,
} from "@/lib/goals.functions";
import { listTeamMembers } from "@/lib/teams.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Target, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/goals")({
  component: GoalsPage,
});

type GoalRow = {
  id: string;
  name: string;
  metric: GoalMetric;
  period: GoalPeriod;
  period_start: string;
  period_end: string;
  target_value: number;
  target_user_id: string | null;
  pipeline_id: string | null;
  notes: string | null;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function periodBounds(period: GoalPeriod) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (period === "month") {
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (period === "quarter") {
    const q = Math.floor(m / 3);
    const start = new Date(Date.UTC(y, q * 3, 1));
    const end = new Date(Date.UTC(y, q * 3 + 3, 0));
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  if (period === "year") {
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  return { start: todayISO(), end: todayISO() };
}

function formatValue(metric: GoalMetric, v: number) {
  if (metric === "deals_won_value") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  }
  return new Intl.NumberFormat("pt-BR").format(v);
}

function GoalsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listGoals);
  const compute = useServerFn(computeGoalsProgress);
  const teams = useServerFn(listTeamMembers);
  const save = useServerFn(upsertGoal);
  const remove = useServerFn(deleteGoal);

  const goalsQ = useQuery({ queryKey: ["goals"], queryFn: () => list() });
  const progressQ = useQuery({
    queryKey: ["goals-progress"],
    queryFn: () => compute(),
    refetchInterval: 60000,
  });
  const teamQ = useQuery({ queryKey: ["team-members"], queryFn: () => teams() });

  const progressById = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of progressQ.data ?? []) m.set(r.goal_id, r.current);
    return m;
  }, [progressQ.data]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GoalRow | null>(null);
  const [form, setForm] = useState<Omit<GoalRow, "id">>(emptyForm());

  function emptyForm(): Omit<GoalRow, "id"> {
    const b = periodBounds("month");
    return {
      name: "",
      metric: "deals_won_value",
      period: "month",
      period_start: b.start,
      period_end: b.end,
      target_value: 0,
      target_user_id: null,
      pipeline_id: null,
      notes: null,
    };
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }
  function openEdit(g: GoalRow) {
    setEditing(g);
    setForm({ ...g });
    setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: (data: any) => save({ data }),
    onSuccess: () => {
      toast.success("Meta salva.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["goals-progress"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Meta removida.");
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["goals-progress"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  function handleSubmit() {
    if (!form.name.trim()) return toast.error("Dê um nome à meta.");
    if (form.target_value <= 0) return toast.error("Defina uma meta maior que zero.");
    saveMut.mutate({
      ...(editing ? { id: editing.id } : {}),
      name: form.name.trim(),
      metric: form.metric,
      period: form.period,
      period_start: form.period_start,
      period_end: form.period_end,
      target_value: Number(form.target_value),
      target_user_id: form.target_user_id,
      pipeline_id: form.pipeline_id,
      notes: form.notes,
    });
  }

  const memberLabel = (id: string | null) => {
    if (!id) return "Time todo";
    const m = (teamQ.data ?? []).find((x: any) => x.member_user_id === id || x.id === id);
    return m?.full_name || m?.email || "Membro";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Metas
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Defina metas por usuário ou time, com base em ganhos, atividades, ligações e mais.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Nova meta
          </Button>
        </CardHeader>
        <CardContent>
          {goalsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (goalsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(goalsQ.data as GoalRow[]).map((g) => {
                const current = progressById.get(g.id) ?? 0;
                const pct =
                  g.target_value > 0 ? Math.min(100, (current / Number(g.target_value)) * 100) : 0;
                return (
                  <Card key={g.id} className="border">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{g.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {GOAL_METRIC_LABELS[g.metric]} · {GOAL_PERIOD_LABELS[g.period]}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(g)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => delMut.mutate(g.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{formatValue(g.metric, current)}</span>
                        <span className="text-muted-foreground">
                          de {formatValue(g.metric, Number(g.target_value))}
                        </span>
                      </div>
                      <Progress value={pct} />
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">{memberLabel(g.target_user_id)}</Badge>
                        <Badge variant="outline">
                          {g.period_start} → {g.period_end}
                        </Badge>
                        <Badge variant={pct >= 100 ? "default" : "outline"}>
                          {pct.toFixed(0)}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar meta" : "Nova meta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Métrica</Label>
                <Select
                  value={form.metric}
                  onValueChange={(v) => setForm({ ...form, metric: v as GoalMetric })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_METRICS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {GOAL_METRIC_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Período</Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => {
                    const p = v as GoalPeriod;
                    const b =
                      p === "custom"
                        ? { start: form.period_start, end: form.period_end }
                        : periodBounds(p);
                    setForm({ ...form, period: p, period_start: b.start, period_end: b.end });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {GOAL_PERIOD_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Meta (valor alvo)</Label>
                <CurrencyInput
                  currency="BRL"
                  value={form.target_value}
                  onValueChange={(n) => setForm({ ...form, target_value: n ?? 0 })}
                />
              </div>
              <div>
                <Label>Atribuir a</Label>
                <Select
                  value={form.target_user_id ?? "__team__"}
                  onValueChange={(v) =>
                    setForm({ ...form, target_user_id: v === "__team__" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__team__">Time todo</SelectItem>
                    {(teamQ.data ?? []).map((m: any) => (
                      <SelectItem key={m.member_user_id ?? m.id} value={m.member_user_id ?? m.id}>
                        {m.full_name || m.email || "Membro"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <RichHtmlEditor
                value={form.notes ?? ""}
                onChange={(html) => setForm({ ...form, notes: html || null })}
                minHeight={120}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O progresso é calculado a partir dos dados do workspace no período. Metas por usuário
              são referenciais — quando os registros tiverem atribuição individual, o progresso se
              ajusta automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saveMut.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
