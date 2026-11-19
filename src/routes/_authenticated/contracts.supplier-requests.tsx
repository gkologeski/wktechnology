import { createFileRoute } from "@tanstack/react-router";
import { PreparationScreen } from "@/lib/hiring/requests/preparation-screen";
import { z } from "zod";
export const Route = createFileRoute("/_authenticated/contracts/supplier-requests")({
  validateSearch: z.object({ request: z.string().uuid().optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Contratação de fornecedores · TechContracts" },
      {
        name: "description",
        content: "Compras WK com fornecedor canônico, histórico e aprovações revisionadas.",
      },
      { property: "og:title", content: "Contratação de fornecedores · TechContracts" },
      {
        property: "og:description",
        content: "Solicitações de fornecedores, sem formalização ou execução automática.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierRequests,
});
function SupplierRequests() {
  const { request } = Route.useSearch();
  return <PreparationScreen kind="supplier" requestId={request} />;
}
