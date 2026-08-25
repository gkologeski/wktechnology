// Hunting — overview hub. Captura ativa de candidatos via extensão LinkedIn.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ArrowRight, Mail, Download, Inbox, Sparkles, Activity } from "lucide-react";
import { AtsPageHeader, MetricCard, MetricsGridSkeleton } from "@/components/ats/ui";
import { Card, CardContent } from "@/components/ui/card";
import { listHuntingStats } from "@/lib/ats/hunting.functions";

export const Route = createFileRoute("/_authenticated/(ats)/hunting/")({
  component: HuntingHub,
});

const TILES = [
  {
    to: "/hunting/search",
    icon: Search,
    title: "Buscar no LinkedIn",
    description:
      "Pesquisa via Unipile com throttling humano. Selecione perfis e importe direto pro ATS.",
  },
  {
    to: "/hunting/captures",
    icon: Inbox,
    title: "Capturados",
    description: "Candidatos trazidos do LinkedIn — pronto pra mover pra vaga ou pool.",
  },
  {
    to: "/hunting/observability",
    icon: Activity,
    title: "Execuções & métricas",
    description: "Budgets diários, latência, taxa de sucesso e log de chamadas Unipile.",
  },
  {
    to: "/hunting/templates",
    icon: Mail,
    title: "Templates de mensagem",
    description: "InMail, pedido de conexão e mensagem direta com variáveis personalizadas.",
  },
  {
    to: "/hunting/install",
    icon: Download,
    title: "Instalar extensão (legado)",
    description: "Extensão Chrome descontinuada — use a busca via Unipile.",
  },
] as const;

function HuntingHub() {
  const fetchStats = useServerFn(listHuntingStats);
  const stats = useQuery({
    queryKey: ["hunting-stats"],
    queryFn: () => fetchStats(),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AtsPageHeader
        eyebrow="ATS · Hunting"
        title="Hunting LinkedIn"
        description="Prospecção ativa: você navega no LinkedIn, a extensão captura. TechHire organiza o resto."
      />

      {stats.isLoading ? (
        <MetricsGridSkeleton count={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Capturados hoje" value={stats.data?.today ?? 0} icon={Sparkles} />
          <MetricCard label="Últimos 7 dias" value={stats.data?.last_7_days ?? 0} icon={Search} />
          <MetricCard label="Total no banco" value={stats.data?.total ?? 0} icon={Inbox} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <t.icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold tracking-tight">{t.title}</h3>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
