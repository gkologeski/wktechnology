/**
 * Suíte de Prospecção — shell com abas.
 *
 * Concentra Fila, Questionários, Cadências, Scoring, Playbooks, Enrichment,
 * Scripts e Voice Agent em uma única página. As abas são exibidas somente
 * para usuários com a permission_key correspondente. Owners/admins do
 * workspace recebem todas as chaves automaticamente via
 * `user_effective_permissions`; para os demais, o administrador libera em
 * Configurações → Controle de acesso → Permissões.
 */
import { useEffect, useMemo, type ComponentType } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { AtsPageHeader } from "@/components/ats/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { QueueTab } from "@/components/prospecting/queue-tab";
import { NurturingTab } from "@/components/prospecting/nurturing-tab";

import { QuestionnairesTab } from "@/components/prospecting/questionnaires-tab";
import { CadencesTab } from "@/components/prospecting/cadences-tab";
import { ScoringPage } from "@/components/prospecting/pages/scoring-page";
import { PlaybooksPage } from "@/components/prospecting/pages/playbooks-page";
import { EnrichmentHistoryPage } from "@/components/prospecting/pages/enrichment-history-page";
import { ProspectingPage } from "@/components/prospecting/pages/prospecting-page";
import { ScriptsPage } from "@/components/prospecting/pages/scripts-page";
import { VoiceAgentPage } from "@/components/prospecting/pages/voice-agent-page";

const TAB_VALUES = [
  "fila",
  "nutricao",
  "questionarios",
  "cadencias",
  "scoring",
  "playbooks",
  "enrichment",
  "prospecting",
  "scripts",
  "voice",
] as const;

type TabValue = (typeof TAB_VALUES)[number];

const searchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional(),
});

type TabDef = {
  value: TabValue;
  label: string;
  permission: string;
  Component: ComponentType;
};

const TABS: readonly TabDef[] = [
  {
    value: "fila",
    label: "Fila",
    permission: "techsales.prospecting.queue.view",
    Component: QueueTab,
  },
  {
    value: "nutricao",
    label: "Nutrição",
    permission: "techsales.prospecting.queue.view",
    Component: NurturingTab,
  },

  {
    value: "questionarios",
    label: "Questionários",
    permission: "techsales.prospecting.questionnaires.view",
    Component: QuestionnairesTab,
  },
  {
    value: "cadencias",
    label: "Cadências",
    permission: "techsales.prospecting.cadences.view",
    Component: CadencesTab,
  },
  {
    value: "scoring",
    label: "Scoring",
    permission: "techsales.prospecting.scoring.view",
    Component: ScoringPage,
  },
  {
    value: "playbooks",
    label: "Playbooks",
    permission: "techsales.prospecting.playbooks.view",
    Component: PlaybooksPage,
  },
  {
    value: "enrichment",
    label: "Enrichment",
    permission: "techsales.prospecting.enrichment.view",
    Component: EnrichmentHistoryPage,
  },
  {
    value: "prospecting",
    label: "Busca de prospects",
    permission: "techsales.prospecting.search.view",
    Component: ProspectingPage,
  },
  {
    value: "scripts",
    label: "Scripts",
    permission: "techsales.prospecting.scripts.view",
    Component: ScriptsPage,
  },
  {
    value: "voice",
    label: "Voice Agent",
    permission: "techsales.prospecting.voice.view",
    Component: VoiceAgentPage,
  },
];

export const PROSPECTING_TAB_PERMISSIONS = TABS.map((t) => t.permission);

export const Route = createFileRoute("/_authenticated/prospecting/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Prospecção — TechSales" },
      {
        name: "description",
        content:
          "Suíte de prospecção do TechSales: fila configurável, qualificação, cadências multi-canal, scoring e voice agent em um único lugar.",
      },
      { property: "og:title", content: "Prospecção — TechSales" },
      {
        property: "og:description",
        content: "Fila, qualificação e cadências para SDR/BDR em um único lugar.",
      },
    ],
  }),
  component: ProspectingSuite,
});

function ProspectingSuite() {
  const search = useSearch({ from: "/_authenticated/prospecting/" });
  const navigate = useNavigate({ from: "/prospecting" });
  const { can, isLoading, isError, error, refetch } = usePermissions();

  const visibleTabs = useMemo(
    () => (isLoading ? [] : TABS.filter((t) => can(t.permission))),
    [can, isLoading],
  );

  const requested = search.tab;
  const active: TabValue | undefined = useMemo(() => {
    if (visibleTabs.length === 0) return undefined;
    if (requested && visibleTabs.some((t) => t.value === requested)) return requested;
    return visibleTabs[0].value;
  }, [requested, visibleTabs]);

  // Normaliza a aba ativa quando a atual não é permitida ao usuário.
  useEffect(() => {
    if (isLoading) return;
    if (!active) return;
    if (requested === active) return;
    navigate({
      search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, tab: active }),
      replace: true,
    });
  }, [active, requested, isLoading, navigate]);

  return (
    <div className="p-6 space-y-6">
      <AtsPageHeader
        eyebrow="TechSales"
        title="Prospecção"
        description="Fila configurável, qualificação, cadências e ferramentas de sales engagement em um único lugar."
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ShieldOff className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Não foi possível carregar suas permissões</p>
              <p className="text-sm text-muted-foreground max-w-md">
                {error?.message ?? "Falha ao consultar o controle de acesso."} Isso não significa
                que você perdeu acesso — tente novamente.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : visibleTabs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ShieldOff className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Sem acesso à Prospecção</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Você não possui permissão para nenhuma aba desta área. Solicite ao administrador do
                workspace para liberar em Configurações → Controle de acesso → Permissões.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={active}
          onValueChange={(v) =>
            navigate({
              search: (prev: z.infer<typeof searchSchema>) => ({
                ...prev,
                tab: v as TabValue,
              }),
              replace: true,
            })
          }
        >
          <TabsList className="flex flex-wrap gap-1 h-auto">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.map((t) => {
            const C = t.Component;
            return (
              <TabsContent key={t.value} value={t.value} className="mt-6">
                <C />
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
