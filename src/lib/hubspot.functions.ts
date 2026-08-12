import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

type HSLead = {
  id: string;
  properties: Record<string, string | null | undefined>;
};

const LEAD_PROPERTIES = [
  "hs_lead_name",
  "hs_lead_name_calculated",
  "hs_associated_contact_firstname",
  "hs_associated_contact_lastname",
  "hs_associated_contact_email",
  "hs_associated_company_name",
  "hs_lead_source",
  "hs_pipeline_stage",
  "hubspot_owner_id",
];

function headers() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) throw new Error("Conecte o HubSpot para continuar");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": HUBSPOT_API_KEY,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function fetchHubspotLeads(limit: number, after?: string) {
  const params = new URLSearchParams({
    limit: String(limit),
    properties: LEAD_PROPERTIES.join(","),
  });
  if (after) params.set("after", after);

  const res = await fetch(`${GATEWAY_URL}/crm/v3/objects/leads?${params}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HubSpot API erro [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data as { results: HSLead[]; paging?: { next?: { after: string } } };
}

function splitName(full: string | null | undefined): { first: string; last: string | null } {
  const s = (full ?? "").trim();
  if (!s) return { first: "", last: null };
  const parts = s.split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(" ") || null };
}

function normalize(l: HSLead) {
  const p = l.properties;
  let first = p.hs_associated_contact_firstname ?? "";
  let last = p.hs_associated_contact_lastname ?? null;
  if (!first) {
    const sp = splitName(p.hs_lead_name_calculated ?? p.hs_lead_name);
    first = sp.first;
    last = sp.last;
  }
  return {
    id: l.id,
    first_name: first || (p.hs_associated_contact_email ?? "Sem nome"),
    last_name: last,
    email: p.hs_associated_contact_email ?? null,
    phone: null as string | null,
    company_name: p.hs_associated_company_name ?? null,
    source: p.hs_lead_source ?? "hubspot",
  };
}

export const previewHubspotLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().min(1).max(100).default(10) }).parse(input),
  )
  .handler(async ({ data }) => {
    const result = await fetchHubspotLeads(data.limit);
    return { contacts: result.results.map(normalize) };
  });

export const importHubspotLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ maxRecords: z.number().min(1).max(20000).default(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let imported = 0;
    let skipped = 0;
    let after: string | undefined;
    const pageSize = 100;

    while (imported + skipped < data.maxRecords) {
      const remaining = data.maxRecords - (imported + skipped);
      const limit = Math.min(pageSize, remaining);
      const page = await fetchHubspotLeads(limit, after);
      if (page.results.length === 0) break;

      const rows = page.results.map(normalize).filter((r) => r.first_name);
      skipped += page.results.length - rows.length;

      if (rows.length > 0) {
        const insertRows = rows.map((r) => ({
          owner_id: userId,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          phone: r.phone,
          company_name: r.company_name,
          source: r.source,
          status: "new" as const,
          external_ids: { hubspot_lead: r.id } as never,
        }));
        const { data: inserted, error } = await supabase
          .from("leads")
          .insert(insertRows)
          .select("id");
        if (error) throw new Error(`Erro ao salvar leads: ${error.message}`);
        // Garante empresa e contato vinculados a cada lead importado
        const { ensureLeadRelationsSafe } = await import("@/lib/leads/lead-relations");
        for (const l of inserted ?? []) await ensureLeadRelationsSafe(supabase, l.id);
        imported += rows.length;
      }

      after = page.paging?.next?.after;
      if (!after) break;
    }

    return { imported, skipped };
  });
