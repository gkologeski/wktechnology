import { createFileRoute } from "@tanstack/react-router";
import { ContractDetailPrototype } from "@/components/contracts/prototype/contract-detail-prototype";
import { WorkScreenAccess } from "@/components/work-access";

function PrototypeAccess() {
  return (
    <WorkScreenAccess resources={["techcontracts.contracts"]}>
      <ContractDetailPrototype />
    </WorkScreenAccess>
  );
}

export const Route = createFileRoute("/_authenticated/contracts/prototype")({
  head: () => ({
    meta: [
      { title: "Protótipo — Ficha do contrato TechContracts" },
      {
        name: "description",
        content: "Protótipo da ficha de contrato guiada por etapas e próximo passo.",
      },
      { property: "og:title", content: "Protótipo — Ficha do contrato" },
      {
        property: "og:description",
        content: "Ficha de contrato com etapas e próximo passo, com dados de exemplo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrototypeAccess,
});
