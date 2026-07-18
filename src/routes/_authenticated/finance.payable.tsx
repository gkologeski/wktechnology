import { createFileRoute } from "@tanstack/react-router";
import { EntriesListPage } from "@/components/finance/entries-list-page";

export const Route = createFileRoute("/_authenticated/finance/payable")({
  head: () => ({
    meta: [
      { title: "Contas a pagar" },
      { name: "description", content: "Lançamentos a pagar, categorias e baixa de pagamentos." },
    ],
  }),
  component: () => (
    <EntriesListPage
      direction="payable"
      title="Contas a pagar"
      description="Despesas, fornecedores e contratos de compra em aberto."
    />
  ),
});
