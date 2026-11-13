import { createFileRoute } from "@tanstack/react-router";
import { UnifiedInboxPage } from "@/components/inbox/unified-inbox-page";

export const Route = createFileRoute("/_authenticated/inbox/ligacoes")({
  head: () => ({
    meta: [
      { title: "Ligações — Inbox — TechERP" },
      { name: "description", content: "Ligações das campanhas com resumo, áudio e transcrição." },
      { property: "og:title", content: "Ligações — Inbox — TechERP" },
      {
        property: "og:description",
        content: "Ligações das campanhas com resumo, áudio e transcrição.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CallsInboxPage,
});

function CallsInboxPage() {
  return <UnifiedInboxPage initialChannel="call" lockChannel />;
}
