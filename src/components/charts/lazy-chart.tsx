import { Suspense, lazy, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { RechartsKit } from "./chart-kit";

export type { RechartsKit };

const ChartKitRenderer = lazy(() => import("./chart-kit"));

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-full w-full min-h-32", className)}
      role="status"
      aria-label="Carregando gráfico"
    >
      <Skeleton className="h-full w-full rounded-md" />
    </div>
  );
}

/**
 * Envolve um gráfico recharts em um limite de carregamento sob demanda.
 *
 * Uso:
 *   <LazyChart>{({ ResponsiveContainer, BarChart }) => (...)}</LazyChart>
 */
export function LazyChart({
  children,
  fallbackClassName,
}: {
  children: (kit: RechartsKit) => ReactNode;
  fallbackClassName?: string;
}) {
  return (
    <Suspense fallback={<ChartSkeleton className={fallbackClassName} />}>
      <ChartKitRenderer render={children} />
    </Suspense>
  );
}
