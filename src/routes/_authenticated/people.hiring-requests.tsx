import { createFileRoute } from "@tanstack/react-router";
import { PreparationScreen } from "@/lib/hiring/requests/preparation-screen";
import { z } from "zod";
export const Route = createFileRoute("/_authenticated/people/hiring-requests")({
  validateSearch: z.object({
    request: z.string().uuid().optional().catch(undefined),
    fiscalDocumentId: z.string().uuid().optional().catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Solicitações de contratação · TechPeople" },
      {
        name: "description",
        content: "Solicitações de profissionais com preparação e aprovações revisionadas.",
      },
      { property: "og:title", content: "Solicitações de contratação · TechPeople" },
      {
        property: "og:description",
        content: "Preparação e decisões do gestor e CEO, sem execução automática.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfessionalRequests,
});
function ProfessionalRequests() {
  const { request, fiscalDocumentId } = Route.useSearch();
  return (
    <PreparationScreen
      kind="professional"
      requestId={request}
      fiscalDocumentId={fiscalDocumentId}
    />
  );
}
