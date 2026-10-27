import { createFileRoute } from "@tanstack/react-router";
import { WhatsAppConfiguration } from "@/components/service-channels/whatsapp-configuration";
export const Route = createFileRoute("/_authenticated/settings/whatsapp")({
  head: () => ({
    meta: [
      { title: "Conexão do WhatsApp | TechERP" },
      {
        name: "description",
        content: "Gerencie o número do WhatsApp Business conectado ao TechERP.",
      },
      { property: "og:title", content: "Conexão do WhatsApp | TechERP" },
      {
        property: "og:description",
        content: "Painel de conexão do WhatsApp Business usado para enviar e receber mensagens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppSettings,
});
function WhatsAppSettings() {
  return <WhatsAppConfiguration />;
}
