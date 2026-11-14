import { createFileRoute } from "@tanstack/react-router";
import { ForsignSettingsPage } from "@/components/integrations/forsign-settings-page";

export const Route = createFileRoute("/_authenticated/settings/integrations/forsign")({
  head: () => ({
    meta: [
      { title: "ForSign · Integrações" },
      {
        name: "description",
        content: "Configure o envio de contratos para assinatura no ForSign.",
      },
    ],
  }),
  component: () => <ForsignSettingsPage />,
});
