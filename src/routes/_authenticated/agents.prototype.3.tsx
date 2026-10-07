import { createFileRoute } from "@tanstack/react-router";
import { OperationModel } from "@/components/agents/prototypes/operation-model";
export const Route = createFileRoute("/_authenticated/agents/prototype/3")({
  head: () => ({
    meta: [
      { title: "Central de operação de Agentes — TechERP" },
      {
        name: "description",
        content: "Proposta 3: Central de operação, com wizard, fluxo e histórico demonstrativos.",
      },
      { property: "og:title", content: "Central de operação de Agentes — TechERP" },
      {
        property: "og:description",
        content: "Experiência navegável Central de operação para aprovação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OperationModel,
});
