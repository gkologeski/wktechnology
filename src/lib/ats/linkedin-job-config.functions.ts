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
  linkedin_apply_url: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  linkedin_notification_email: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  linkedin_publish_mode: z.enum(["FREE", "PROMOTED"]).nullable().optional(),
  linkedin_budget_period: z.enum(["total", "daily"]).nullable().optional(),
  linkedin_budget_amount: z.number().positive().nullable().optional(),
  linkedin_budget_currency: z.string().trim().min(3).max(3).nullable().optional(),
});

export const getLinkedinJobConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ job_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("ats_jobs")
      .select(
        "linkedin_company_id, linkedin_company_name, linkedin_location_id, linkedin_location_name, linkedin_workplace, linkedin_employment_status, linkedin_apply_type, linkedin_apply_url, linkedin_notification_email, linkedin_publish_mode, linkedin_budget_period, linkedin_budget_amount, linkedin_budget_currency",
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
    // Verifica acesso à vaga sob RLS do usuário (admin, líder de time ou dono).
    const { data: job, error: readErr } = await context.supabase
      .from("ats_jobs")
      .select("id, owner_id")
      .eq("id", data.job_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!job) throw new Error("Vaga não encontrada ou sem permissão.");

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
      linkedin_publish_mode: data.linkedin_publish_mode ?? "FREE",
      linkedin_budget_period: data.linkedin_budget_period ?? "total",
      linkedin_budget_amount: data.linkedin_budget_amount ?? null,
      linkedin_budget_currency: data.linkedin_budget_currency ?? null,
    };
    // UPDATE via admin: autorização já garantida acima. Preserva owner_id original.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("ats_jobs")
      .update(patch as never)
      .eq("id", data.job_id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Falha ao atualizar configuração da vaga.");
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
    const { loadAccountCtx, resolveSearchParameterItems } =
      await import("@/lib/unipile/client.server");
    // Reaproveita o helper versionado (v1/v2) que fala com
    // /linkedin/search/parameters e devolve items com {id,title}.
    const ctxUp = await loadAccountCtx(context.userId).catch(() => null);
    if (!ctxUp) {
      return { items: [] as Array<{ id: string; title: string }>, connected: false };
    }
    const items = await resolveSearchParameterItems(ctxUp, data.type, data.keywords, data.limit);
    return { items: items.filter((it) => it.title), connected: true };
  });
