// HubSpot via Lovable Connector Gateway
// (mantido para compatibilidade; refatorado para registrar jobs)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

type HSContact = {
  id: string;
  properties: Record<string, string | null | undefined>;
};

async function fetchHubspotContacts(limit: number, after?: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  if (!HUBSPOT_API_KEY) throw new Error("Conecte o HubSpot para continuar");

  const params = new URLSearchParams({
    limit: String(limit),
    properties: "firstname,lastname,email,phone,company,hs_lead_status,lifecyclestage,hs_analytics_source",
  });
  if (after) params.set("after", after);

  const res = await fetch(`${GATEWAY_URL}/crm/v3/objects/contacts?${params}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": HUBSPOT_API_KEY,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`HubSpot API erro [${res.status}]: ${JSON.stringify(data)}`);
  return data as { results: HSContact[]; paging?: { next?: { after: string } } };
}

export const previewHubspotLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().min(1).max(100).default(10) }).parse(input))
  .handler(async ({ data }) => {
    const result = await fetchHubspotContacts(data.limit);
    return {
      contacts: result.results.map((c) => ({
        id: c.id,
        first_name: c.properties.firstname ?? "",
        last_name: c.properties.lastname ?? "",
        email: c.properties.email ?? "",
        phone: c.properties.phone ?? "",
        company_name: c.properties.company ?? "",
        source: c.properties.hs_analytics_source ?? "hubspot",
      })),
    };
  });

export const importHubspotLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ maxRecords: z.number().min(1).max(1000).default(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: job } = await supabase.from("enrichment_jobs").insert({
      owner_id: userId, provider: "hubspot", kind: "import",
      entity: "lead", status: "running",
      total: data.maxRecords, started_at: new Date().toISOString(),
      scope: { maxRecords: data.maxRecords } as never,
    }).select("id").single();

    let imported = 0;
    let skipped = 0;
    let after: string | undefined;
    const pageSize = 100;

    try {
      while (imported + skipped < data.maxRecords) {
        const remaining = data.maxRecords - (imported + skipped);
        const limit = Math.min(pageSize, remaining);
        const page = await fetchHubspotContacts(limit, after);
        if (page.results.length === 0) break;

        const rows = page.results
          .filter((c) => c.properties.firstname || c.properties.email)
          .map((c) => ({
            owner_id: userId,
            first_name: (c.properties.firstname ?? c.properties.email ?? "Sem nome").toString(),
            last_name: c.properties.lastname ?? null,
            email: c.properties.email ?? null,
            phone: c.properties.phone ?? null,
            company_name: c.properties.company ?? null,
            source: "hubspot",
            status: "new" as const,
          }));

        skipped += page.results.length - rows.length;
        if (rows.length > 0) {
          const { error } = await supabase.from("leads").insert(rows);
          if (error) throw new Error(`Erro ao salvar leads: ${error.message}`);
          imported += rows.length;
        }
        after = page.paging?.next?.after;
        if (!after) break;
      }

      await supabase.from("enrichment_jobs").update({
        status: "done", processed: imported + skipped, succeeded: imported, failed: skipped,
        finished_at: new Date().toISOString(),
      }).eq("id", job!.id);
    } catch (e) {
      await supabase.from("enrichment_jobs").update({
        status: "failed", error: e instanceof Error ? e.message : String(e),
        finished_at: new Date().toISOString(),
      }).eq("id", job!.id);
      throw e;
    }
    return { imported, skipped };
  });
