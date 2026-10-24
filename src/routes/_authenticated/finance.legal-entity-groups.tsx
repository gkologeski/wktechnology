import { HrScreenAccess } from "@/components/hr-access";
import { createFileRoute } from "@tanstack/react-router";
import { LegalEntityGroupsPage } from "@/components/finance/legal-entity-groups-page";

export const Route = createFileRoute("/_authenticated/finance/legal-entity-groups")({
  head: () => ({ meta: [{ title: "Grupos empresariais" }] }),
  component: () => (
    <HrScreenAccess resources={["techfinance.legal_entity_groups"]}>
      <LegalEntityGroupsPage />
    </HrScreenAccess>
  ),
});
