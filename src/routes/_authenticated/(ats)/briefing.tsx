// Wave 8 — Slice 5: Página de Daily Briefing IA.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertTriangle, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  SectionHeader,
  MetricCard,
  EmptyState,
  Skeletons,
} from "@/components/techhire/ui";
import { generateDailyBriefing, getLatestBriefing } from "@/lib/ats/daily-briefing.functions";

export const Route = createFileRoute("/_authenticated/(ats)/briefing")({
  component: BriefingPage,
});

type Item = { title?: string; why?: string; action?: string };
type Briefing = {
  id: string;
  generated_at: string;
  headline: string | null;
  summary: string | null;
  priorities: Item[];
  risks: Item[];
  recommendations: Item[];
  metrics: Record<string, unknown> & {
    open_jobs?: number;
    apps_last_24h?: number;
    apps_last_7d?: number;
    stale_applications?: number;
    upcoming_interviews_7d?: number;
    open_offers?: number;
  };
};

function BriefingPage() {
  const getLatest = useServerFn(getLatestBriefing);
  const generate = useServerFn(generateDailyBriefing);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ats", "daily-briefing", "latest"],
    queryFn: () => getLatest() as Promise<Briefing | null>,
  });

  const mut = useMutation({
    mutationFn: () => generate() as Promise<Briefing>,
    onSuccess: () => {
      toast.success("Briefing gerado.");
      qc.invalidateQueries({ queryKey: ["ats", "daily-briefing", "latest"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar briefing"),
  });

  // Auto-generate na primeira visita se não existir nada ainda
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (!isLoading && !data && !autoTried && !mut.isPending) {
      setAutoTried(true);
      mut.mutate();
    }
  }, [isLoading, data, autoTried, mut]);

  const b = data ?? null;
  const m = b?.metrics ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inteligência (IA)"
        title="Briefing diário"
        description="Resumo gerado por IA com prioridades, riscos e recomendações do recrutamento, com base nas últimas 24h e 7 dias."
        primaryAction={
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} size="sm" className="h-9">
            {mut.isPending ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="size-3.5 mr-1.5" />
            )}
            Gerar novo briefing
          </Button>
        }
      />

      {isLoading ? (
        <Skeletons.MetricsGrid count={6} />
      ) : !b ? (
        <EmptyState
          icon={Lightbulb}
          title="Sem briefing ainda"
          description="Gere o primeiro briefing para ver prioridades e riscos."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Vagas abertas" value={String(m.open_jobs ?? 0)} />
            <MetricCard label="Aplicações 24h" value={String(m.apps_last_24h ?? 0)} />
            <MetricCard label="Aplicações 7d" value={String(m.apps_last_7d ?? 0)} />
            <MetricCard
              label="Stale (>14d)"
              value={String(m.stale_applications ?? 0)}
              tone={(m.stale_applications ?? 0) > 0 ? "warning" : "neutral"}
            />
            <MetricCard label="Entrevistas 7d" value={String(m.upcoming_interviews_7d ?? 0)} />
            <MetricCard label="Ofertas abertas" value={String(m.open_offers ?? 0)} />
          </div>

          <section className="bg-surface-1 rounded-xl border border-border-subtle shadow-xs p-5 space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
              Resumo
            </div>
            {b.headline && (
              <h2 className="text-base font-semibold text-text-primary">{b.headline}</h2>
            )}
            {b.summary && (
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{b.summary}</p>
            )}
            <p className="text-[11px] text-text-tertiary pt-1">
              Gerado em {new Date(b.generated_at).toLocaleString("pt-BR")}
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <ItemSection
              title="Prioridades"
              icon={Target}
              items={b.priorities}
              emptyLabel="Sem prioridades destacadas."
            />
            <ItemSection
              title="Riscos"
              icon={AlertTriangle}
              items={b.risks}
              emptyLabel="Sem riscos destacados."
              tone="warning"
            />
            <ItemSection
              title="Recomendações"
              icon={Lightbulb}
              items={b.recommendations}
              emptyLabel="Sem recomendações."
            />
          </div>
        </>
      )}
    </div>
  );
}

function ItemSection({
  title,
  icon: Icon,
  items,
  emptyLabel,
  tone = "default",
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Item[];
  emptyLabel: string;
  tone?: "default" | "warning";
}) {
  return (
    <section className="bg-surface-1 rounded-xl border border-border-subtle shadow-xs">
      <SectionHeader title={title} />
      <div className="p-4 space-y-2">
        {!items?.length ? (
          <p className="text-xs text-text-tertiary">{emptyLabel}</p>
        ) : (
          items.map((it, i) => (
            <div
              key={i}
              className={
                "rounded-lg border p-3 text-sm " +
                (tone === "warning"
                  ? "border-warning/40 bg-warning/10"
                  : "border-border-subtle bg-surface-2")
              }
            >
              <div className="flex items-start gap-2">
                <Icon className="size-3.5 mt-0.5 text-text-tertiary shrink-0" />
                <div className="space-y-0.5">
                  {it.title && <div className="font-medium text-text-primary">{it.title}</div>}
                  {(it.why || it.action) && (
                    <div className="text-text-secondary text-[13px]">{it.why || it.action}</div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
