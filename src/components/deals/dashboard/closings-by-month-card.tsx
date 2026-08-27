// Fechamentos por mês (ganhos/perdidos + conversão) — mantido do painel anterior.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/techhire/ui";
import { LazyChart } from "@/components/charts/lazy-chart";
import { formatCurrency } from "@/lib/crm";
import { getDealClosingsByMonth } from "@/lib/deals/closings.functions";

const compactBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
    currency: "BRL",
  }).format(Number(v) || 0);

export function ClosingsByMonthCard() {
  const [metric, setMetric] = useState<"count" | "value">("count");
  const fetchSeries = useServerFn(getDealClosingsByMonth);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["deals", "closings-by-month"],
    queryFn: () => fetchSeries({ data: { months: 12 } }),
    staleTime: 5 * 60_000,
  });

  const rows = (data ?? []).map((r) => ({
    label: r.label,
    month: r.month,
    won: metric === "count" ? r.wonCount : r.wonValue,
    lost: metric === "count" ? r.lostCount : r.lostValue,
    rate: r.conversionRate,
  }));
  const hasData = rows.some((r) => r.won > 0 || r.lost > 0);

  const monthRange = (month: string) => {
    const d = new Date(month);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const iso = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    return { closedFrom: iso(d), closedTo: iso(end) };
  };

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <SectionHeader
        title="Fechamentos por mês"
        description="Ganhos e perdidos pela data real de fechamento (últimos 12 meses)."
        action={
          <div className="flex gap-1" role="group" aria-label="Métrica do gráfico">
            <Button
              type="button"
              size="sm"
              variant={metric === "count" ? "default" : "outline"}
              aria-pressed={metric === "count"}
              onClick={() => setMetric("count")}
            >
              Quantidade
            </Button>
            <Button
              type="button"
              size="sm"
              variant={metric === "value" ? "default" : "outline"}
              aria-pressed={metric === "value"}
              onClick={() => setMetric("value")}
            >
              Valor
            </Button>
          </div>
        }
      />
      <div className="mt-3 h-72">
        {isLoading ? (
          <div className="h-full space-y-3" aria-busy="true">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-[220px] w-full" />
          </div>
        ) : isError ? (
          <div className="grid h-full place-items-center text-center">
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                Não foi possível carregar os fechamentos.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : !hasData ? (
          <div className="grid h-full place-items-center">
            <p className="text-sm text-text-secondary">
              Nenhum negócio fechado nos últimos 12 meses.
            </p>
          </div>
        ) : (
          <LazyChart>
            {({
              ResponsiveContainer,
              ComposedChart,
              CartesianGrid,
              XAxis,
              YAxis,
              Tooltip,
              Legend,
              Bar,
              Line,
            }) => (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                  <XAxis dataKey="label" stroke="var(--color-text-tertiary)" fontSize={11} />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--color-text-tertiary)"
                    fontSize={12}
                    width={metric === "value" ? 72 : 36}
                    allowDecimals={false}
                    tickFormatter={(v: number) => (metric === "value" ? compactBRL(v) : String(v))}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--color-text-tertiary)"
                    fontSize={12}
                    width={44}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      name === "Conversão"
                        ? [`${Number(v).toFixed(1)}%`, name]
                        : [metric === "value" ? formatCurrency(v) : String(v), name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="won"
                    name="Ganhos"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(p: { payload?: { month?: string } }) => {
                      const month = p?.payload?.month;
                      if (month) {
                        const q = monthRange(month);
                        window.location.assign(
                          `/deals?closedFrom=${q.closedFrom}&closedTo=${q.closedTo}`,
                        );
                      }
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="lost"
                    name="Perdidos"
                    fill="var(--color-destructive)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="rate"
                    name="Conversão"
                    stroke="var(--color-text-tertiary)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </LazyChart>
        )}
      </div>
    </section>
  );
}
