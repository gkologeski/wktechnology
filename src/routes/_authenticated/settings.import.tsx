import { createFileRoute } from "@tanstack/react-router";
import { ImportHubPage } from "@/components/integrations/pages/import-hub-page";

export const Route = createFileRoute("/_authenticated/settings/import")({
  head: () => ({ meta: [{ title: "Importar dados" }] }),
  component: ImportHubPage,
});
