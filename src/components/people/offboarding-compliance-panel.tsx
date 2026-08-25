// TechPeople · Sprint 9 — Painel de compliance de desligamento.
// Consolida itens críticos (revogação técnica, backup, termos) da ficha 360°.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, ShieldCheck, Clock, KeyRound, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getOffboardingCompliance,
  ONB_TASK_STATUS_LABELS,
  type OffboardingComplianceSummary,
} from "@/lib/people/onboarding.functions";

type Props = { personId: string };

function pct(done: number, total: number): number {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function OffboardingCompliancePanel({ personId }: Props) {
  const fetchFn = useServerFn(getOffboardingCompliance);
  const { data, isLoading } = useQuery<OffboardingComplianceSummary>({
    queryKey: ["offboarding-compliance", personId],
    queryFn: () => fetchFn({ data: { person_id: personId } }),
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance de desligamento</CardTitle>
          <CardDescription>Carregando itens críticos…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || !data.has_plan) {
    return (
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Compliance de desligamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum plano de desligamento ativo para esta pessoa. Ao alterar o status para
            <span className="font-medium"> Desligamento</span>, um plano será criado automaticamente
            a partir do template padrão.
          </p>
        </CardContent>
      </Card>
    );
  }

  const t = data.totals;
  const progress = pct(t.done, t.total);
  const hasAlert = t.overdue > 0 || t.critical_pending > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          {hasAlert ? (
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          )}
          <div>
            <CardTitle className="text-base">Compliance de desligamento</CardTitle>
            <CardDescription>
              {t.critical_total} item(ns) crítico(s) · {t.done}/{t.total} tarefas concluídas
            </CardDescription>
          </div>
        </div>
        <Badge variant={hasAlert ? "destructive" : "secondary"} className="uppercase text-[10px]">
          {hasAlert ? "Ação necessária" : "Em dia"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progresso</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatChip
            icon={<KeyRound className="h-3.5 w-3.5" />}
            label="Críticos pendentes"
            value={t.critical_pending}
            tone={t.critical_pending > 0 ? "danger" : "muted"}
          />
          <StatChip
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Vencidos"
            value={t.overdue}
            tone={t.overdue > 0 ? "danger" : "muted"}
          />
          <StatChip
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="Concluídos"
            value={t.done}
            tone="success"
          />
        </div>

        {data.critical_tasks.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <AlertTriangle className="h-3.5 w-3.5" />
              Itens críticos
            </div>
            <ul className="divide-y divide-border rounded-md border">
              {data.critical_tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{task.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      {task.category ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {task.category}
                        </Badge>
                      ) : null}
                      {task.revocation_system ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {task.revocation_system}
                        </Badge>
                      ) : null}
                      {task.due_date ? (
                        <span className={task.is_overdue ? "text-rose-600 font-medium" : ""}>
                          {task.is_overdue ? "Vencido em " : "Vence em "}
                          {new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Badge
                    variant={
                      task.status === "done"
                        ? "secondary"
                        : task.is_overdue
                          ? "destructive"
                          : "outline"
                    }
                    className="text-[10px] whitespace-nowrap"
                  >
                    {ONB_TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhum item marcado como crítico neste plano. Marque tarefas como críticas no template
            de offboarding para acompanhá-las aqui.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "danger" | "success" | "muted";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
      : tone === "success"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "bg-muted text-muted-foreground";
  return (
    <div className={`rounded-md px-2.5 py-1.5 ${toneClass}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold leading-none mt-1">{value}</div>
    </div>
  );
}
