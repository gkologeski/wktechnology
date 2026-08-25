// /home — Dashboard consolidado do ERP com KPIs por módulo, filtrado por período.
// A tela antiga (grid de módulos + atalhos) foi movida para /modules.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, ArrowRight, Download, FileText, FileSpreadsheet } from "lucide-react";
import { DateRangePicker } from "@/components/date-range-picker";
import { usePersistedDateRange } from "@/hooks/use-persisted-date-range";
import {
  getHomeDashboard,
  type HomeDashboardResponse,
  type ModuleKpi,
  type ModuleSection,
} from "@/lib/home/dashboard.functions";
import { exportDashboardCsv } from "@/lib/home/dashboard-export";
import { MODULES } from "@/lib/modules/registry";
import { PageHeader, SectionHeader, MetricCard } from "@/components/techhire/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/home/")({
  component: ErpHomeDashboard,
});

const MODULE_TITLES: Record<
  string,
  { title: string; product: string; icon: React.ComponentType<{ className?: string }> }
> = {
  crm: { title: "CRM", product: MODULES.crm.productName, icon: MODULES.crm.icon },
  ats: { title: "ATS", product: MODULES.ats.productName, icon: MODULES.ats.icon },
  contracts: {
    title: "Contratos",
    product: MODULES.contracts.productName,
    icon: MODULES.contracts.icon,
  },
  projects: {
    title: "Projetos",
    product: MODULES.projects.productName,
    icon: MODULES.projects.icon,
  },
  finance: {
    title: "Financeiro",
    product: MODULES.finance.productName,
    icon: MODULES.finance.icon,
  },
  people: { title: "Pessoas", product: MODULES.people.productName, icon: MODULES.people.icon },
};

// Mapeia (módulo, indicador) → rota de drill-down.
function drillDownFor(moduleId: string, label: string): string | null {
  const m: Record<string, Record<string, string>> = {
    crm: {
      "Leads criados": "/leads",
      "Negócios criados": "/deals",
      "Negócios ganhos": "/deals",
      "Pipeline aberto": "/deals",
    },
    ats: {
      Candidatos: "/ats/candidates",
      Aplicações: "/ats/applications",
      Entrevistas: "/ats/interviews",
      Ofertas: "/ats/offers",
    },
    contracts: {
      "Contratos criados": "/contracts",
      "Contratos ativos": "/contracts",
    },
    projects: {
      "Tarefas concluídas": "/projects",
      "Projetos ativos": "/projects",
    },
    finance: {
      "A receber (aberto)": "/finance/entries",
      "A pagar (aberto)": "/finance/entries",
      "Pagamentos no período": "/finance/entries",
    },
    people: {
      "Pessoas ativas": "/people",
      "Documentos vencendo": "/people",
    },
  };
  return m[moduleId]?.[label] ?? null;
}

function KpiTile({
  kpi,
  href,
  from,
  to,
}: {
  kpi: ModuleKpi;
  href: string | null;
  from: string;
  to: string;
}) {
  const card = <MetricCard label={kpi.label} value={kpi.value} hint={kpi.hint} />;
  if (!href) return card;
  const search = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return (
    <a
      href={`${href}${search}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform hover:-translate-y-0.5"
      aria-label={`Abrir detalhes de ${kpi.label}`}
    >
      {card}
    </a>
  );
}

function ModuleKpiSection({
  section,
  from,
  to,
}: {
  section: ModuleSection;
  from: string;
  to: string;
}) {
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
            <a
              href={`${def.defaultRoute}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
            >
              Abrir módulo
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {section.kpis.map((k) => (
          <KpiTile
            key={k.label}
            kpi={k}
            href={drillDownFor(section.moduleId, k.label)}
            from={from}
            to={to}
          />
        ))}
      </div>
    </section>
  );
}

function ErpHomeDashboard() {
  const { range, setRange } = usePersistedDateRange("home", "last30");
  const fetchDashboard = useServerFn(getHomeDashboard);

  const fromISO = range.from.toISOString();
  const toISO = range.to.toISOString();

  const query = useQuery<HomeDashboardResponse>({
    queryKey: ["home-dashboard", fromISO, toISO],
    queryFn: () => fetchDashboard({ data: { from: fromISO, to: toISO } }),
    staleTime: 30_000,
  });

  const sections = useMemo(() => query.data?.sections ?? [], [query.data]);

  const handleCsv = () => {
    if (query.data) exportDashboardCsv(query.data, range);
  };
  const handlePdf = () => {
    const url = `/home/print?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&autoprint=1`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description="Visão consolidada dos módulos contratados no período selecionado."
        primaryAction={
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={range}
              onChange={(r, preset) => setRange(r, preset)}
              align="end"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!query.data || sections.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCsv}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePdf}>
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
            <ModuleKpiSection key={s.moduleId} section={s} from={fromISO} to={toISO} />
          ))}
        </div>
      )}
    </div>
  );
}
