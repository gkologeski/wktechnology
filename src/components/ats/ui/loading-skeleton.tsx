import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-sunken", className)} />;
}

export function MetricSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-2 px-4 py-4 shadow-xs",
        className,
      )}
    >
      <Bar className="h-3 w-24" />
      <Bar className="mt-3 h-7 w-20" />
      <Bar className="mt-2 h-3 w-32" />
    </div>
  );
}

export function MetricsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <MetricSkeleton key={i} />
      ))}
    </div>
  );
}

export function CardSkeleton({ className, lines = 4 }: { className?: string; lines?: number }) {
  return (
    <div
      className={cn("rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs", className)}
    >
      <Bar className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bar className="h-3 w-32" />
            <Bar className="h-2 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      <Bar className="h-8 w-8 rounded-full" />
      <Bar className="h-3 flex-1" />
      <Bar className="h-3 w-16" />
    </div>
  );
}

export const Skeletons = {
  Metric: MetricSkeleton,
  MetricsGrid: MetricsGridSkeleton,
  Card: CardSkeleton,
  Row: RowSkeleton,
};

/**
 * Esqueleto de página de listagem exibido durante a troca de tela, enquanto o
 * código da próxima tela ainda está chegando. Reproduz cabeçalho, abas,
 * barra de filtros e linhas da grade para que a estrutura apareça na hora.
 */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Carregando tela">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Bar className="h-6 w-48" />
          <Bar className="h-3 w-24" />
        </div>
        <div className="flex gap-2">
          <Bar className="h-9 w-28" />
          <Bar className="h-9 w-32" />
        </div>
      </div>
      <div className="flex gap-2 border-b border-border-subtle pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-7 w-24" />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Bar className="h-9 w-64" />
        <Bar className="h-9 w-28" />
        <Bar className="h-9 w-28" />
      </div>
      <div className="rounded-lg border border-border-subtle bg-surface-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0"
          >
            <Bar className="h-4 w-4" />
            <Bar className="h-7 w-7 rounded-full" />
            <Bar className="h-4 w-48" />
            <Bar className="hidden h-4 w-32 md:block" />
            <Bar className="hidden h-4 w-24 lg:block" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
