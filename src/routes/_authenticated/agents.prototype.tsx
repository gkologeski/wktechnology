import { createFileRoute } from "@tanstack/react-router";
import { AgentsPrototype } from "@/components/agents/agents-prototype";

export const Route = createFileRoute("/_authenticated/agents/prototype")({
  head: () => ({
    meta: [
      { title: "Protótipo — Agentes de IA" },
      {
        name: "description",
        content: "Esboço navegável da central de agentes de IA para aprovação.",
      },
      { property: "og:title", content: "Protótipo — Agentes de IA" },
      { property: "og:description", content: "Esboço navegável da central de agentes de IA." },
    ],
  }),
  component: AgentsPrototype,
});
