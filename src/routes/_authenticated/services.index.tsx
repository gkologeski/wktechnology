import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";

import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/services/")({
  head: () => ({
    meta: [
      { title: "Serviços" },
      { name: "description", content: "Serviços contratados e prestados." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Serviços" description="Serviços vinculados a contratos, com cadência de faturamento e entrega." />
      <EmptyState
        icon={Package}
        title="Módulo Serviços"
        description="Fundação criada. A interface será entregue na próxima sprint."
      />
    </div>
  );
}
