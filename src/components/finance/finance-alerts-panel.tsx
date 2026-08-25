// Sprint 7 — Painel de alertas operacionais para o dashboard financeiro.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FileWarning, FolderKanban, Flag } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOperationalAlerts } from "@/lib/alerts.functions";
import { formatCurrency } from "@/lib/crm";

function daysUntil(dateIso: string): number {
  const d = new Date(dateIso);
  const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function FinanceAlertsPanel() {
  const fetch = useServerFn(getOperationalAlerts);
  const { data, isLoading } = useQuery({
    queryKey: ["operational-alerts"],
    queryFn: () => fetch(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Carregando…</CardContent>
      </Card>
    );
  }

  const contracts = data?.contractsExpiring ?? [];
  const entries = data?.overdueEntries ?? [];
  const projects = data?.projectsAtRisk ?? [];
  const milestones = data?.overdueMilestones ?? [];
  const total = contracts.length + entries.length + projects.length + milestones.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas operacionais
          </span>
          <Badge variant="outline" className="tabular-nums">
            {total}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {total === 0 && (
          <p className="text-sm text-muted-foreground">
            Tudo em dia — sem contratos vencendo, lançamentos atrasados ou projetos em risco.
          </p>
        )}

        {entries.length > 0 && (
          <Section
            icon={FileWarning}
            title="Lançamentos vencidos"
            count={entries.length}
            tone="rose"
          >
            <ul className="space-y-1.5 text-sm">
              {entries.slice(0, 5).map((e) => {
                const outstanding = Number(e.amount) - Number(e.paid_amount ?? 0);
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <Link
                      to="/finance/entries/$id"
                      params={{ id: e.id }}
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      {e.description}
                      <span className="text-xs text-muted-foreground ml-1">
                        · {e.companies?.name ?? "—"}
                      </span>
                    </Link>
                    <span className="shrink-0 tabular-nums text-rose-600 dark:text-rose-400 font-medium">
                      {formatCurrency(outstanding, e.currency)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {Math.abs(daysUntil(e.due_date))}d atrás
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {contracts.length > 0 && (
          <Section
            icon={AlertTriangle}
            title="Contratos vencendo em 30 dias"
            count={contracts.length}
            tone="amber"
          >
            <ul className="space-y-1.5 text-sm">
              {contracts.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <Link
                    to="/contracts/$id"
                    params={{ id: c.id }}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {c.title}
                    <span className="text-xs text-muted-foreground ml-1">· {c.number}</span>
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.ends_at ? `em ${daysUntil(c.ends_at)}d` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {milestones.length > 0 && (
          <Section
            icon={Flag}
            title="Marcos billáveis atrasados"
            count={milestones.length}
            tone="rose"
          >
            <ul className="space-y-1.5 text-sm">
              {milestones.slice(0, 5).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <Link
                    to="/projects/$id"
                    params={{ id: m.project_id }}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {m.name}
                    <span className="text-xs text-muted-foreground ml-1">
                      · {m.projects?.name ?? "—"}
                    </span>
                  </Link>
                  {m.bill_amount != null && (
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {formatCurrency(Number(m.bill_amount))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {projects.length > 0 && (
          <Section
            icon={FolderKanban}
            title="Projetos com prazo próximo"
            count={projects.length}
            tone="amber"
          >
            <ul className="space-y-1.5 text-sm">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <Link
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.progress ?? 0}% · {p.due_at ? `em ${daysUntil(p.due_at)}d` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  tone: "amber" | "rose";
  children: React.ReactNode;
}) {
  const cls =
    tone === "rose" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400";
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm font-medium">
        <Icon className={`h-4 w-4 ${cls}`} />
        <span>{title}</span>
        <Badge variant="outline" className="ml-auto tabular-nums">
          {count}
        </Badge>
      </div>
      {children}
    </div>
  );
}
