/**
 * Prospecção (TechSales) — cinco áreas: Visão geral, Meu trabalho, Campanhas,
 * Públicos e Resultados. Cada área/seção é carregada sob demanda e exibida
 * somente com a permission_key correspondente (o servidor revalida).
 * Links antigos `?tab=` são convertidos por `LEGACY_TAB_MAP`.
 */
import { lazy, Suspense, useEffect, useMemo, type ComponentType } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { ShieldOff } from "lucide-react";
import { PageHeader, EmptyState, ListPageSkeleton } from "@/components/techhire/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  AREA_SECTIONS,
  AREA_VALUES,
  LEGACY_TAB_MAP,
  LEGACY_TAB_VALUES,
  SECTION_VALUES,
  resolveSection,
  type Area,
  type Section,
} from "@/lib/prospecting/areas";

const L = <K extends string>(p: () => Promise<Record<K, ComponentType>>, k: K) =>
  lazy(() => p().then((m) => ({ default: m[k] })));

const OverviewArea = L(
  () => import("@/components/prospecting/areas/overview-area"),
  "OverviewArea",
);
const ResultsArea = L(() => import("@/components/prospecting/areas/results-area"), "ResultsArea");
const CampaignsHub = L(
  () => import("@/components/prospecting/areas/campaigns-hub"),
  "CampaignsHub",
);

const SECTIONS: Record<Section, { label: string; permission: string; Component: ComponentType }> = {
  fila: {
    label: "Filas",
    permission: "techsales.prospecting_queue.view.workspace",
    Component: L(() => import("@/components/prospecting/queue-tab"), "QueueTab"),
  },
  nutricao: {
    label: "Nutrição",
    permission: "techsales.prospecting_queue.view.workspace",
    Component: L(() => import("@/components/prospecting/nurturing-tab"), "NurturingTab"),
  },
  qualificacao: {
    label: "Qualificação e pontuação",
    permission: "techsales.prospecting_scoring.view.workspace",
    Component: L(() => import("@/components/prospecting/pages/scoring-page"), "ScoringPage"),
  },
  cadencias: {
    label: "Cadências",
    permission: "techsales.prospecting_cadences.view.workspace",
    Component: L(() => import("@/components/prospecting/cadences-tab"), "CadencesTab"),
  },
  roteiros: {
    label: "Roteiros de ligação",
    permission: "techsales.prospecting_scripts.view.workspace",
    Component: L(() => import("@/components/prospecting/pages/scripts-page"), "ScriptsPage"),
  },
  questionarios: {
    label: "Questionários comerciais",
    permission: "techsales.prospecting_questionnaires.view.workspace",
    Component: L(() => import("@/components/prospecting/questionnaires-tab"), "QuestionnairesTab"),
  },
  playbooks: {
    label: "Roteiros de descoberta",
    permission: "techsales.prospecting_playbooks.view.workspace",
    Component: L(() => import("@/components/prospecting/pages/playbooks-page"), "PlaybooksPage"),
  },
  base: {
    label: "Base interna",
    permission: "techsales.prospecting_search.view.workspace",
    Component: L(() => import("@/components/prospecting/base-tab"), "BaseTab"),
  },
  apollo: {
    label: "Busca de prospects (Apollo)",
    permission: "techsales.prospecting_search.view.workspace",
    Component: L(
      () => import("@/components/prospecting/pages/prospecting-page"),
      "ProspectingPage",
    ),
  },
  enriquecimento: {
    label: "Enriquecimento",
    permission: "techsales.prospecting_enrichment.view.workspace",
    Component: L(
      () => import("@/components/prospecting/pages/enrichment-history-page"),
      "EnrichmentHistoryPage",
    ),
  },
};

const AREAS: Record<Area, { label: string; description: string }> = {
  visao: {
    label: "Visão geral",
    description: "Pendências, respostas, qualificados, reuniões e falhas.",
  },
  trabalho: { label: "Meu trabalho", description: "Filas, próxima ação, nutrição e qualificação." },
  campanhas: {
    label: "Campanhas",
    description: "Voz, WhatsApp, cadências e roteiros usados na abordagem.",
  },
  publicos: { label: "Públicos", description: "Base interna, busca Apollo e enriquecimento." },
  resultados: { label: "Resultados", description: "Por campanha, canal e agente, com origem." },
};

/** Áreas sem seções exigem ao menos uma permissão de leitura da Prospecção. */
const AREA_BASE_PERMS = [
  "techsales.prospecting_queue.view.workspace",
  "techsales.prospecting_cadences.view.workspace",
  "techsales.prospecting_voice.view.workspace",
  "techsales.marketing.sdr_agent.view.workspace",
  "techsales.marketing.campaigns.view.workspace",
];

const searchSchema = z.object({
  area: z.enum(AREA_VALUES).optional().catch(undefined),
  section: z.enum(SECTION_VALUES).optional().catch(undefined),
  tab: z.enum(LEGACY_TAB_VALUES).optional().catch(undefined),
});
type Search = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_authenticated/prospecting/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Prospecção — TechSales | TechERP" },
      {
        name: "description",
        content:
          "Central operacional de prospecção do TechSales: trabalho diário, campanhas, públicos e resultados com dados reais.",
      },
      { property: "og:title", content: "Prospecção — TechSales | TechERP" },
      {
        property: "og:description",
        content: "Trabalho diário, campanhas, públicos e resultados da prospecção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProspectingSuite,
});

function ProspectingSuite() {
  const search = useSearch({ from: "/_authenticated/prospecting/" });
  const navigate = useNavigate({ from: "/prospecting" });
  const { can, isLoading, isError, error, refetch } = usePermissions();

  // Compatibilidade com links antigos ?tab=
  useEffect(() => {
    if (!search.tab) return;
    const t = LEGACY_TAB_MAP[search.tab];
    if (t.kind === "route") navigate({ to: t.to, replace: true });
    else navigate({ search: { area: t.area, section: t.section }, replace: true });
  }, [search.tab, navigate]);

  const allowedSection = (s: Section) => !isLoading && can(SECTIONS[s].permission);
  const areaVisible = (a: Area) =>
    AREA_SECTIONS[a].length
      ? AREA_SECTIONS[a].some(allowedSection) || (a === "campanhas" && AREA_BASE_PERMS.some(can))
      : AREA_BASE_PERMS.some(can);
  const visibleAreas = useMemo(
    () => (isLoading ? [] : AREA_VALUES.filter(areaVisible)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, can],
  );
  const area: Area | undefined =
    search.area && visibleAreas.includes(search.area) ? search.area : visibleAreas[0];
  const section = area ? resolveSection(area, search.section, allowedSection) : undefined;

  const go = (next: Search) => navigate({ search: next, replace: true });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        eyebrow="TechSales"
        title="Prospecção"
        description="Central operacional da prospecção: trabalho do dia, campanhas, públicos e resultados."
      />
      {isLoading || search.tab ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={ShieldOff}
          title="Não foi possível carregar suas permissões"
          description={`${error?.message ?? "Falha ao consultar o controle de acesso."} Isso não significa que você perdeu acesso.`}
          action={
            <Button variant="outline" size="sm" onClick={refetch}>
              Tentar novamente
            </Button>
          }
        />
      ) : !area ? (
        <EmptyState
          icon={ShieldOff}
          title="Sem acesso à Prospecção"
          description="Solicite ao administrador do workspace em Configurações → Controle de acesso → Permissões."
        />
      ) : (
        <Tabs value={area} onValueChange={(v) => go({ area: v as Area })}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            {visibleAreas.map((a) => (
              <TabsTrigger key={a} value={a} className="shrink-0">
                {AREAS[a].label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={area} className="mt-6 space-y-6">
            <p className="text-sm text-muted-foreground">{AREAS[area].description}</p>
            <Suspense fallback={<ListPageSkeleton />}>
              {area === "visao" && <OverviewArea />}
              {area === "resultados" && <ResultsArea />}
              {area === "campanhas" && <CampaignsHub />}
              {AREA_SECTIONS[area].length > 0 && section && (
                <Tabs value={section} onValueChange={(v) => go({ area, section: v as Section })}>
                  <TabsList
                    className="h-auto justify-start overflow-x-auto"
                    aria-label={`Seções de ${AREAS[area].label}`}
                  >
                    {AREA_SECTIONS[area].filter(allowedSection).map((s) => (
                      <TabsTrigger key={s} value={s} className="shrink-0">
                        {SECTIONS[s].label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value={section} className="mt-4">
                    <SectionBody section={section} />
                  </TabsContent>
                </Tabs>
              )}
            </Suspense>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SectionBody({ section }: { section: Section }) {
  const C = SECTIONS[section].Component;
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <C />
    </Suspense>
  );
}
