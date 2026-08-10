import { createFileRoute } from "@tanstack/react-router";
import { FormsPage } from "@/components/forms/forms-page";

export const Route = createFileRoute("/_authenticated/settings/forms")({
  component: FormsPage,
});
