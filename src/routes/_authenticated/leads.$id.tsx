import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRightLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StageTracker } from "@/components/stage-tracker";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";
import { LEAD_STATUSES } from "@/lib/crm";
import type { Lead } from "@/lib/db-types";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);

  const load = async () => {
    const { data } = await supabase.from("leads").select("*").eq("id", id).single();
    setLead(data as Lead | null);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  if (!lead) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const setStatus = async (v: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("leads").update({ status: v as any }).eq("id", lead.id);
    void load();
  };

  const remove = async () => {
    if (!confirm("Excluir lead?")) return;
    await supabase.from("leads").delete().eq("id", lead.id);
    toast.success("Excluído");
    navigate({ to: "/leads" });
  };

  const convert = async () => {
    if (!user) return;
    if (!confirm("Converter em Contato + Empresa + Negócio?")) return;
    let companyId: string | null = null;
    if (lead.company_name) {
      const { data: c } = await supabase.from("companies").insert({ owner_id: user.id, name: lead.company_name }).select("id").single();
      companyId = c?.id ?? null;
    }
    const { data: contact } = await supabase.from("contacts").insert({
      owner_id: user.id, first_name: lead.first_name, last_name: lead.last_name,
      email: lead.email, phone: lead.phone, company_id: companyId,
    }).select("id").single();
    const { data: deal } = await supabase.from("deals").insert({
      owner_id: user.id, name: `Negócio - ${lead.first_name}`, stage: "qualified",
      company_id: companyId, primary_contact_id: contact?.id,
    }).select("id").single();
    await supabase.from("leads").update({
      status: "qualified", converted_at: new Date().toISOString(),
      converted_contact_id: contact?.id, converted_deal_id: deal?.id,
    }).eq("id", lead.id);
    toast.success("Convertido!");
    void load();
  };

  const header = (
    <>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/leads"><ArrowLeft className="h-4 w-4 mr-1" /> Leads</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={convert}><ArrowRightLeft className="h-4 w-4 mr-1" /> Converter</Button>
          <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{lead.first_name} {lead.last_name ?? ""}</h1>
            <p className="text-sm text-muted-foreground">
              {lead.company_name && <span>{lead.company_name} · </span>}
              {lead.email ?? "sem email"}
            </p>
          </div>
          <div className="text-right">
            <Badge variant="outline">Score: {lead.score ?? 0}</Badge>
          </div>
        </div>
        <div className="mt-4">
          <StageTracker stages={LEAD_STATUSES.map(s => ({ value: s.value, label: s.label }))} current={lead.status} onChange={setStatus} />
        </div>
      </div>
    </>
  );

  return (
    <RecordLayout
      header={header}
      left={
        <PropertiesPanel
          entity="leads" table="leads" row={lead as unknown as Record<string, unknown> & { id: string }}
          props={[
            { key: "first_name", label: "Nome", primary: true },
            { key: "last_name", label: "Sobrenome", primary: true },
            { key: "email", label: "Email", type: "email", primary: true },
            { key: "phone", label: "Telefone", type: "tel", primary: true },
            { key: "company_name", label: "Empresa", primary: true },
            { key: "source", label: "Fonte", primary: true },
            { key: "label", label: "Label" },
            { key: "score", label: "Score", type: "number" },
            { key: "notes", label: "Notas" },
          ]}
          onSaved={load}
        />
      }
      center={
        <>
          <AiSummaryPanel entity="lead" entityId={lead.id} />
          <h2 className="font-semibold text-sm">Atividades</h2>
          <ActivityTimeline relatedKey="related_lead_id" relatedId={lead.id} />
        </>
      }
      right={<AssociationsPanel entity="lead" entityId={lead.id} />}
    />
  );
}
