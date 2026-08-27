// Faixa de KPIs do painel de vendas — 4 cards com comparativo de período/meta.
import { HandCoins, Target, TrendingUp, Wallet } from "lucide-react";
import { MetricCard } from "@/components/techhire/ui";
import { formatCurrency } from "@/lib/crm";
import type { SalesDashboardKpis } from "@/lib/deals/sales-dashboard.types";

function delta(value: number, suffix: string): { value: string; direction: "up" | "down" | "flat" } {
  const direction = value > 0.05 ? "up" : value < -0.05 ? "down" : "flat";
  const sign = value > 0 ? "+" : "";
  return { value: `${sign}${value.toFixed(1)}${suffix}`, direction };
}

export function SalesKpiStrip({ kpis }: { kpis: SalesDashboardKpis }) {
  const goalPct =
    kpis.goalValue && kpis.goalValue > 0
      ? Math.min(100, Math.round((kpis.wonValue / kpis.goalValue) * 100))
      : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Pipeline aberto"
        value={formatCurrency(kpis.pipelineValue)}
        hint={`${kpis.openDeals} negócios ativos · previsão ponderada ${formatCurrency(kpis.forecastValue)} (${kpis.forecastDeals} no mês)`}
        icon={Wallet}
        tone="neutral"
      />
      <MetricCard
        label="Ganho no mês"
        value={formatCurrency(kpis.wonValue)}
        hint={
          kpis.goalValue
            ? `Meta ${formatCurrency(kpis.goalValue)} · ${goalPct}% atingido`
            : `${kpis.wonCount} negócios ganhos no mês`
        }
        delta={kpis.wonDeltaPct != null ? delta(kpis.wonDeltaPct, "%") : undefined}
        icon={HandCoins}
        tone="positive"
      />
      <MetricCard
        label="Taxa de conversão"
        value={`${kpis.conversionRate.toFixed(1)}%`}
        hint="Ganhos ÷ (ganhos + perdidos) no período"
        delta={
          kpis.conversionDelta != null ? delta(kpis.conversionDelta, " p.p.") : undefined
        }
        icon={TrendingUp}
        tone={kpis.conversionRate >= 30 ? "positive" : "neutral"}
      />
      <MetricCard
        label="Ticket médio"
        value={kpis.avgTicket != null ? formatCurrency(kpis.avgTicket) : "—"}
        hint="Negócios ganhos no período"
        icon={Target}
        tone="neutral"
      />
    </div>
  );
}
