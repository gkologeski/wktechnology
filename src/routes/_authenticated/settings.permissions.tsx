// /settings/permissions — Área unificada de Gestão de Permissões.
// Matriz Cargo × Recurso × Ação × Escopo aplicada a todos os módulos PSA.
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/techhire/ui";
import { PermissionsMatrix } from "@/components/access-control/permissions-matrix";

export const Route = createFileRoute("/_authenticated/settings/permissions")({
  head: () => ({
    meta: [
      { title: "Permissões — TechERP" },
      { name: "description", content: "Gestão unificada de cargos e permissões por módulo." },
      { property: "og:title", content: "Permissões — TechERP" },
      {
        property: "og:description",
        content: "Gestão unificada de cargos e permissões por módulo.",
      },
    ],
  }),
  component: PermissionsPage,
});

function PermissionsPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        eyebrow="Controle de acesso"
        title="Permissões"
        description="Configure quem pode ver, criar, editar e gerenciar recursos em cada módulo (TechSales, TechHire, TechPeople, TechContracts, TechService, TechFinance e TechProjects)."
      />
      <PermissionsMatrix />
    </div>
  );
}
