import { createFileRoute } from "@tanstack/react-router";
import { EntriesListPage } from "@/components/finance/entries-list-page";

export const Route = createFileRoute("/_authenticated/finance/payable")({
  validateSearch: (search: Record<string, unknown>): { view?: "table" | "kanban" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
  }),

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
