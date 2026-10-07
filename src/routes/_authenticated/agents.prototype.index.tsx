import { createFileRoute } from "@tanstack/react-router";
import { PrototypeComparison } from "@/components/agents/prototypes/comparison";
export const Route = createFileRoute("/_authenticated/agents/prototype/")({
  head: () => ({
    meta: [
      { title: "Modelos de Agentes de IA — TechERP" },
      {
        name: "description",
        content: "Compare Estúdio, Assistente de criação e Central de operação.",
      },
      { property: "og:title", content: "Modelos de Agentes de IA — TechERP" },
      {
        property: "og:description",
        content: "Três experiências navegáveis de agentes para aprovação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrototypeComparison,
});
