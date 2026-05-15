// Apollo.io People Enrichment via direct API (POST /api/v1/people/match)
// Docs: https://docs.apollo.io/reference/people-enrichment
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APOLLO_BASE = "https://api.apollo.io";

type ApolloPerson = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  phone_numbers?: { sanitized_number?: string; raw_number?: string }[];
  organization?: { name?: string | null; website_url?: string | null; primary_domain?: string | null } | null;
};

async function apolloMatch(payload: Record<string, unknown>) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("Apollo não conectado: configure a APOLLO_API_KEY na tela de integrações.");
  const res = await fetch(`${APOLLO_BASE}/api/v1/people/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key, accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Apollo erro [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  return data as { person?: ApolloPerson };
}

function mapApolloToLead(p: ApolloPerson) {
  return {
    email: p.email ?? null,
    phone: p.phone_numbers?.[0]?.sanitized_number ?? p.phone_numbers?.[0]?.raw_number ?? null,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    company_name: p.organization?.name ?? null,
    job_title: p.title ?? null,
    linkedin_url: p.linkedin_url ?? null,
  };
}

const TargetSchema = z.object({
  entity: z.enum(["lead", "contact"]),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const enrichWithApollo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TargetSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const table = data.entity === "lead" ? "leads" : "contacts";

    const cols = data.entity === "lead"
      ? "id, first_name, last_name, email, phone, company_name"
      : "id, first_name, last_name, email, phone, job_title";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any).from(table).select(cols).in("id", data.ids);
    if (error) throw new Error(error.message);
    const rowList = (rows ?? []) as Array<Record<string, unknown> & { id: string }>;

    const { data: job } = await supabase.from("enrichment_jobs").insert({
      owner_id: userId,
      provider: "apollo",
      kind: "enrich",
      entity: data.entity,
      status: "running",
      total: rows?.length ?? 0,
      started_at: new Date().toISOString(),
      scope: { ids: data.ids } as never,
    }).select("id").single();

    let succeeded = 0, failed = 0, credits = 0;
    for (const row of rowList) {
      try {
        const r = row;
        const params: Record<string, unknown> = {};
        if (r.email) params.email = r.email;
        else if (r.first_name && r.company_name) {
          params.first_name = r.first_name;
          if (r.last_name) params.last_name = r.last_name;
          params.organization_name = r.company_name;
        } else {
          failed++;
          continue;
        }
        const result = await apolloMatch(params);
        const person = result.person;
        if (!person) { failed++; continue; }
        credits++;
        const mapped = mapApolloToLead(person);
        const update: Record<string, unknown> = {};
        if (!r.email && mapped.email) update.email = mapped.email;
        if (!r.phone && mapped.phone) update.phone = mapped.phone;
        if (data.entity === "contact" && !r.job_title && mapped.job_title) update.job_title = mapped.job_title;
        if (data.entity === "lead" && !r.company_name && mapped.company_name) update.company_name = mapped.company_name;
        if (Object.keys(update).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from(table).update(update).eq("id", row.id);
        }
        await supabase.from("enrichment_job_items").insert({
          job_id: job!.id, entity_id: row.id, status: "ok",
          before: r as never, after: { ...r, ...update } as never,
        });
        succeeded++;
      } catch (e) {
        failed++;
        await supabase.from("enrichment_job_items").insert({
          job_id: job!.id, entity_id: row.id, status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await supabase.from("enrichment_jobs").update({
      status: failed === 0 ? "done" : (succeeded === 0 ? "failed" : "partial"),
      processed: succeeded + failed, succeeded, failed, credits_used: credits,
      finished_at: new Date().toISOString(),
    }).eq("id", job!.id);

    if (credits > 0) {
      await supabase.from("credit_ledger").insert({
        owner_id: userId, provider: "apollo", job_id: job!.id, delta: credits,
        reason: `Enriquecimento Apollo (${succeeded} sucessos)`,
      });
    }

    return { succeeded, failed, credits };
  });
