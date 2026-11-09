import { HrScreenAccess } from "@/components/hr-access";
import { createFileRoute } from "@tanstack/react-router";
import { LegalEntitiesPage } from "@/components/finance/legal-entities-page";

export const Route = createFileRoute("/_authenticated/finance/legal-entities")({
  head: () => ({
    meta: [
      { title: "Empresas financeiras e CNPJs | TechFinance" },
      {
        name: "description",
        content: "Consulte empresas, lançamentos e vínculos financeiros por CNPJ.",
      },
      { property: "og:title", content: "Empresas financeiras e CNPJs | TechFinance" },
      {
        property: "og:description",
        content: "Gerencie empresas financeiras preservando lançamentos e históricos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <HrScreenAccess resources={["techfinance.legal_entities"]}>
      <LegalEntitiesPage />
    </HrScreenAccess>
  ),
});
