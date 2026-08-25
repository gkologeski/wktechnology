/**
 * Multi-posting de vagas — Onda 5 / slice 1.
 *
 * Server functions para listar, publicar, atualizar e despublicar uma vaga
 * em job boards externos (LinkedIn, Indeed, Vagas.com).
 *
 * As implementações reais dependem de credenciais externas — sem elas, os
 * adapters caem em modo MOCK (ver adapters de cada provider). O resultado
 * é persistido em `public.ats_job_postings` com `is_mock=true` para tornar
 * o estado óbvio na UI e em relatórios.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findAdapterDescriptor } from "./adapters/registry";
import type { JobBoardAdapter, JobPostPayload } from "./adapters/types";
import { recordAtsEvent } from "./audit.server";

const PROVIDER = z.enum(["linkedin", "indeed", "vagas_com"]);

async function loadAdapter(provider: z.infer<typeof PROVIDER>): Promise<JobBoardAdapter> {
  if (provider === "linkedin") {
    const { LinkedInJobBoardAdapter } = await import("./adapters/linkedin/job-board");
    return LinkedInJobBoardAdapter;
  }
  if (provider === "indeed") {
    const { IndeedJobBoardAdapter } = await import("./adapters/indeed/job-board");
    return IndeedJobBoardAdapter;
  }
  const { VagasComJobBoardAdapter } = await import("./adapters/vagas_com/job-board");
  return VagasComJobBoardAdapter;
}

async function detectIsMock(provider: z.infer<typeof PROVIDER>, ownerId: string): Promise<boolean> {
  if (provider === "linkedin") {
    // LinkedIn é live quando existe conta Unipile conectada para o workspace.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("unipile_accounts")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("provider", "linkedin")
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();
    return !data?.id;
  }
  if (provider === "indeed") {
    const m = await import("./adapters/indeed/job-board");
    return !m.__indeedIsLive();
  }
  const m = await import("./adapters/vagas_com/job-board");
  return !m.__vagasIsLive();
}

export const listJobPostings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ job_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("ats_job_postings")
      .select(
        "id, provider, status, external_id, external_url, is_mock, last_synced_at, last_error, updated_at",
      )
      .eq("job_id", data.job_id)
      .order("provider", { ascending: true });
    if (error) throw new Error(error.message);
    return { postings: rows ?? [] };
  });

export const listAllJobPostings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: PROVIDER.optional(),
        status: z.enum(["published", "unpublished", "failed", "pending"]).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("ats_job_postings")
      .select(
        "id, provider, status, external_id, external_url, is_mock, last_synced_at, last_error, updated_at, job_id, job:ats_jobs(id, title, status)",
      )
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.provider) q = q.eq("provider", data.provider);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // contagens por provider
    const counts = {
      linkedin: { active: 0, mock: 0, failed: 0 },
      indeed: { active: 0, mock: 0, failed: 0 },
      vagas_com: { active: 0, mock: 0, failed: 0 },
    } as Record<string, { active: number; mock: number; failed: number }>;
    for (const r of rows ?? []) {
      const k = r.provider as keyof typeof counts;
      if (!counts[k]) continue;
      if (r.status === "published") counts[k].active += 1;
      if (r.status === "failed") counts[k].failed += 1;
      if (r.is_mock) counts[k].mock += 1;
    }
    return { postings: rows ?? [], counts };
  });

export const publishJobToProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ job_id: z.string().uuid(), provider: PROVIDER }).parse(input),
  )
  .handler(async ({ context, data }) => {
    // 1. Carrega a vaga (RLS garante autorização)
    const { data: job, error: jobErr } = await context.supabase
      .from("ats_jobs")
      .select(
        "id, owner_id, title, description, location, remote_mode, employment_type, salary_min, salary_max, linkedin_company_id, linkedin_company_name, linkedin_location_id, linkedin_workplace, linkedin_employment_status, linkedin_apply_type, linkedin_apply_url, linkedin_notification_email, linkedin_publish_mode, linkedin_budget_period, linkedin_budget_amount, linkedin_budget_currency",
      )
      .eq("id", data.job_id)
      .maybeSingle();
    if (jobErr) throw new Error(jobErr.message);
    if (!job) throw new Error("Vaga não encontrada");

    const descriptor = findAdapterDescriptor(data.provider);
    if (!descriptor) throw new Error("Provider desconhecido");

    const adapter = await loadAdapter(data.provider);
    const jobAny = job as typeof job & {
      linkedin_company_id: string | null;
      linkedin_company_name: string | null;
      linkedin_location_id: string | null;
      linkedin_workplace: string | null;
      linkedin_employment_status: string | null;
      linkedin_apply_type: string | null;
      linkedin_apply_url: string | null;
      linkedin_notification_email: string | null;
      linkedin_publish_mode: string | null;
      linkedin_budget_period: string | null;
      linkedin_budget_amount: number | string | null;
      linkedin_budget_currency: string | null;
    };
    const providerConfig =
      data.provider === "linkedin"
        ? {
            companyId: jobAny.linkedin_company_id,
            companyName: jobAny.linkedin_company_name,
            locationId: jobAny.linkedin_location_id,
            workplace: jobAny.linkedin_workplace,
            employmentStatus: jobAny.linkedin_employment_status,
            applyType: jobAny.linkedin_apply_type ?? "linkedin",
            applyUrl: jobAny.linkedin_apply_url,
            notificationEmail: jobAny.linkedin_notification_email,
            publishMode: jobAny.linkedin_publish_mode ?? "FREE",
            budgetPeriod: jobAny.linkedin_budget_period ?? "total",
            budgetAmount:
              jobAny.linkedin_budget_amount == null ? null : Number(jobAny.linkedin_budget_amount),
            budgetCurrency: jobAny.linkedin_budget_currency,
          }
        : undefined;

    const payload: JobPostPayload = {
      jobId: job.id,
      title: job.title,
      description: job.description ?? "",
      location: job.location ?? null,
      employmentType: job.employment_type ?? null,
      remote: job.remote_mode === "remote",
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      currency: "BRL",
      providerConfig,
    };

    const result = await adapter.postJob(
      { ownerId: context.userId, provider: data.provider, config: {}, credentialsSecretRef: null },
      payload,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jobOwnerId = (job as { owner_id: string }).owner_id;

    if (!result.ok) {
      await supabaseAdmin.from("ats_job_postings").upsert(
        {
          owner_id: jobOwnerId,
          job_id: job.id,
          provider: data.provider,
          status: "failed",
          last_error: result.error,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "job_id,provider" },
      );
      throw new Error(result.error);
    }

    const isMock = await detectIsMock(data.provider, context.userId);

    const { data: row, error } = await supabaseAdmin
      .from("ats_job_postings")
      .upsert(
        {
          owner_id: jobOwnerId,
          job_id: job.id,
          provider: data.provider,
          status: "published",
          external_id: result.data.externalId,
          external_url: result.data.url,
          is_mock: isMock,
          last_synced_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "job_id,provider" },
      )
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Não foi possível salvar a publicação");

    await recordAtsEvent(context.supabase, {
      ownerId: context.userId,
      name: "ats.job.posted",
      entityType: "job",
      entityId: job.id,
      payload: {
        provider: data.provider,
        external_id: result.data.externalId,
        external_url: result.data.url,
        is_mock: isMock,
      },
    });

    return { posting: row };
  });

export const unpublishJobFromProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ posting_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: posting, error: pErr } = await context.supabase
      .from("ats_job_postings")
      .select("id, job_id, provider, external_id")
      .eq("id", data.posting_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!posting) throw new Error("Publicação não encontrada");

    const provider = PROVIDER.parse(posting.provider);
    const adapter = await loadAdapter(provider);
    if (adapter.closeJob && posting.external_id) {
      await adapter.closeJob(
        { ownerId: context.userId, provider, config: {}, credentialsSecretRef: null },
        posting.external_id,
      );
    }

    const { supabaseAdmin: sbAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await sbAdmin
      .from("ats_job_postings")
      .update({
        status: "unpublished",
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", posting.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Publicação não encontrada");

    await recordAtsEvent(context.supabase, {
      ownerId: context.userId,
      name: "ats.job.unposted",
      entityType: "job",
      entityId: posting.job_id,
      payload: { provider, external_id: posting.external_id },
    });

    return { posting: row };
  });

/**
 * Dispara manualmente a sync de aplicantes de um posting LinkedIn.
 * Restrito ao owner do posting (RLS na leitura + verificação explícita).
 */
export const syncPostingApplicantsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ posting_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Verifica se o posting pertence ao workspace do usuário (RLS aplica).
    const { data: posting, error } = await context.supabase
      .from("ats_job_postings")
      .select("id, provider, status, is_mock")
      .eq("id", data.posting_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!posting) throw new Error("Publicação não encontrada");
    if (posting.provider !== "linkedin") {
      throw new Error("Sync automático disponível apenas para LinkedIn");
    }
    if (posting.status !== "published" || posting.is_mock) {
      throw new Error("Publique a vaga no LinkedIn antes de sincronizar aplicantes");
    }

    const { syncPostingApplicants } = await import("./linkedin-applicants-sync.server");
    const result = await syncPostingApplicants(data.posting_id);
    return result;
  });
