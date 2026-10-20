// Faixa de cobertura do painel do TechProjects (apresentação pura).
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import type { ProjectDashboardData } from "@/lib/projects/dashboard.types";
import { formatHours } from "@/lib/projects/reconciliation-labels";

const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "nunca";

export function CoverageStrip({
  data,
  reviewSearch,
}: {
  data: ProjectDashboardData;
  reviewSearch: { tab: "issues"; from: string; to: string };
}) {
  const validated = data.period.seconds - data.period.secondsInReview;
  return (
    <section
      aria-label="Cobertura e pendências das horas"
      className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-2 p-4 shadow-xs md:flex-row md:items-center md:justify-between"
    >
      <dl className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-text-tertiary">Total bruto no período</dt>
          <dd className="text-sm font-medium tabular-nums text-text-primary">
            {formatHours(data.period.seconds)} · {data.period.rows.toLocaleString("pt-BR")}{" "}
            registros
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-tertiary">Sem alerta aberto</dt>
          <dd className="text-sm font-medium tabular-nums text-text-primary">
            {data.coverage.issuesVisible
              ? formatHours(validated)
              : "Não disponível para seu acesso"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-tertiary">Em revisão (alerta aberto)</dt>
          <dd className="text-sm font-medium tabular-nums text-text-primary">
            {data.coverage.issuesVisible
              ? `${formatHours(data.period.secondsInReview)} · ${data.period.rowsInReview.toLocaleString("pt-BR")} registros`
              : "Não disponível para seu acesso"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col items-start gap-1 md:items-end">
        {data.coverage.issuesVisible ? (
          <p className="flex items-center gap-1.5 text-xs text-text-secondary">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            {data.coverage.openIssues.toLocaleString("pt-BR")} pendências abertas · fila conferida
            em {dateTime(data.coverage.lastRefreshAt)}
          </p>
        ) : null}
        <p className="text-xs text-text-tertiary">
          Dados atualizados em {dateTime(data.generatedAt)}
        </p>
        {data.coverage.canOpenCenter ? (
          <Link
            to="/projects/settings/imports/reconciliation"
            search={reviewSearch}
            className="text-xs font-medium text-primary hover:underline"
          >
            Abrir pendências do período →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
