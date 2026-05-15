import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { EntityList } from "@/components/entity-list";
import { Button } from "@/components/ui/button";
import type { Contact, Company } from "@/lib/db-types";
import { toast } from "sonner";
import { Sparkles, Users as UsersIcon } from "lucide-react";
import { enrichWithApollo } from "@/lib/integrations/apollo.functions";
import { enrichWithLusha } from "@/lib/integrations/lusha.functions";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const qc = useQueryClient();
  const apollo = useServerFn(enrichWithApollo);
  const lusha = useServerFn(enrichWithLusha);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies", "select"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id,name").order("name");
      return (data ?? []) as Pick<Company, "id" | "name">[];
    },
  });

  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  const runApollo = async (ids: string[]) => {
    if (!confirm(`Enriquecer ${ids.length} contato(s) com Apollo?`)) return;
    try {
      const r = await apollo({ data: { entity: "contact", ids } });
      toast.success(`Apollo: ${r.succeeded} ok · ${r.failed} falha(s)`);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro Apollo");
    }
  };
  const runLusha = async (ids: string[]) => {
    if (!confirm(`Enriquecer ${ids.length} contato(s) com Lusha?`)) return;
    try {
      const r = await lusha({ data: { entity: "contact", ids } });
      toast.success(`Lusha: ${r.succeeded} ok · ${r.failed} falha(s)`);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro Lusha");
    }
  };

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
      bulkEditFields={[
        { name: "job_title", label: "Cargo" },
        { name: "company_id", label: "Empresa", type: "select", options: companies.map((c) => ({ value: c.id, label: c.name })) },
      ]}
      bulkActions={(ids) => (
        <>
          <Button variant="outline" size="sm" onClick={() => runApollo(ids)}>
            <Sparkles className="h-4 w-4 mr-1" /> Apollo
          </Button>
          <Button variant="outline" size="sm" onClick={() => runLusha(ids)}>
            <UsersIcon className="h-4 w-4 mr-1" /> Lusha
          </Button>
        </>
      )}
    />
  );
}
