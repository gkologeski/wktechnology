import { createFileRoute, redirect } from "@tanstack/react-router";
import { ContractDraftApproversPage } from "@/components/contracts/contract-draft-approvers-page";

// Preserve existing bookmarks and notification links without rendering Settings.
export const Route = createFileRoute("/_authenticated/settings/contract-draft-approvers")({
  beforeLoad: () => {
    throw redirect({ to: "/contracts/contracting-flow", replace: true });
  },
  component: () => <ContractDraftApproversPage />,
});
