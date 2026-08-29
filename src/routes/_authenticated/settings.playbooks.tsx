import { createFileRoute } from "@tanstack/react-router";
import { PlaybooksPage } from "@/components/prospecting/pages/playbooks-page";

// Configuração renderizada dentro do shell de Configurações (sem salto para /prospecting).
export const Route = createFileRoute("/_authenticated/settings/playbooks")({
  component: PlaybooksPage,
});
