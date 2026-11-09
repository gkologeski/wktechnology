import { createFileRoute } from "@tanstack/react-router";
import { LegalEntitiesPage } from "@/components/finance/legal-entities-page";

export const Route = createFileRoute("/_authenticated/settings/legal-entities")({
  head: () => ({
    meta: [
      { title: "Empresas e CNPJs do workspace | TechERP" },
      {
        name: "description",
        content:
          "Cadastre, edite e desative empresas do workspace preservando registros e históricos.",
      },
      { property: "og:title", content: "Empresas e CNPJs do workspace | TechERP" },
      {
        property: "og:description",
        content: "Gerencie os CNPJs e os vínculos dos registros do workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalEntitiesPage,
});
