import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/contracts/")({
  head: () => ({
    meta: [
      { title: "Contratos" },
      { name: "description", content: "Gestão do ciclo de vida de contratos." },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Contratos" description="Ciclo de vida de contratos com clientes e fornecedores." />
      <div className="rounded-lg border bg-card p-12 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Módulo Contratos</h3><p className="mt-2 text-sm text-muted-foreground">Fundação criada. A interface de listagem e criação será entregue na próxima sprint.</p></div>
    </div>
  );
}
