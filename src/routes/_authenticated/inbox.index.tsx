import { createFileRoute } from "@tanstack/react-router";
import { UnifiedInboxPage } from "@/components/inbox/unified-inbox-page";

export const Route = createFileRoute("/_authenticated/inbox/")({
  head: () => ({
    meta: [
      { title: "Inbox unificada — TechERP" },
      {
        name: "description",
        content: "Email, WhatsApp e atendimento do workspace em uma única central.",
      },
      { property: "og:title", content: "Inbox unificada — TechERP" },
      {
        property: "og:description",
        content: "Email, WhatsApp e atendimento do workspace em uma única central.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <UnifiedInboxPage />,
});
