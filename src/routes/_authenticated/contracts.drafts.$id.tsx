import { createFileRoute } from "@tanstack/react-router";
import { ContractDraftReviewPage } from "@/components/contracts/contract-draft-review-page";

export const Route = createFileRoute("/_authenticated/contracts/drafts/$id")({
  head: () => ({ meta: [{ title: "Revisar minuta de contrato — TechContracts" }] }),
  component: DraftRoute,
});

function DraftRoute() {
  const { id } = Route.useParams();
  return <ContractDraftReviewPage id={id} />;
}
