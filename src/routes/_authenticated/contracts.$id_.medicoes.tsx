import { WorkRecordAccess } from "@/components/work-access";
import { HrScreenAccess as Order3ScreenAccess } from "@/components/hr-access";
// Medições do contrato: modelo de cobrança versionado, competências medidas e rentabilidade agregada.
// O título no Financeiro só nasce por ação explícita após aprovação; nada é emitido ou enviado ao cliente.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BillingConfigCard } from "@/components/projects/billing/billing-config-card";
import { MeasurementsPanel } from "@/components/projects/billing/measurements-panel";
import { ProfitabilityPanel } from "@/components/projects/billing/profitability-panel";

export const Route = createFileRoute("/_authenticated/contracts/$id_/medicoes")({
  head: () => ({
    meta: [
      { title: "Medições do contrato — TechContracts" },
      {
        name: "description",
        content:
          "Modelo de cobrança, medições mensais, geração no Financeiro e rentabilidade do contrato.",
      },
      { property: "og:title", content: "Medições do contrato — TechContracts" },
      {
        property: "og:description",
        content:
          "Modelo de cobrança, medições mensais, geração no Financeiro e rentabilidade do contrato.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Order3RouteAccess,
});

function ContractMeasurementsPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Medições do contrato"
        description="Configure como o contrato é medido, prepare cada competência, aprove e gere o título interno no Financeiro."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/contracts/$id" params={{ id }}>
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Voltar ao contrato
            </Link>
          </Button>
        }
      />
      <Order3ScreenAccess resources={["techprojects.billing_config"]}>
        <BillingConfigCard contractId={id} />
      </Order3ScreenAccess>
      <Order3ScreenAccess resources={["techprojects.measurements"]}>
        <MeasurementsPanel contractId={id} />
      </Order3ScreenAccess>
      <Order3ScreenAccess resources={["techprojects.profitability"]}>
        <ProfitabilityPanel contractId={id} />
      </Order3ScreenAccess>
    </div>
  );
}

const Order3Page = ContractMeasurementsPage;
function Order3RouteAccess() {
  const { id } = Route.useParams();
  return (
    <WorkRecordAccess resource="techcontracts.contracts" id={id}>
      <Order3ScreenAccess
        resources={[
          "techprojects.billing_config",
          "techprojects.measurements",
          "techprojects.profitability",
        ]}
      >
        <Order3Page />
      </Order3ScreenAccess>
    </WorkRecordAccess>
  );
}
