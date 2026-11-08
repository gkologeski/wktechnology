import { createFileRoute } from "@tanstack/react-router";
import { ContractDraftApproversPage } from "@/components/contracts/contract-draft-approvers-page";

export const Route = createFileRoute("/_authenticated/settings/contract-draft-approvers")({
  head: () => ({ meta: [{ title: "Fluxos de aprovação — Minuta de contrato" }] }),
  component: ApproversRoute,
});

function ApproversRoute() {
  return <ContractDraftApproversPage />;
}
