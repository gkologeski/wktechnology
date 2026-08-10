import { createFileRoute } from "@tanstack/react-router";
import { SurveysPage } from "@/components/surveys/surveys-page";

export const Route = createFileRoute("/_authenticated/settings/surveys")({
  component: SurveysPage,
});
