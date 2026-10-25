import { WorkRecordAccess } from "@/components/work-access";
import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";
// Medições e rentabilidade do projeto. Medições são preparadas no contrato; aqui aparecem as que
// incluem o projeto ou o serviço dele. Valores e custos respeitam as permissões do banco.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { MeasurementsPanel } from "@/components/projects/billing/measurements-panel";
import { ProfitabilityPanel } from "@/components/projects/billing/profitability-panel";

export const Route = createFileRoute("/_authenticated/projects_/$id/financeiro")({
  head: () => ({
    meta: [
      { title: "Medições e rentabilidade do projeto — TechProjects" },
      {
        name: "description",
        content:
          "Medições por competência, receitas separadas por situação, custo estimado e real e margem do projeto.",
      },
      { property: "og:title", content: "Medições e rentabilidade do projeto — TechProjects" },
      {
        property: "og:description",
        content:
          "Medições por competência, receitas separadas por situação, custo estimado e real e margem do projeto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Order3RouteAccess,
});

function ProjectFinancePage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Medições e rentabilidade"
        description="O que foi medido, aprovado, lançado e recebido, com custo e margem só onde há cobertura."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/projects/$id" params={{ id }}>
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Voltar ao projeto
            </Link>
          </Button>
        }
      />
      <Order3ScreenAccess resources={["techprojects.profitability"]}>
        <ProfitabilityPanel projectId={id} />
      </Order3ScreenAccess>
      <Order3ScreenAccess resources={["techprojects.measurements"]}>
        <MeasurementsPanel projectId={id} />
      </Order3ScreenAccess>
    </div>
  );
}

const Order3Page = ProjectFinancePage;
function Order3RouteAccess() {
  const { id } = Route.useParams();
  return (
    <WorkRecordAccess resource="techprojects.projects" id={id}>
      <Order3ScreenAccess resources={["techprojects.profitability", "techprojects.measurements"]}>
        <Order3Page />
      </Order3ScreenAccess>
    </WorkRecordAccess>
  );
}
