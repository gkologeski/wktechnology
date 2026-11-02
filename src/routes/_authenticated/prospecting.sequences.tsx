import { createFileRoute } from "@tanstack/react-router";
import { ProspectingSequencesPage } from "@/components/prospecting/sequences/sequences-page";
export const Route = createFileRoute("/_authenticated/prospecting/sequences")({
  component: () => <ProspectingSequencesPage />,
});
