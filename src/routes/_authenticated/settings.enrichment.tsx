import { createFileRoute } from "@tanstack/react-router";
import { EnrichmentHistoryPage } from "@/components/prospecting/pages/enrichment-history-page";

// Configuração renderizada dentro do shell de Configurações (sem salto para /prospecting).
export const Route = createFileRoute("/_authenticated/settings/enrichment")({
  component: EnrichmentHistoryPage,
});
