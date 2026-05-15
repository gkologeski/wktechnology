import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EntityList } from "@/components/entity-list";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/lib/db-types";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { lookupCep } from "@/lib/integrations/viacep";
import { enrichCompaniesAddress } from "@/lib/integrations/viacep.functions";

export const Route = createFileRoute("/_authenticated/companies")({
  component: CompaniesPage,
});

function CompaniesPage() {
  const qc = useQueryClient();
  const enrichCeps = useServerFn(enrichCompaniesAddress);

  const lookupRow = async (row: Company) => {
    if (!row.cep) return toast.error("Empresa sem CEP");
    const r = await lookupCep(row.cep);
    if (!r) return toast.error("CEP não encontrado");
    const update: Record<string, unknown> = {};
    if (!row.city) update.city = r.localidade;
    if (!row.state) update.state = r.uf;
    if (!row.address) update.address = `${r.logradouro}${r.bairro ? `, ${r.bairro}` : ""}`;
    if (Object.keys(update).length === 0) return toast.info("Endereço já preenchido");
    const { error } = await supabase.from("companies").update(update).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Endereço preenchido");
    qc.invalidateQueries({ queryKey: ["companies"] });
  };

  const runBulkCep = async (ids: string[]) => {
    if (!confirm(`Buscar endereço (ViaCEP) de ${ids.length} empresa(s)?`)) return;
    const r = await enrichCeps({ data: { ids } });
    toast.success(`${r.succeeded} ok · ${r.failed} falhas · ${r.skipped} sem CEP`);
    qc.invalidateQueries({ queryKey: ["companies"] });
  };

  return (
    <EntityList<Company>
      table="companies"
      title="Empresas"
      description="Gerencie as empresas do seu CRM."
      searchKeys={["name", "domain", "industry"]}
      csvEnabled
      columns={[
        { key: "name", label: "Nome" },
        { key: "domain", label: "Domínio" },
        { key: "industry", label: "Indústria" },
        { key: "city", label: "Cidade", render: (r) => (r.city ? `${r.city}${r.state ? `/${r.state}` : ""}` : "—") },
        { key: "phone", label: "Telefone" },
      ]}
      fields={[
        { name: "name", label: "Nome", required: true },
        { name: "domain", label: "Domínio" },
        { name: "industry", label: "Indústria" },
        { name: "size", label: "Tamanho" },
        { name: "website", label: "Website" },
        { name: "phone", label: "Telefone", type: "tel" },
        { name: "cep", label: "CEP" },
        { name: "address", label: "Endereço" },
        { name: "city", label: "Cidade" },
        { name: "state", label: "UF" },
        { name: "notes", label: "Notas", type: "textarea" },
      ]}
      bulkEditFields={[
        { name: "industry", label: "Indústria" },
        { name: "size", label: "Tamanho" },
        { name: "city", label: "Cidade" },
        { name: "state", label: "UF" },
      ]}
      bulkActions={(ids) => (
        <Button variant="outline" size="sm" onClick={() => runBulkCep(ids)}>
          <MapPin className="h-4 w-4 mr-1" /> Buscar endereço (ViaCEP)
        </Button>
      )}
      rowActions={(row) =>
        row.cep ? (
          <Button variant="ghost" size="icon" title="Buscar endereço por CEP" onClick={() => lookupRow(row)}>
            <MapPin className="h-4 w-4" />
          </Button>
        ) : null
      }
    />
  );
}
