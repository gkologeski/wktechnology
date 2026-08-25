// Wave 8 — Slice 3: Painel "Saúde do funil" (Quiet Premium)
// Mostra conversão stage→stage, dwell time, gargalo destacado e recomendações IA.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, AlertTriangle, Activity, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzePipelineHealth } from "@/lib/ats/pipeline-insights.functions";
import { AtsSectionHeader, EmptyState, Skeletons } from "@/components/ats/ui";
import { cn } from "@/lib/utils";

type Result = Awaited<ReturnType<typeof analyzePipelineHealth>>;

export function PipelineInsightsPanel({ jobId }: { jobId?: string }) {
  const fn = useServerFn(analyzePipelineHealth);
  const [windowDays, setWindowDays] = useState<30 | 60 | 90 | 180>(90);
  const [enabled, setEnabled] = useState(false);

  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["pipeline-insights", jobId ?? "all", windowDays],
    queryFn: () => fn({ data: { job_id: jobId, window_days: windowDays } }) as Promise<Result>,
    enabled,
    staleTime: 60_000,
  });

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-1 shadow-xs">
      <header className="px-5 py-4 border-b border-border-subtle flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Activity className="size-4 text-text-tertiary" aria-hidden="true" />
            Saúde do funil
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Conversão, dwell time e gargalos analisados pela IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(windowDays)}
            onValueChange={(v) => setWindowDays(Number(v) as 30 | 60 | 90 | 180)}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => {
              setEnabled(true);
              void refetch();
            }}
            disabled={isFetching}
            className="h-8"
          >
            {isFetching ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="size-3 mr-1" />
            )}
            Analisar
          </Button>
        </div>
      </header>

      <div className="p-5 space-y-5">
        {!enabled && (
          <EmptyState
            compact
            icon={Sparkles}
            title="Pronto para analisar"
            description="A IA usa apenas as métricas do seu funil. Nenhum dado sai sem você pedir."
          />
        )}

        {enabled && error && (
          <EmptyState
            compact
            icon={AlertTriangle}
            title="Falha ao analisar"
            description={error instanceof Error ? error.message : "Erro desconhecido"}
            action={
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            }
          />
        )}

        {enabled && isFetching && !data && <Skeletons.Card lines={6} />}

        {enabled && data && data.totals.applications === 0 && (
          <EmptyState
            compact
            icon={Activity}
            title="Sem candidaturas no período"
            description="Selecione um período maior ou aguarde novos candidatos."
          />
        )}

        {enabled && data && data.totals.applications > 0 && (
          <>
            {data.ai.headline && (
              <p className="text-sm text-text-primary leading-relaxed">{data.ai.headline}</p>
            )}

            <div className="grid grid-cols-3 gap-3 text-sm">
              <Kpi label="Aplicações" value={data.totals.applications} />
              <Kpi label="Contratados" value={data.totals.hired} />
              <Kpi label="Tempo médio" value={`${data.totals.avg_days_to_close}d`} />
            </div>

            <div>
              <AtsSectionHeader
                title="Por etapa"
                description="Entradas, conversão para a próxima, tempo médio."
              />
              <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-text-tertiary">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Etapa</th>
                      <th className="text-right font-medium px-3 py-2">Ativos</th>
                      <th className="text-right font-medium px-3 py-2">Passaram</th>
                      <th className="text-right font-medium px-3 py-2">Conv. próx.</th>
                      <th className="text-right font-medium px-3 py-2">Dwell</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {data.stages.map((s) => {
                      const isBottleneck = s.stage === data.bottleneck_stage;
                      return (
                        <tr key={s.stage} className={cn(isBottleneck && "bg-warning-soft/30")}>
                          <td className="px-3 py-2 text-text-primary">
                            <span className="inline-flex items-center gap-1.5">
                              {s.label}
                              {isBottleneck && (
                                <AlertTriangle
                                  className="size-3 text-warning"
                                  aria-label="Gargalo identificado"
                                />
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                            {s.active}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                            {s.entered}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                            {s.entered > 0 ? `${s.conversionToNext}%` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                            {s.avgDwellDays > 0 ? `${s.avgDwellDays}d` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {data.ai.bottlenecks.length > 0 && (
              <div>
                <AtsSectionHeader title="Gargalos" />
                <ul className="mt-2 space-y-2">
                  {data.ai.bottlenecks.map((b, i) => {
                    const label = data.stages.find((s) => s.stage === b.stage)?.label ?? b.stage;
                    return (
                      <li
                        key={i}
                        className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-1.5 font-medium text-text-primary">
                          <AlertTriangle className="size-3.5 text-warning" aria-hidden="true" />
                          {label}
                        </div>
                        <p className="text-text-secondary mt-0.5">{b.reason}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {data.ai.recommendations.length > 0 && (
              <div>
                <AtsSectionHeader title="Recomendações" />
                <ul className="mt-2 space-y-1.5">
                  {data.ai.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <Lightbulb
                        className="size-3.5 text-text-tertiary mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums text-text-primary mt-0.5">{value}</div>
    </div>
  );
}
