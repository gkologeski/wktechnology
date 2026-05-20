import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EntityList } from "@/components/entity-list";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES } from "@/lib/crm";
import type { Lead } from "@/lib/db-types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowRightLeft, Settings, Sparkles } from "lucide-react";
import { BulkEnrichDialog } from "@/components/enrichment/bulk-enrich-dialog";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [enrichIds, setEnrichIds] = useState<string[] | null>(null);

  if (location.pathname !== "/leads") {
    return <Outlet />;
  }


  const convert = async (lead: Lead) => {
    if (!user) return;
    if (!confirm(`Converter "${lead.first_name}" em Contato + Empresa + Negócio?`)) return;
    let companyId: string | null = null;
    if (lead.company_name) {
      const { data: c, error: ce } = await supabase
        .from("companies")
        .insert({ owner_id: user.id, name: lead.company_name })
        .select("id").single();
      if (ce) return toast.error(ce.message);
      companyId = c?.id ?? null;
    }
    const { data: contact, error: cte } = await supabase
      .from("contacts")
      .insert({
        owner_id: user.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        company_id: companyId,
      }).select("id").single();
    if (cte) return toast.error(cte.message);

    const { data: deal, error: de } = await supabase
      .from("deals")
      .insert({
        owner_id: user.id,
        name: `Negócio - ${lead.first_name} ${lead.last_name ?? ""}`.trim(),
        stage: "qualified",
        company_id: companyId,
        primary_contact_id: contact?.id,
      }).select("id").single();
    if (de) return toast.error(de.message);

    await supabase.from("leads").update({
      status: "qualified",
      converted_at: new Date().toISOString(),
      converted_contact_id: contact?.id,
      converted_deal_id: deal?.id,
    }).eq("id", lead.id);

    toast.success("Lead convertido!");
    qc.invalidateQueries();
  };

  return (
    <EntityList<Lead>
      table="leads"
      title="Leads"
      description="Capture e qualifique novos contatos."
      detailPath={(id) => `/leads/${id}`}
      csvEnabled
      boardStageField="status"
      boardStages={LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
      inlineEditable={["status", "source", "company_name"]}
      toolbar={
        <Button variant="outline" size="sm" asChild>
          <Link to="/leads/import-hubspot"><Settings className="h-4 w-4 mr-1" /> HubSpot</Link>
        </Button>
      }
      searchKeys={["first_name", "last_name", "email", "company_name"]}
      columns={[
        { key: "first_name", label: "Nome", render: (r) => `${r.first_name} ${r.last_name ?? ""}`.trim() },
        { key: "company_name", label: "Empresa" },
        { key: "email", label: "Email" },
        { key: "source", label: "Fonte" },
        { key: "status", label: "Status", render: (r) => LEAD_STATUSES.find((s) => s.value === r.status)?.label ?? r.status },
      ]}
      fields={[
        { name: "first_name", label: "Nome", required: true },
        { name: "last_name", label: "Sobrenome" },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Telefone", type: "tel" },
        { name: "company_name", label: "Empresa" },
        { name: "source", label: "Fonte (ex: site, indicação)" },
        { name: "status", label: "Status", type: "select", options: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { name: "notes", label: "Notas", type: "textarea" },
      ]}
      defaults={{ status: "new" }}
      bulkEditFields={[
        { name: "status", label: "Status", type: "select", options: LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })) },
        { name: "source", label: "Fonte" },
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
      rowActions={(row) => (
        row.status !== "qualified" && row.status !== "disqualified" ? (
          <Button variant="ghost" size="icon" title="Converter" onClick={() => convert(row)}>
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        ) : null
      )}
    />
  );
}
