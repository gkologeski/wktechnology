import { createFileRoute, redirect } from "@tanstack/react-router";
import { ScriptsPage } from "@/components/prospecting/pages/scripts-page";

export const Route = createFileRoute("/_authenticated/settings/prospecting-scripts")({
  beforeLoad: () => {
    throw redirect({ to: "/campaigns/calls/scripts" });
  },
  component: LegacyScriptsRedirect,
});

// Só por segurança: o beforeLoad sempre redireciona para Campanhas de Ligação › Roteiros.
function LegacyScriptsRedirect() {
  return <ScriptsPage />;
}
