// Listas de negócios do painel: fase avançada (hot score) e "precisa de atenção".
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Flame } from "lucide-react";
import { EmptyState, SectionHeader } from "@/components/techhire/ui";
import { formatCurrency, formatDate } from "@/lib/crm";
import { cn } from "@/lib/utils";
import type { DealListItem } from "@/lib/deals/sales-dashboard.types";

function DealRow({ deal, showHot }: { deal: DealListItem; showHot?: boolean }) {
  return (
    <li>
      <Link
        to="/deals/$id"
        params={{ id: deal.id }}
        className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary group-hover:underline">
            {deal.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-secondary">
            {deal.stageColor ? (
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: deal.stageColor }}
              />
            ) : null}
            <span className="truncate">
              {deal.stageLabel}
              {deal.companyName ? ` · ${deal.companyName}` : ""}
              {deal.ownerName ? ` · ${deal.ownerName}` : ""}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-sm font-medium tabular-nums text-text-primary">
            {formatCurrency(deal.value)}
          </span>
          {showHot ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-text-tertiary">
              <Flame className="h-3 w-3" aria-hidden />
              {Math.round(deal.hotScore)}
            </span>
          ) : deal.risk === "overdue_close" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
              <CalendarClock className="h-3 w-3" aria-hidden />
              Fechamento vencido
              {deal.expectedCloseDate ? ` (${formatDate(deal.expectedCloseDate)})` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-status-onhold">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Sem atividade há 7+ dias
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function Panel({
  title,
  description,
  deals,
  showHot,
  emptyTitle,
  emptyDescription,
  className,
}: {
  title: string;
  description: string;
  deals: DealListItem[];
  showHot?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-1 p-4",
        className,
      )}
    >
      <SectionHeader title={title} description={description} />
      <div className="mt-3">
        {deals.length === 0 ? (
          <EmptyState compact title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className="flex flex-col">
            {deals.map((d) => (
              <DealRow key={d.id} deal={d} showHot={showHot} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function AdvancedDealsPanel({ deals }: { deals: DealListItem[] }) {
  return (
    <Panel
      title="Fase avançada"
      description="Negócios com 60%+ de probabilidade, ordenados por hot score."
      deals={deals}
      showHot
      emptyTitle="Nenhum negócio em fase avançada"
      emptyDescription="Quando negócios atingirem etapas com 60% ou mais de probabilidade, eles aparecem aqui."
    />
  );
}

export function AttentionDealsPanel({ deals }: { deals: DealListItem[] }) {
  return (
    <Panel
      title="Precisa de atenção"
      description="Fechamento previsto vencido ou sem atividade recente."
      deals={deals}
      emptyTitle="Tudo em dia"
      emptyDescription="Nenhum negócio aberto com fechamento vencido ou parado há mais de 7 dias."
    />
  );
}
