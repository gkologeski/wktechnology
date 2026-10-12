import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck, Clock, MessageSquareReply, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, MetricsGridSkeleton, SectionHeader } from "@/components/techhire/ui";
import { getProspectingOverview } from "@/lib/prospecting/overview.functions";
import { coverageHint, coverageValue } from "./coverage";

const ICONS = {
  due: Clock,
  drafts: MessageSquareReply,
  qualified: UserCheck,
  meetings: CalendarCheck,
} as const;

const LINKS: Record<string, { to: string; search?: Record<string, string>; label: string }> = {
  due: { to: "/prospecting", search: { area: "trabalho", section: "fila" }, label: "Abrir filas" },
  drafts: { to: "/agents/sdr", label: "Revisar no Agente SDR" },
  qualified: {
    to: "/prospecting",
    search: { area: "trabalho", section: "qualificacao" },
    label: "Ver qualificação",
  },
  meetings: { to: "/agents/sdr", label: "Supervisão do SDR" },
};

export function OverviewArea() {
  const fetchFn = useServerFn(getProspectingOverview);
  const q = useQuery({ queryKey: ["prospecting-overview"], queryFn: () => fetchFn() });

  if (q.isLoading) return <MetricsGridSkeleton />;
  if (q.isError)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar a visão geral"
        description={(q.error as Error).message}
        action={
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  const d = q.data!;
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader
          title="Pendências e resultados recentes"
          description={`Dados reais do workspace, últimos ${d.periodDays} dias quando indicado. "—" significa sem permissão ou fonte indisponível, nunca zero.`}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {d.metrics.map((m) => {
            const link = LINKS[m.key];
            return (
              <div key={m.key} className="flex flex-col gap-2">
                <MetricCard
                  label={m.label}
                  value={coverageValue(m.value, m.coverage)}
                  hint={coverageHint(m.origin, m.coverage, m.note)}
                  icon={ICONS[m.key as keyof typeof ICONS]}
                  tone={m.coverage === "ok" ? "neutral" : "warning"}
                />
                {link && m.coverage !== "no_access" && (
                  <Button asChild variant="link" size="sm" className="h-auto self-start p-0">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Link to={link.to as any} search={link.search as any}>
                      {link.label}
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-3">
        <SectionHeader
          title="Falhas de envio (30 dias)"
          description="Separadas por canal; cada número vem da sua própria origem."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {d.failures.map((m) => (
            <MetricCard
              key={m.key}
              label={m.label}
              value={coverageValue(m.value, m.coverage)}
              hint={coverageHint(m.origin, m.coverage, m.note)}
              icon={AlertTriangle}
              tone={m.value ? "negative" : "neutral"}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
