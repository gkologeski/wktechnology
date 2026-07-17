import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
      <EmptyState
        icon={FileText}
        title="Módulo Contratos"
        description="Fundação criada. A interface de listagem e criação será entregue na próxima sprint."
      />
    </div>
  );
}
