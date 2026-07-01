/**
 * Server functions para configurar publicação da vaga no LinkedIn (via Unipile)
 * e helpers de busca de Company Page / Location IDs.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONFIG = z.object({
  job_id: z.string().uuid(),
  linkedin_company_id: z.string().trim().nullable().optional(),
  linkedin_company_name: z.string().trim().max(200).nullable().optional(),
  linkedin_location_id: z.string().trim().nullable().optional(),
  linkedin_location_name: z.string().trim().max(200).nullable().optional(),
  linkedin_workplace: z.enum(["REMOTE", "HYBRID", "ON_SITE"]).nullable().optional(),
  linkedin_employment_status: z
    .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY", "VOLUNTEER", "OTHER"])
    .nullable()
    .optional(),
  linkedin_apply_type: z.enum(["linkedin", "external"]).nullable().optional(),
  linkedin_apply_url: z.string().trim().url().nullable().optional().or(z.literal("").transform(() => null)),
  linkedin_notification_email: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export const getLinkedinJobConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ job_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("ats_jobs")
      .select(
        "linkedin_company_id, linkedin_company_name, linkedin_location_id, linkedin_location_name, linkedin_workplace, linkedin_employment_status, linkedin_apply_type, linkedin_apply_url, linkedin_notification_email",
      )
      .eq("id", data.job_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? {};
  });

export const updateLinkedinJobConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CONFIG.parse(i))
  .handler(async ({ context, data }) => {
    const patch = {
      linkedin_company_id: data.linkedin_company_id ?? null,
      linkedin_company_name: data.linkedin_company_name ?? null,
      linkedin_location_id: data.linkedin_location_id ?? null,
      linkedin_location_name: data.linkedin_location_name ?? null,
      linkedin_workplace: data.linkedin_workplace ?? null,
      linkedin_employment_status: data.linkedin_employment_status ?? null,
      linkedin_apply_type: data.linkedin_apply_type ?? "linkedin",
      linkedin_apply_url: data.linkedin_apply_url ?? null,
      linkedin_notification_email: data.linkedin_notification_email ?? null,
    };
    const { data: row, error } = await context.supabase
      .from("ats_jobs")
      .update(patch as never)
      .eq("id", data.job_id)
      .eq("owner_id", context.userId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

/**
 * Busca Company Pages ou Locations no LinkedIn via Unipile (usa o mesmo
 * endpoint de search parameters já disponível no cliente Unipile).
 */
export const searchLinkedinDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        type: z.enum(["COMPANY", "LOCATION"]),
        keywords: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(15).default(8),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { loadAccountCtx } = await import("@/lib/unipile/client.server");
    // Reaproveita o helper existente que fala com /linkedin/search/parameters
    // e devolve items com {id,title}.
    const ctxUp = await loadAccountCtx(context.userId).catch(() => null);
    if (!ctxUp) {
      return { items: [] as Array<{ id: string; title: string }>, connected: false };
    }
    const { dsn, key } = getEnv();
    const url = `${dsn}/api/v1/linkedin/search/parameters?account_id=${encodeURIComponent(ctxUp.unipileAccountId)}&type=${data.type}&keywords=${encodeURIComponent(data.keywords)}&limit=${data.limit}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "X-API-KEY": key, Accept: "application/json" },
    });
    if (!res.ok) {
      return { items: [], connected: true, error: `Unipile ${res.status}` };
    }
    const json = (await res.json()) as {
      items?: Array<{ id?: string | number; entity_urn?: string; title?: string; text?: string }>;
    };
    const items = (json?.items ?? [])
      .map((it) => ({
        id:
          it.id != null
            ? String(it.id)
            : (it.entity_urn ?? "").split(":").pop() ?? "",
        title: it.title ?? it.text ?? "",
      }))
      .filter((it) => it.id && /^\d{3,}$/.test(it.id));
    return { items, connected: true };
  });

function getEnv() {
  const dsn = process.env.UNIPILE_DSN;
  const key = process.env.UNIPILE_API_KEY;
  if (!dsn || !key) throw new Error("Credenciais Unipile não configuradas.");
  const normalized = /^https?:\/\//i.test(dsn) ? dsn : `https://${dsn}`;
  return { dsn: normalized.replace(/\/$/, ""), key };
}
