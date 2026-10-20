// Central de qualidade e conciliação das importações de horas (TechProjects).
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/techhire/ui";
import { ReconOverviewTab } from "./recon-overview-tab";
import { ReconBreakdownTab } from "./recon-breakdown-tab";
import { ReconIssuesTab } from "./recon-issues-tab";
import { ReconLinksTab } from "./recon-links-tab";

export type ReconSearch = {
  tab?: "overview" | "breakdown" | "issues" | "links";
  from?: string;
  to?: string;
};

export function ReconciliationPage({
  search,
  onSearch,
}: {
  search: ReconSearch;
  onSearch: (next: Partial<ReconSearch>) => void;
}) {
  const tab = search.tab ?? "overview";
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="TechProjects · Configurações · Importações"
        title="Conciliação de horas"
        description="O que foi coletado do Clockify e do Jibble, o que virou apontamento, o que está em revisão e os vínculos com empresas e pessoas. Nada aqui altera a origem."
      />
      <Tabs value={tab} onValueChange={(v) => onSearch({ tab: v as ReconSearch["tab"] })}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Cobertura</TabsTrigger>
          <TabsTrigger value="breakdown">Conferência</TabsTrigger>
          <TabsTrigger value="issues">Pendências</TabsTrigger>
          <TabsTrigger value="links">Vínculos</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <ReconOverviewTab onOpenIssues={() => onSearch({ tab: "issues" })} />
        </TabsContent>
        <TabsContent value="breakdown" className="mt-4">
          <ReconBreakdownTab
            from={search.from}
            to={search.to}
            onPeriod={(from, to) => onSearch({ from, to })}
          />
        </TabsContent>
        <TabsContent value="issues" className="mt-4">
          <ReconIssuesTab
            from={search.from}
            to={search.to}
            onPeriod={(from, to) => onSearch({ from, to })}
          />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <ReconLinksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
