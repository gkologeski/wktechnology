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
      <div className="rounded-lg border bg-card p-12 text-center"><Package className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Módulo Serviços</h3><p className="mt-2 text-sm text-muted-foreground">Fundação criada. A interface será entregue na próxima sprint.</p></div>
    </div>
  );
}
