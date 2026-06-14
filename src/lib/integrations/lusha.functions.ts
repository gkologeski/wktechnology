// Lusha API v2 (https://docs.lusha.com/apis/openapi.md)
// GET /v2/person — single contact (by email/linkedinUrl/personId or name+company)
// POST /v2/person — bulk up to 100
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LUSHA_BASE = "https://api.lusha.com";

async function lushaPersonByEmail(email: string) {
  const key = process.env.LUSHA_API_KEY;
  if (!key)
    throw new Error("Lusha não conectado: configure a LUSHA_API_KEY na tela de integrações.");
  const url = new URL(`${LUSHA_BASE}/v2/person`);
  url.searchParams.set("email", email);
  const res = await fetch(url, { headers: { api_key: key, accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Lusha erro [${res.status}]: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const Schema = z.object({
  entity: z.enum(["lead", "contact"]),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

type LushaPerson = {
  data?: {
    contact?: {
      emailAddresses?: { email?: string }[];
      phoneNumbers?: { number?: string }[];
      jobTitle?: string;
      firstName?: string;
      lastName?: string;
    };
    company?: { name?: string; domain?: string };
  };
};

export const enrichWithLusha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const table = data.entity === "lead" ? "leads" : "contacts";

    const cols =
      data.entity === "lead"
        ? "id, first_name, last_name, email, phone, company_name"
        : "id, first_name, last_name, email, phone, job_title";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any)
      .from(table)
      .select(cols)
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    const rowList = (rows ?? []) as Array<Record<string, unknown> & { id: string }>;

    const { data: job } = await supabase
      .from("enrichment_jobs")
      .insert({
        owner_id: userId,
        provider: "lusha",
        kind: "enrich",
        entity: data.entity,
        status: "running",
        total: rows?.length ?? 0,
        started_at: new Date().toISOString(),
        scope: { ids: data.ids } as never,
      })
      .select("id")
      .single();

    let succeeded = 0,
      failed = 0,
      credits = 0;
    for (const row of rowList) {
      const r = row;
      try {
        if (!r.email) {
          failed++;
          continue;
        }
        const result = (await lushaPersonByEmail(r.email as string)) as LushaPerson;
        const c = result.data?.contact;
        if (!c) {
          failed++;
          continue;
        }
        credits++;
        const update: Record<string, unknown> = {};
        if (!r.phone && c.phoneNumbers?.[0]?.number) update.phone = c.phoneNumbers[0].number;
        if (data.entity === "contact" && !r.job_title && c.jobTitle) update.job_title = c.jobTitle;
        if (data.entity === "lead" && !r.company_name && result.data?.company?.name)
          update.company_name = result.data.company.name;
        if (Object.keys(update).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from(table).update(update).eq("id", row.id);
        }
        await supabase.from("enrichment_job_items").insert({
          job_id: job!.id,
          entity_id: row.id,
          status: "ok",
          before: r as never,
          after: { ...r, ...update } as never,
        });
        succeeded++;
      } catch (e) {
        failed++;
        await supabase.from("enrichment_job_items").insert({
          job_id: job!.id,
          entity_id: row.id,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await supabase
      .from("enrichment_jobs")
      .update({
        status: failed === 0 ? "done" : succeeded === 0 ? "failed" : "partial",
        processed: succeeded + failed,
        succeeded,
        failed,
        credits_used: credits,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job!.id);

    if (credits > 0) {
      await supabase.from("credit_ledger").insert({
        owner_id: userId,
        provider: "lusha",
        job_id: job!.id,
        delta: credits,
        reason: `Enriquecimento Lusha (${succeeded} sucessos)`,
      });
    }
    return { succeeded, failed, credits };
  });
