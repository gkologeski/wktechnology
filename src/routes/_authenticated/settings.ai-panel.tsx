import { createFileRoute } from "@tanstack/react-router";
import { AiPanelPage } from "@/components/ai/ai-panel-page";

export const Route = createFileRoute("/_authenticated/settings/ai-panel")({
  head: () => ({
    meta: [
      { title: "Painel de IA — Configurações" },
      {
        name: "description",
        content:
          "Modelo de IA em uso, custo estimado por chamada e histórico de gatilhos do workspace.",
      },
      { property: "og:title", content: "Painel de IA — Configurações" },
      {
        property: "og:description",
        content: "Acompanhe uso, custo e histórico das chamadas de IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiPanelPage,
});
