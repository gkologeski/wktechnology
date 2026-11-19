import { createFileRoute } from "@tanstack/react-router";
import { PreparationScreen } from "@/lib/hiring/requests/preparation-screen";
export const Route = createFileRoute("/_authenticated/people/hiring-requests")({
  head: () => ({
    meta: [
      { title: "Solicitações de contratação · TechPeople" },
      {
        name: "description",
        content: "Preparação de contratação de profissionais com revisão e histórico.",
      },
      { property: "og:title", content: "Solicitações de contratação · TechPeople" },
      {
        property: "og:description",
        content: "Solicitações de profissionais, sem aprovação ou execução automática.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <PreparationScreen kind="professional" />,
});
