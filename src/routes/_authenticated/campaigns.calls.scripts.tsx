import { createFileRoute } from "@tanstack/react-router";
import { ScriptsPage } from "@/components/prospecting/pages/scripts-page";

export const Route = createFileRoute("/_authenticated/campaigns/calls/scripts")({
  head: () => ({ meta: [{ title: "Roteiros de ligação — Campanhas de Ligação" }] }),
  component: CallScriptsPage,
});

function CallScriptsPage() {
  return <ScriptsPage />;
}
