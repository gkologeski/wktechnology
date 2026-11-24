import { createFileRoute } from "@tanstack/react-router";
import { LegalEntitiesPage } from "@/components/finance/legal-entities-page";
import { HrScreenAccess } from "@/components/hr-access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SettingsLegalEntitiesScreen() {
  const { edit } = Route.useSearch();
  return (
    <HrScreenAccess resources={["techfinance.legal_entities"]}>
      <LegalEntitiesPage {...(edit ? { editId: edit } : {})} />
    </HrScreenAccess>
  );
}

export const Route = createFileRoute("/_authenticated/settings/legal-entities")({
  validateSearch: (search: Record<string, unknown>): { edit?: string } => {
    const raw = typeof search["edit"] === "string" ? search["edit"].trim() : "";
    return UUID_RE.test(raw) ? { edit: raw } : {};
  },
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
  component: SettingsLegalEntitiesScreen,
});
