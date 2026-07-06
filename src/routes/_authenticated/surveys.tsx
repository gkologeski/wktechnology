import { createFileRoute } from "@tanstack/react-router";
import { SurveysPage } from "./settings.surveys";

// Alias no contexto CRM/TechSales para a mesma página de pesquisas que
// vive em /settings/surveys. Ver comentário em forms.tsx.
export const Route = createFileRoute("/_authenticated/surveys")({
  component: SurveysPage,
});
