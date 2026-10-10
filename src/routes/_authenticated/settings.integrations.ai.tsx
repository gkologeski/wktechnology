import { createFileRoute } from "@tanstack/react-router";
import { AiProviderPage } from "@/components/integrations/pages/ai-provider-page";

export const Route = createFileRoute("/_authenticated/settings/integrations/ai")({
  head: () => ({
    meta: [
      { title: "Inteligência Artificial — Integrações" },
      {
        name: "description",
        content:
          "Escolha o provedor de IA do workspace: Lovable AI, OpenAI, Anthropic, Google, xAI, DeepSeek ou OpenRouter.",
      },
      { property: "og:title", content: "Inteligência Artificial — Integrações" },
      { property: "og:description", content: "Configure qual IA atende os recursos do workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiProviderPage,
});
