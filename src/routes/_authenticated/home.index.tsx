// /home — Dashboard consolidado do ERP com KPIs por módulo, filtrado por período.
// A tela antiga (grid de módulos + atalhos) foi movida para /modules.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, ArrowRight } from "lucide-react";
import { DateRangePicker } from "@/components/date-range-picker";
import { getPresetRange, type DateRange } from "@/lib/date-presets";
import {
  getHomeDashboard,
  type HomeDashboardResponse,
  type ModuleSection,
} from "@/lib/home/dashboard.functions";
import { MODULES, type ModuleId } from "@/lib/modules/registry";
import {
  PageHeader,
  SectionHeader,
  MetricCard,
} from "@/components/techhire/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/home/")({
  component: ErpHomeDashboard,
});

const MODULE_TITLES: Record<string, { title: string; product: string; icon: React.ComponentType<{ className?: string }> }> = {
  crm: { title: "CRM", product: MODULES.crm.productName, icon: MODULES.crm.icon },
  ats: { title: "ATS", product: MODULES.ats.productName, icon: MODULES.ats.icon },
  contracts: { title: "Contratos", product: MODULES.contracts.productName, icon: MODULES.contracts.icon },
  projects: { title: "Projetos", product: MODULES.projects.productName, icon: MODULES.projects.icon },
  finance: { title: "Financeiro", product: MODULES.finance.productName, icon: MODULES.finance.icon },
  people: { title: "Pessoas", product: MODULES.people.productName, icon: MODULES.people.icon },
};

function ModuleKpiSection({ section }: { section: ModuleSection }) {
  const meta = MODULE_TITLES[section.moduleId];
  if (!meta) return null;
  const Icon = meta.icon;
  const def = (MODULES as Record<string, { defaultRoute: string } | undefined>)[section.moduleId];
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{meta.product}</div>
            <div className="text-xs text-muted-foreground">{meta.title}</div>
          </div>
        </div>
        {def ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={def.defaultRoute}>
              Abrir módulo
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {section.kpis.map((k) => (
          <MetricCard key={k.label} label={k.label} value={k.value} hint={k.hint} />
        ))}
      </div>
    </section>
  );
}

function ErpHomeDashboard() {
  const [range, setRange] = useState<DateRange>(() => getPresetRange("last30"));
  const fetchDashboard = useServerFn(getHomeDashboard);

  const query = useQuery<HomeDashboardResponse>({
    queryKey: ["home-dashboard", range.from.toISOString(), range.to.toISOString()],
    queryFn: () =>
      fetchDashboard({
        data: { from: range.from.toISOString(), to: range.to.toISOString() },
      }),
    staleTime: 30_000,
  });

  const sections = useMemo(() => query.data?.sections ?? [], [query.data]);

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description="Visão consolidada dos módulos contratados no período selecionado."
        primaryAction={
          <DateRangePicker value={range} onChange={setRange} align="end" />
        }
        secondaryActions={
          <Button variant="outline" asChild>
            <Link to="/modules">
              <Boxes className="mr-2 h-4 w-4" />
              Módulos
            </Link>
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Não foi possível carregar o dashboard agora.
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <SectionHeader
              title="Nenhum módulo ativo"
              description="Contrate ou ative um módulo para começar a ver métricas no dashboard."
            />
            <Button asChild>
              <Link to="/modules">Ver módulos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {sections.map((s) => (
            <ModuleKpiSection key={s.moduleId} section={s} />
          ))}
        </div>
      )}
    </div>
  );
}
