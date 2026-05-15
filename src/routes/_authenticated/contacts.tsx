import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EntityList } from "@/components/entity-list";
import type { Contact, Company } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "select"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id,name").order("name");
      return (data ?? []) as Pick<Company, "id" | "name">[];
    },
  });

  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <EntityList<Contact>
      table="contacts"
      title="Contatos"
      description="Pessoas com quem você se relaciona."
      csvEnabled
      searchKeys={["first_name", "last_name", "email", "phone"]}
      columns={[
        { key: "first_name", label: "Nome", render: (r) => `${r.first_name} ${r.last_name ?? ""}`.trim() },
        { key: "email", label: "Email" },
        { key: "phone", label: "Telefone" },
        { key: "company_id", label: "Empresa", render: (r) => (r.company_id ? companyMap.get(r.company_id) ?? "—" : "—") },
        { key: "job_title", label: "Cargo" },
      ]}
      fields={[
        { name: "first_name", label: "Nome", required: true },
        { name: "last_name", label: "Sobrenome" },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Telefone", type: "tel" },
        { name: "job_title", label: "Cargo" },
        {
          name: "company_id", label: "Empresa", type: "select",
          options: companies.map((c) => ({ value: c.id, label: c.name })),
        },
        { name: "notes", label: "Notas", type: "textarea" },
      ]}
    />
  );
}
