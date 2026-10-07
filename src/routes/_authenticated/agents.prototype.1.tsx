import { createFileRoute } from "@tanstack/react-router";
import { StudioModel } from "@/components/agents/prototypes/studio-model";
export const Route = createFileRoute("/_authenticated/agents/prototype/1")({
  head: () => ({
    meta: [
      { title: "Estúdio de Agentes — TechERP" },
      {
        name: "description",
        content: "Proposta 1: Estúdio, com wizard, fluxo e histórico demonstrativos.",
      },
      { property: "og:title", content: "Estúdio de Agentes — TechERP" },
      { property: "og:description", content: "Experiência navegável Estúdio para aprovação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioModel,
});
