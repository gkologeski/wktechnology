import { createFileRoute } from "@tanstack/react-router";
import { AssistantModel } from "@/components/agents/prototypes/assistant-model";
export const Route = createFileRoute("/_authenticated/agents/prototype/2")({
  head: () => ({
    meta: [
      { title: "Assistente de criação de Agentes — TechERP" },
      {
        name: "description",
        content: "Proposta 2: Assistente de criação, com wizard, fluxo e histórico demonstrativos.",
      },
      { property: "og:title", content: "Assistente de criação de Agentes — TechERP" },
      {
        property: "og:description",
        content: "Experiência navegável Assistente de criação para aprovação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantModel,
});
