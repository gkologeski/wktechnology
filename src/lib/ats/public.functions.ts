import { firstAtsStageValue } from "./stages";
import { emailSchema } from "@/lib/email-schema";
// Server functions PÚBLICAS do ATS — sem autenticação.
// Usadas pelas páginas /careers e /careers/$slug. Cada workspace é resolvido
// pelo host (custom_domain) cadastrado em module_branding (module_id='ats').
import { createServerFn } from "@tanstack/react-start";
import { humanPhone, workspacePhoneCountry } from "@/lib/phone/phone-boundary";
import { z } from "zod";

/** Public career context is a workspace, never all records by its creator. */
async function resolvePublicWorkspace(
  host: string | null,
): Promise<{ workspaceId: string; ownerId: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let workspaceId: string | null = null;
  if (host) {
    const { data: branding, error } = await supabaseAdmin
      .from("module_branding")
      .select("workspace_id")
      .eq("module_id", "ats")
      .eq("custom_domain", host.replace(/^www\./, "").toLowerCase())
      .maybeSingle();
    if (error) throw new Error("Não foi possível identificar o portal de carreiras.");
    workspaceId = branding?.workspace_id ?? null;
  }
  // Preserve the existing default public portal for the shared app/preview host.
  let enabled = supabaseAdmin
    .from("workspace_modules")
    .select("workspace_id")
    .eq("module_id", "ats")
    .eq("enabled", true);
  if (workspaceId) enabled = enabled.eq("workspace_id", workspaceId);
  const { data: module, error } = await enabled
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar o portal de carreiras.");
  if (!module?.workspace_id) return null;
  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("created_by")
    .eq("id", module.workspace_id)
    .maybeSingle();
  return workspace?.created_by
    ? { workspaceId: module.workspace_id, ownerId: workspace.created_by }
    : null;
}

/** Lista vagas publicadas do workspace correspondente ao host. */
export const listPublicJobs = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ host: z.string().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspace = await resolvePublicWorkspace(data.host ?? null);
    if (!workspace) return { jobs: [], branding: null };

    const { data: jobs } = await supabaseAdmin
      .from("ats_jobs")
      .select(
        "id, title, slug, seniority, employment_type, location, remote_mode, salary_min, salary_max, salary_currency, opened_at, description",
      )
      .eq("workspace_id", workspace.workspaceId)
      .eq("status", "published")
      .order("opened_at", { ascending: false, nullsFirst: false })
      .limit(100);

    // Branding belongs to the same resolved public workspace.
    let branding: {
      product_name: string | null;
      logo_url: string | null;
      primary_color: string | null;
    } | null = null;
    if (workspace.workspaceId) {
      const { data: b } = await supabaseAdmin
        .from("module_branding")
        .select("product_name, logo_url, primary_color")
        .eq("workspace_id", workspace.workspaceId)
        .eq("module_id", "ats")
        .maybeSingle();
      branding = b ?? null;
    }

    return { jobs: jobs ?? [], branding };
  });

/** Detalhe de uma vaga publicada. */
export const getPublicJob = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        host: z.string().nullable().optional(),
        slug: z.string().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspace = await resolvePublicWorkspace(data.host ?? null);
    if (!workspace) return null;

    const { data: job } = await supabaseAdmin
      .from("ats_jobs")
      .select(
        "id, owner_id, title, slug, seniority, employment_type, location, remote_mode, salary_min, salary_max, salary_currency, opened_at, description, requirements",
      )
      .eq("workspace_id", workspace.workspaceId)
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return job ?? null;
  });

/** Candidatura pública: cria candidato + application 'applied'. */
export const submitPublicApplication = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        host: z.string().nullable().optional(),
        job_id: z.string().uuid(),
        full_name: z.string().trim().min(2).max(160),
        email: emailSchema(200),
        phone: z.string().trim().max(64).optional().nullable(),
        linkedin_url: z.string().trim().url().max(400).optional().nullable(),
        location: z.string().trim().max(160).optional().nullable(),
        cv_url: z.string().trim().url().max(800).optional().nullable(),
        message: z.string().trim().max(4000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspace = await resolvePublicWorkspace(data.host ?? null);
    if (!workspace) throw new Error("Workspace não encontrado para este domínio.");
    const ownerId = workspace.ownerId;

    // Garante que a vaga pertence ao owner e está publicada
    const { data: job } = await supabaseAdmin
      .from("ats_jobs")
      .select("id, owner_id, status, title, workspace_id, pipeline_id")
      .eq("id", data.job_id)
      .maybeSingle();
    if (
      !job ||
      !job.workspace_id ||
      job.workspace_id !== workspace.workspaceId ||
      job.status !== "published"
    ) {
      throw new Error("Vaga indisponível para candidatura.");
    }
    const applicantPhone = humanPhone(data.phone || null, {
      field: "Telefone",
      country: await workspacePhoneCountry(
        supabaseAdmin,
        (job as { workspace_id?: string | null }).workspace_id ?? null,
      ),
    });

    // Deduplica candidato por email
    let candidateId: string | null = null;
    if (data.email) {
      const { data: existing } = await supabaseAdmin
        .from("ats_candidates")
        .select("id")
        .eq("workspace_id", job.workspace_id)
        .eq("email", data.email)
        .maybeSingle();
      if (existing) candidateId = existing.id as string;
    }
    let candidateWasCreated = false;
    if (!candidateId) {
      const { data: created, error: cErr } = await supabaseAdmin
        .from("ats_candidates")
        .insert({
          owner_id: ownerId,
          workspace_id: job.workspace_id,
          assigned_to: ownerId,
          full_name: data.full_name,
          email: data.email,
          phone: applicantPhone,
          linkedin_url: data.linkedin_url ?? null,
          location: data.location ?? null,
          cv_url: data.cv_url ?? null,
          notes: data.message ?? null,
          source: "career_page",
        } as never)
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      candidateId = created.id as string;
      candidateWasCreated = true;
    }

    const { data: pipeline } = job.pipeline_id
      ? await supabaseAdmin
          .from("ats_pipelines")
          .select("stages")
          .eq("id", job.pipeline_id)
          .eq("workspace_id", job.workspace_id)
          .maybeSingle()
      : { data: null };
    const initialStage = firstAtsStageValue(pipeline?.stages);
    // Repeated submissions never reopen or reset an existing recruitment process.
    const { data: insertedApp, error: aErr } = await supabaseAdmin
      .from("ats_applications")
      .upsert(
        {
          owner_id: ownerId,
          workspace_id: job.workspace_id,
          assigned_to: ownerId,
          candidate_id: candidateId,
          job_id: data.job_id,
          stage_value: initialStage,
          status: "active",
          source: "career_page",
        } as never,
        { onConflict: "job_id,candidate_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    let app = insertedApp;
    if (!app) {
      const { data: existing, error } = await supabaseAdmin
        .from("ats_applications")
        .select("id")
        .eq("workspace_id", job.workspace_id)
        .eq("job_id", data.job_id)
        .eq("candidate_id", candidateId)
        .single();
      if (error || !existing) throw new Error("Não foi possível confirmar a candidatura.");
      app = existing;
    }

    // Auditoria + enfileira e-mail de confirmação ao candidato.
    try {
      if (insertedApp)
        await supabaseAdmin.from("ats_application_events").insert({
          owner_id: ownerId,
          workspace_id: job.workspace_id,
          application_id: app.id as string,
          job_id: data.job_id,
          candidate_id: candidateId,
          event_type: "application_created",
          metadata: { source: "career_page" },
        } as never);
    } catch {
      /* auditoria não pode bloquear candidatura */
    }
    if (candidateWasCreated && candidateId) {
      try {
        const { recordAtsEvent } = await import("./audit.server");
        await recordAtsEvent(supabaseAdmin, {
          ownerId,
          name: "ats.candidate.sourced",
          entityType: "candidate",
          entityId: candidateId,
          payload: {
            source: "career_page",
            jobId: data.job_id,
            applicationId: app.id as string,
            fullName: data.full_name,
            email: data.email,
          },
        });
      } catch {
        /* não bloqueia candidatura */
      }
    }
    try {
      const { enqueueApplicationConfirmation } = await import("./email-engine.server");
      await enqueueApplicationConfirmation({
        ownerId,
        applicationId: app.id as string,
        candidateId,
        jobId: data.job_id,
        toEmail: data.email,
        candidateName: data.full_name,
        jobTitle: (job.title as string) || "vaga",
      });
    } catch (e) {
      console.warn("[submitPublicApplication] enqueue confirmation failed", e);
    }

    return { ok: true };
  });
