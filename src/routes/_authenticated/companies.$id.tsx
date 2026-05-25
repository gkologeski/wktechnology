import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Building2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/activity-timeline";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";
import type { Company } from "@/lib/db-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/companies/$id")({
  component: CompanyDetail,
});

function CompanyDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);

  const load = async () => {
    const { data } = await supabase.from("companies").select("*").eq("id", id).single();
    setCompany(data as Company | null);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  if (!company) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const remove = async () => {
    if (!confirm("Excluir empresa?")) return;
    await supabase.from("companies").delete().eq("id", company.id);
    toast.success("Excluído");
    navigate({ to: "/companies" });
  };

  const header = (
    <>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/companies"><ArrowLeft className="h-4 w-4 mr-1" /> Empresas</Link>
        </Button>
        <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{company.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              {company.industry && <Badge variant="outline">{company.industry}</Badge>}
              {company.city && <span>{company.city}{company.state ? `/${company.state}` : ""}</span>}
              {company.website && (
                <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {company.website} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <RecordLayout
      header={header}
      left={
        <PropertiesPanel
          entity="companies" table="companies" row={company as unknown as Record<string, unknown> & { id: string }}
          props={[
            { key: "name", label: "Nome", primary: true },
            { key: "domain", label: "Domínio", primary: true },
            { key: "website", label: "Website", type: "url", primary: true },
            { key: "industry", label: "Indústria", primary: true },
            { key: "size", label: "Tamanho", primary: true },
            { key: "phone", label: "Telefone", type: "tel", primary: true },
            { key: "cep", label: "CEP", primary: true },
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
          <h2 className="font-semibold text-sm">Atividades</h2>
          <ActivityTimeline relatedKey="related_company_id" relatedId={company.id} />
        </>
      }
      right={<AssociationsPanel entity="company" entityId={company.id} />}
    />
  );
}
