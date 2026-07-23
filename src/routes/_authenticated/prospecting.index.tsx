/**
 * Suíte de Prospecção — shell com abas.
 *
 * Concentra Fila, Questionários, Cadências, Scoring, Playbooks, Enrichment,
 * Scripts e Voice Agent em uma única página. As abas legadas reutilizam os
 * componentes das rotas antigas de /settings/* (mesmo comportamento).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { AtsPageHeader } from "@/components/ats/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QueueTab } from "@/components/prospecting/queue-tab";
import { QuestionnairesTab } from "@/components/prospecting/questionnaires-tab";
import { CadencesTab } from "@/components/prospecting/cadences-tab";
import { ScoringPage } from "./settings.scoring";
import { PlaybooksPage } from "./settings.playbooks";
import { EnrichmentHistoryPage } from "./settings.enrichment";
import { ProspectingPage } from "./settings.prospecting";
import { ScriptsPage } from "./settings.prospecting-scripts";
import { VoiceAgentPage } from "./settings.voice-agent";

const searchSchema = z.object({
  tab: z
    .enum([
      "fila",
      "questionarios",
      "cadencias",
      "scoring",
      "playbooks",
      "enrichment",
      "prospecting",
      "scripts",
      "voice",
    ])
    .optional(),
});

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
  const active = search.tab ?? "fila";

  return (
    <div className="p-6 space-y-6">
      <AtsPageHeader
        eyebrow="TechSales"
        title="Prospecção"
        description="Fila configurável, qualificação, cadências e ferramentas de sales engagement em um único lugar."
      />

      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({
            search: (prev) => ({ ...prev, tab: v as typeof active }),
            replace: true,
          })
        }
      >
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="fila">Fila</TabsTrigger>
          <TabsTrigger value="questionarios">Questionários</TabsTrigger>
          <TabsTrigger value="cadencias">Cadências</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
          <TabsTrigger value="enrichment">Enrichment</TabsTrigger>
          <TabsTrigger value="prospecting">Busca de prospects</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="voice">Voice Agent</TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="mt-6">
          <QueueTab />
        </TabsContent>
        <TabsContent value="questionarios" className="mt-6">
          <QuestionnairesTab />
        </TabsContent>
        <TabsContent value="cadencias" className="mt-6">
          <CadencesTab />
        </TabsContent>
        <TabsContent value="scoring" className="mt-6">
          <ScoringPage />
        </TabsContent>
        <TabsContent value="playbooks" className="mt-6">
          <PlaybooksPage />
        </TabsContent>
        <TabsContent value="enrichment" className="mt-6">
          <EnrichmentHistoryPage />
        </TabsContent>
        <TabsContent value="prospecting" className="mt-6">
          <ProspectingPage />
        </TabsContent>
        <TabsContent value="scripts" className="mt-6">
          <ScriptsPage />
        </TabsContent>
        <TabsContent value="voice" className="mt-6">
          <VoiceAgentPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
