// Funil dinâmico do pipeline selecionado (apenas etapas abertas).
import { Link } from "@tanstack/react-router";
import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import { formatCurrency } from "@/lib/crm";
import type { FunnelStageRow } from "@/lib/deals/sales-dashboard.types";

export function FunnelPanel({
  funnel,
  pipelineName,
}: {
  funnel: FunnelStageRow[];
  pipelineName: string | null;
}) {
  const max = Math.max(1, ...funnel.map((s) => s.count));

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SectionHeader
        title="Funil por etapa"
        description={pipelineName ? `Pipeline: ${pipelineName}` : "Negócios abertos por etapa."}
        action={
          <Link
            to="/deals"
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver negócios
          </Link>
        }
      />
      <div className="mt-3">
        {funnel.length === 0 ? (
          <EmptyState
            compact
            title="Nenhuma etapa aberta"
            description="Configure as etapas do pipeline para visualizar o funil."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {funnel.map((s) => (
              <li key={s.value}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-text-primary">
                    {s.label}
                    <span className="ml-1.5 font-normal text-text-tertiary">{s.probability}%</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-text-secondary">
                    {s.count} · {formatCurrency(s.valueSum)}
                  </span>
                </div>
                <div
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
                  role="img"
                  aria-label={`${s.label}: ${s.count} negócios, ${formatCurrency(s.valueSum)}`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (s.count / max) * 100)}%`,
                      backgroundColor: s.color ?? "var(--color-chart-1)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
