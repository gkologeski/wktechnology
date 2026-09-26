import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeDollarSign, CircleCheck, ContactRound, Target } from "lucide-react";
import { EmptyState, MetricCard, SectionHeader } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/crm";
import type { LeadChannel, LeadJourneyData } from "@/lib/deals/sales-dashboard.types";

const pct = (value: number) => `${value.toFixed(1)}%`;

export function LeadJourneyKpis({ journey }: { journey: LeadJourneyData }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Leads novos"
        value={journey.totalLeads.toLocaleString("pt-BR")}
        hint="Entradas no período"
        icon={ContactRound}
      />
      <MetricCard
        label="Qualificados"
        value={journey.qualified.toLocaleString("pt-BR")}
        hint={`${pct(journey.leadToQualifiedRate)} dos leads`}
        icon={CircleCheck}
        tone="positive"
      />
      <MetricCard
        label="Oportunidades"
        value={journey.opportunities.toLocaleString("pt-BR")}
        hint={`${pct(journey.qualifiedToOpportunityRate)} dos qualificados`}
        icon={Target}
        tone="warning"
      />
      <MetricCard
        label="Vendas atribuídas"
        value={journey.sales.toLocaleString("pt-BR")}
        hint={`${pct(journey.opportunityToSaleRate)} das oportunidades · ${formatCurrency(journey.revenue)}`}
        icon={BadgeDollarSign}
        tone="positive"
      />
    </div>
  );
}

export function LeadJourneyOverview({ journey }: { journey: LeadJourneyData }) {
  const steps = [
    { label: "Leads", value: journey.totalLeads, rate: null },
    { label: "Qualificados", value: journey.qualified, rate: journey.leadToQualifiedRate },
    {
      label: "Oportunidades",
      value: journey.opportunities,
      rate: journey.qualifiedToOpportunityRate,
    },
    { label: "Vendas", value: journey.sales, rate: journey.opportunityToSaleRate },
  ];
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4 md:p-5">
      <SectionHeader
        title="Caminho do lead até a venda"
        description="Origem principal e conversão da coorte criada no período."
      />
      <ol className="mt-5 grid gap-3 md:grid-cols-4" aria-label="Jornada de conversão">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="relative min-w-0 rounded-md border border-border-subtle bg-surface-2 p-4"
          >
            <div className="text-xs font-medium text-text-secondary">{step.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
              {step.value.toLocaleString("pt-BR")}
            </div>
            <div className="mt-2 min-h-5 text-xs text-text-tertiary">
              {step.rate == null ? "Entrada da jornada" : `${pct(step.rate)} da etapa anterior`}
            </div>
            {index < steps.length - 1 ? (
              <ArrowRight
                className="absolute -right-5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-text-tertiary md:block"
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs text-text-secondary">
        <span>
          {journey.attributionCoverage.toFixed(1)}% das conversões possuem negócio rastreável.
        </span>
        <span>Receita atribuída: {formatCurrency(journey.revenue)} · Origem principal</span>
      </div>
    </section>
  );
}

export function LeadChannelsPanel({
  journey,
  onSelect,
}: {
  journey: LeadJourneyData;
  onSelect: (channel: LeadChannel | null) => void;
}) {
  const max = Math.max(1, ...journey.channels.map((channel) => channel.leads));
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SectionHeader
        title="Leads por canal"
        description="Quantidade e participação nas entradas do período."
        action={
          journey.selectedChannel ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
              Limpar canal
            </Button>
          ) : undefined
        }
      />
      {journey.channels.length === 0 ? (
        <EmptyState
          compact
          title="Nenhum lead no período"
          description="Amplie o período ou remova os filtros para comparar os canais."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {journey.channels.map((channel) => (
            <li key={channel.key}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSelect(channel.key)}
                className="group h-auto w-full flex-col items-stretch rounded-sm px-1 py-1.5 text-left"
                aria-label={`Filtrar pelo canal ${channel.label}, ${channel.leads} leads`}
              >
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-text-primary group-hover:text-primary">
                    {channel.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-text-secondary">
                    {channel.leads} · {pct(channel.share)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${Math.max(2, (channel.leads / max) * 100)}%` }}
                  />
                </div>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LeadFunnelPanel({ journey }: { journey: LeadJourneyData }) {
  const max = Math.max(1, ...journey.stages.map((stage) => stage.count));
  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SectionHeader
        title="Funil de Leads"
        description={
          journey.leadPipelineName
            ? `Funil: ${journey.leadPipelineName}`
            : "Etapas atuais dos leads criados no período."
        }
        action={
          <Link
            to="/leads"
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver leads
          </Link>
        }
      />
      {journey.stages.length === 0 ? (
        <EmptyState
          compact
          title="Nenhuma etapa configurada"
          description="Configure um funil de Leads para visualizar as etapas."
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {journey.stages.map((stage) => (
            <li key={stage.value}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-medium text-text-primary">{stage.label}</span>
                <span className="shrink-0 tabular-nums text-text-secondary">
                  {stage.count} · {pct(stage.share)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (stage.count / max) * 100)}%`,
                    backgroundColor: stage.color ?? "var(--color-chart-2)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
