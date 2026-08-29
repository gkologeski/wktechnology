import { createFileRoute } from "@tanstack/react-router";
import { ScoringPage } from "@/components/prospecting/pages/scoring-page";

// Configuração renderizada dentro do shell de Configurações (sem salto para /prospecting).
export const Route = createFileRoute("/_authenticated/settings/scoring")({
  component: ScoringPage,
});
