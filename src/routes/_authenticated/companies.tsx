import { createFileRoute } from "@tanstack/react-router";
import { EntityList } from "@/components/entity-list";
import type { Company } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/companies")({
  component: CompaniesPage,
});

function CompaniesPage() {
  return (
    <EntityList<Company>
      table="companies"
      title="Empresas"
      description="Gerencie as empresas do seu CRM."
      searchKeys={["name", "domain", "industry"]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "domain", label: "Domínio" },
        { key: "industry", label: "Indústria" },
        { key: "phone", label: "Telefone" },
      ]}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "domain", label: "Domínio" },
        { name: "industry", label: "Indústria" },
        { name: "size", label: "Tamanho" },
        { name: "website", label: "Website" },
        { name: "phone", label: "Telefone", type: "tel" },
        { name: "address", label: "Endereço" },
        { name: "notes", label: "Notas", type: "textarea" },
      ]}
    />
  );
}
