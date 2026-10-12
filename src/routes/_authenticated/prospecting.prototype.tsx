import { createFileRoute } from "@tanstack/react-router";
import { ProspectingPrototype } from "@/components/prospecting/prototype/prospecting-prototype";

export const Route = createFileRoute("/_authenticated/prospecting/prototype")({
  head: () => ({
    meta: [
      { title: "Protótipo — Prospecção TechSales" },
      {
        name: "description",
        content: "Protótipo navegável da nova central de Prospecção para aprovação visual.",
      },
      { property: "og:title", content: "Protótipo — Prospecção TechSales" },
      {
        property: "og:description",
        content: "Central de Prospecção em cinco áreas, com dados de exemplo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProspectingPrototype,
});
