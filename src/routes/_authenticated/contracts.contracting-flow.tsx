import { createFileRoute } from "@tanstack/react-router";
import { ContractDraftApproversPage } from "@/components/contracts/contract-draft-approvers-page";

export const Route = createFileRoute("/_authenticated/contracts/contracting-flow")({
  head: () => ({ meta: [{ title: "Fluxo de contratação — TechContracts" }] }),
  component: () => <ContractDraftApproversPage />,
});
