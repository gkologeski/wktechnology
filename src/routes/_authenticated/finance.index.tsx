import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({
    meta: [
      { title: "Financeiro" },
      { name: "description", content: "Contas a receber e a pagar unificadas." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Financeiro" description="Lançamentos a receber e a pagar, categorias e conciliação." />
      <EmptyState
        icon={DollarSign}
        title="Módulo Financeiro"
        description="Fundação criada. A interface será entregue nas próximas sprints."
      />
    </div>
  );
}
