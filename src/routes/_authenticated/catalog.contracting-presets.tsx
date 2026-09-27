// /catalog/contracting-presets — Central unificada "Presets e Cargos".
// Reúne, em abas sincronizadas com a URL (?tab=presets | ?tab=cargos):
//  - Presets de contratação: pacotes comerciais prontos (serviço + cargo +
//    senioridade + stack + valores) usados em cotações, negócios e contratos;
//  - Cargos e perfis: a base genérica de funções da empresa.
// A rota antiga /catalog/job-profiles redireciona para a aba de cargos.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { BriefcaseBusiness, Layers, Percent, Wrench } from "lucide-react";

import { MetricCard } from "@/components/techhire/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractingPresetsPanel, marginPercent } from "@/components/catalog/contracting-presets-panel";
import { JobProfilesPanel } from "@/components/catalog/job-profiles-panel";
import { listContractingPresets } from "@/lib/contracting-presets.functions";

type TabKey = "presets" | "cargos";

export const Route = createFileRoute("/_authenticated/catalog/contracting-presets")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabKey } => {
    const tab = search["tab"];
    return tab === "cargos" || tab === "presets" ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: "Presets e cargos de contratação" },
      {
        name: "description",
        content:
          "Pacotes de contratação por tecnologia e perfil, junto da base de cargos que alimenta serviço, senioridade e valores nos contratos.",
      },
      { property: "og:title", content: "Presets e cargos de contratação" },
      {
        property: "og:description",
        content: "Pacotes prontos de contratação e a base de cargos da empresa em uma única tela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PresetsAndProfilesPage,
});

type PresetRow = {
  id: string;
  job_profile_id: string | null;
  service_catalog_id: string | null;
  default_unit_price: number;
  default_unit_cost: number;
  active: boolean;
};

function PresetsAndProfilesPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab: TabKey = tab ?? "presets";

  const list = useServerFn(listContractingPresets);
  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["contracting_presets"],
    queryFn: () => list({ data: {} }) as Promise<PresetRow[]>,
  });

  const kpis = useMemo(() => {
    const active = presets.filter((p) => p.active);
    const margins = active
      .map((p) => marginPercent(Number(p.default_unit_price), Number(p.default_unit_cost)))
      .filter((m): m is number => m !== null);
    const avgMargin =
      margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
    const services = new Set(active.map((p) => p.service_catalog_id).filter(Boolean));
    const profiles = new Set(active.map((p) => p.job_profile_id).filter(Boolean));
    return {
      activeCount: active.length,
      avgMargin,
      serviceCount: services.size,
      profileCount: profiles.size,
    };
  }, [presets]);

  const presetCountByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of presets) {
      if (!p.job_profile_id) continue;
      map.set(p.job_profile_id, (map.get(p.job_profile_id) ?? 0) + 1);
    }
    return map;
  }, [presets]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Presets e cargos</h1>
          <p className="text-sm text-muted-foreground">
            Os presets preenchem linha de serviço, cargo, senioridade, stack e valores nas cotações,
            negócios e contratos. Os cargos são a base de funções que alimenta esses pacotes.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Presets ativos"
          value={kpis.activeCount}
          icon={Layers}
          loading={isLoading}
        />
        <MetricCard
          label="Margem média estimada"
          value={kpis.avgMargin === null ? "—" : `${kpis.avgMargin.toFixed(0)}%`}
          hint="Considera presets com preço e custo informados"
          icon={Percent}
          tone={kpis.avgMargin !== null && kpis.avgMargin >= 30 ? "positive" : "neutral"}
          loading={isLoading}
        />
        <MetricCard
          label="Cargos usados em presets"
          value={kpis.profileCount}
          icon={BriefcaseBusiness}
          loading={isLoading}
        />
        <MetricCard
          label="Linhas de serviço cobertas"
          value={kpis.serviceCount}
          icon={Wrench}
          loading={isLoading}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => navigate({ search: { tab: v as TabKey }, replace: true })}
      >
        <TabsList>
          <TabsTrigger value="presets">Presets de contratação</TabsTrigger>
          <TabsTrigger value="cargos">Cargos e funções</TabsTrigger>
        </TabsList>
        <TabsContent value="presets" className="mt-4">
          <ContractingPresetsPanel />
        </TabsContent>
        <TabsContent value="cargos" className="mt-4">
          <JobProfilesPanel presetCountByProfile={presetCountByProfile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
