import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Building2, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/activity-timeline";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";
import { CompanyHierarchy } from "@/components/companies/company-hierarchy";
import { enrichCompanyByCNPJ } from "@/lib/integrations/brasilapi-cnpj.functions";

import type { Company } from "@/lib/db-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/companies/$id")({
  component: CompanyDetail,
});

function CompanyDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [enriching, setEnriching] = useState(false);
  const runEnrich = useServerFn(enrichCompanyByCNPJ);


  const load = async () => {
    const { data } = await supabase.from("companies").select("*").eq("id", id).single();
    setCompany(data as Company | null);
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [id]);

  if (!company) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const remove = async () => {
    if (!confirm("Excluir empresa?")) return;
    await supabase.from("companies").delete().eq("id", company.id);
    toast.success("Excluído");
    navigate({ to: "/companies" });
  };

  const enrich = async () => {
    if (!company?.cnpj) {
      toast.error("Cadastre o CNPJ antes de enriquecer.");
      return;
    }
    setEnriching(true);
    try {
      const res = await runEnrich({ data: { company_id: company.id } });
      if (res?.ok) {
        toast.success("Empresa enriquecida via BrasilAPI");
        await load();
      } else {
        toast.error("CNPJ não encontrado nas bases públicas.");
      }
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Falha ao enriquecer");
    } finally {
      setEnriching(false);
    }
  };

  const header = (
    <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-5 min-w-0">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link to="/companies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="w-16 h-16 shrink-0 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white shadow-lg shadow-primary/20 border-4 border-card">
          <Building2 className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{company.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
            {company.industry && (
              <Badge variant="outline" className="rounded-full">
                {company.industry}
              </Badge>
            )}
            {company.city && (
              <span>
                {company.city}
                {company.state ? `/${company.state}` : ""}
              </span>
            )}
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {company.website} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={enrich}
          disabled={enriching || !(company as unknown as { cnpj?: string | null }).cnpj}
          className="gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {enriching ? "Enriquecendo…" : "Enriquecer via CNPJ"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
          onClick={remove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      
      <RecordLayout
        header={header}
        left={
        <PropertiesPanel
          entity="companies"
          table="companies"
          row={company as unknown as Record<string, unknown> & { id: string }}
          props={[
            { key: "name", label: "Nome", primary: true },
            { key: "domain", label: "Domínio", primary: true },
            { key: "website", label: "Website", type: "url", primary: true },
            { key: "industry", label: "Indústria", primary: true },
            { key: "size", label: "Tamanho", primary: true },
            { key: "phone", label: "Telefone", type: "tel", primary: true },
            { key: "cnpj", label: "CNPJ", type: "cnpj", primary: true },
            { key: "cep", label: "CEP", type: "cep", primary: true },
            { key: "address", label: "Endereço" },
            { key: "city", label: "Cidade" },
            { key: "state", label: "UF" },
            { key: "notes", label: "Notas" },
          ]}
          onSaved={load}
        />
      }
      center={
        <>
          <ActivityTimeline relatedKey="related_company_id" relatedId={company.id} />
        </>
      }
      right={
        <div className="space-y-4">
          <CompanyHierarchy
            companyId={company.id}
            parentId={
              (company as unknown as { parent_company_id: string | null }).parent_company_id ?? null
            }
            ownerId={company.owner_id}
          />
          <AssociationsPanel entity="company" entityId={company.id} />
        </div>
      }
      />
    </>
  );
}
