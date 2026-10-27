import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SdrConsoleTabs, SdrStudioSide } from "@/components/prospecting/sdr-console";
import { SdrStudioAgentBar } from "@/components/prospecting/sdr-studio-agent-bar";
import { SdrNewAgentButton } from "@/components/prospecting/sdr-agent-actions";
import { useSdrPlaybooks } from "@/hooks/use-default-sdr-agent";
import { PageHeader } from "@/components/techhire/ui";
import { SdrWorkspaceNav } from "@/components/prospecting/sdr-workspace-nav";
import {
  SdrEnrollmentsPanel,
  SdrOperationSummary,
} from "@/components/prospecting/sdr-operation-panels";
import {
  parseEnrollmentFilter,
  type EnrollmentFilter,
} from "@/components/prospecting/sdr-operation-display";
import {
  DEFAULT_SDR_SECTION,
  hasStudioTestSide,
  isWorkspaceWideSection,
  parseSdrAgent,
  parseSdrSection,
  resolveStudioAgent,
  viewOfSection,
  type SdrSectionId,
} from "@/components/prospecting/sdr-workspace-sections";

export const Route = createFileRoute("/_authenticated/agents/sdr")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { section?: SdrSectionId; agent?: string; status?: EnrollmentFilter } => ({
    section: parseSdrSection(search.section),
    agent: parseSdrAgent(search.agent),
    status: parseEnrollmentFilter(search.status),
  }),
  component: SdrAgentPage,
  head: () => ({
    meta: [
      { title: "Agente SDR | TechERP" },
      {
        name: "description",
        content: "Opere, configure e acompanhe os resultados do agente SDR do TechSales.",
      },
      { property: "og:title", content: "Agente SDR | TechERP" },
      {
        property: "og:description",
        content: "Opere, configure e acompanhe os resultados do agente SDR do TechSales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SdrAgentPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const section: SdrSectionId = search.section ?? DEFAULT_SDR_SECTION;
  const view = viewOfSection(section);
  const goTo = (next: SdrSectionId) =>
    navigate({ search: (prev) => ({ ...prev, section: next }), replace: true, resetScroll: false });
  const qc = useQueryClient();
  const playbooks = useSdrPlaybooks();
  const agents = (playbooks.data?.items ?? []) as unknown as Array<{
    id: string;
    name: string;
    enabled: boolean;
    questionnaire_id: string | null;
  }>;
  const defaultAgentId = playbooks.defaultPlaybookId;
  const agentId = resolveStudioAgent(agents, search.agent, defaultAgentId);
  const selectAgent = (id: string | null) =>
    navigate({
      search: (prev) => ({ ...prev, agent: id ?? undefined }),
      replace: true,
      resetScroll: false,
    });
  // Agente recém-criado abre direto na Configuração do agente.
  const openCreated = async (id: string) => {
    await qc.invalidateQueries({ queryKey: ["sdr-playbooks"] });
    navigate({
      search: (prev) => ({ ...prev, agent: id, section: "sdr-agent-config" }),
      replace: true,
      resetScroll: false,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="TechSales · Agentes de IA"
        title="Agente SDR"
        description="Acompanhe as conversas na Operação, ajuste o agente no Estúdio e veja o retorno em Resultados."
        primaryAction={<SdrNewAgentButton onCreated={openCreated} />}
      />

      <Tabs value={section} onValueChange={(v) => goTo(parseSdrSection(v) ?? DEFAULT_SDR_SECTION)}>
        <SdrWorkspaceNav section={section} />
        {view.id === "operation" ? <SdrOperationSummary /> : null}
        {view.id === "studio" ? (
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Cada agente tem uma <strong className="text-foreground">persona</strong> (identidade e
            tom, versionada) e uma <strong className="text-foreground">configuração</strong>{" "}
            (situação, roteiro, qualificação, agenda, número de WhatsApp e passagem para humano).
            Público, disparos, cadência e limites são da{" "}
            <strong className="text-foreground">campanha</strong>, que escolhe qual agente responde.
          </p>
        ) : null}
        {view.id === "studio" ? (
          <SdrStudioAgentBar
            agents={agents}
            agentId={agentId}
            defaultAgentId={defaultAgentId}
            creating={false}
            workspaceWide={isWorkspaceWideSection(section)}
            loading={playbooks.isLoading}
            onSelect={selectAgent}
          />
        ) : null}
        <div
          className={
            hasStudioTestSide(section)
              ? "grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)] xl:items-start"
              : undefined
          }
        >
          <div className="min-w-0">
            <SdrConsoleTabs agentId={view.id === "studio" ? agentId : undefined} />

            <TabsContent value="enrollments" className="mt-4">
              <SdrEnrollmentsPanel
                status={search.status}
                onStatusChange={(next) =>
                  navigate({
                    search: (prev) => ({ ...prev, status: next }),
                    replace: true,
                    resetScroll: false,
                  })
                }
              />
            </TabsContent>
          </div>
          {hasStudioTestSide(section) && agentId ? (
            <div className="mt-4 min-w-0 xl:sticky xl:top-4">
              <SdrStudioSide agentId={agentId} />
            </div>
          ) : null}
        </div>
      </Tabs>
    </div>
  );
}
