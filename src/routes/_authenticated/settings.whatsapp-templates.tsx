import { createFileRoute } from "@tanstack/react-router";
import { MetaTemplatesPage } from "@/components/whatsapp/meta-template-center";

export const Route = createFileRoute("/_authenticated/settings/whatsapp-templates")({
  head: () => ({ meta: [{ title: "Modelos de mensagens Meta | TechERP" }] }),
  component: () => <MetaTemplatesPage />,
});
