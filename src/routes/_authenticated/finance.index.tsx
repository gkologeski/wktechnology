import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";

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
      <div className="rounded-lg border bg-card p-12 text-center"><DollarSign className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Módulo Financeiro</h3><p className="mt-2 text-sm text-muted-foreground">Fundação criada. A interface será entregue nas próximas sprints.</p></div>
    </div>
  );
}
