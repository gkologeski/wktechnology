import { createFileRoute, Outlet } from "@tanstack/react-router";

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
  component: Outlet,
});
