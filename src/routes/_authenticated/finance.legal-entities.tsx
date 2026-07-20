import { createFileRoute } from "@tanstack/react-router";
import { LegalEntitiesPage } from "@/components/finance/legal-entities-page";

export const Route = createFileRoute("/_authenticated/finance/legal-entities")({
  head: () => ({ meta: [{ title: "Empresas (CNPJs)" }] }),
  component: LegalEntitiesPage,
});
