import { createFileRoute } from "@tanstack/react-router";
import { PreparationScreen } from "@/lib/hiring/requests/preparation-screen";
export const Route = createFileRoute("/_authenticated/contracts/supplier-requests")({
  head: () => ({
    meta: [
      { title: "Contratação de fornecedores · TechContracts" },
      {
        name: "description",
        content: "Preparação de compras WK com fornecedor canônico e histórico.",
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
  component: () => <PreparationScreen kind="supplier" />,
});
