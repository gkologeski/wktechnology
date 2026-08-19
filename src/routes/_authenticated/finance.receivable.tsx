import { createFileRoute } from "@tanstack/react-router";
import { EntriesListPage } from "@/components/finance/entries-list-page";

export const Route = createFileRoute("/_authenticated/finance/receivable")({
  validateSearch: (search: Record<string, unknown>): { view?: "table" | "kanban" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
  }),

  head: () => ({
    meta: [
      { title: "Contas a receber" },
      { name: "description", content: "Lançamentos a receber com filtros e baixa de pagamento." },
    ],
  }),
  component: () => (
    <EntriesListPage
      direction="receivable"
      title="Contas a receber"
      description="Faturas, mensalidades e marcos billáveis a receber."
    />
  ),
});
