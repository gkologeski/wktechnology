// Server functions PÚBLICAS do ATS — sem autenticação.
// Usadas pelas páginas /careers e /careers/$slug. Cada workspace é resolvido
// pelo host (custom_domain) cadastrado em module_branding (module_id='ats').
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Resolve owner_id do workspace pelo host do ATS. */
async function resolveOwnerByHost(host: string | null): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // 1) tenta por custom_domain
  if (host) {
    const cleanHost = host.replace(/^www\./, "").toLowerCase();
    const { data: mb } = await supabaseAdmin
      .from("module_branding")
      .select("workspace_id")
      .eq("module_id", "ats")
      .eq("custom_domain", cleanHost)
      .maybeSingle();
    if (mb?.workspace_id) {
      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("created_by")
        .eq("id", mb.workspace_id as string)
        .maybeSingle();
      if (ws?.created_by) return ws.created_by as string;
    }
  }
  // 2) fallback: workspace mais antigo com módulo ATS habilitado
  const { data: wm } = await supabaseAdmin
    .from("workspace_modules")
    .select("workspace_id")
    .eq("module_id", "ats")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (wm?.workspace_id) {
    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("created_by")
      .eq("id", wm.workspace_id as string)
      .maybeSingle();
    return (ws?.created_by as string | null) ?? null;
  }
  return null;
}

/** Lista vagas publicadas do workspace correspondente ao host. */
export const listPublicJobs = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ host: z.string().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ownerId = await resolveOwnerByHost(data.host ?? null);
    if (!ownerId) return { jobs: [], branding: null };

    const { data: jobs } = await supabaseAdmin
      .from("ats_jobs")
      .select(
        "id, title, slug, seniority, employment_type, location, remote_mode, salary_min, salary_max, salary_currency, opened_at, description",
      )
      .eq("owner_id", ownerId)
      .eq("status", "published")
      .order("opened_at", { ascending: false, nullsFirst: false })
      .limit(100);

    // Branding do módulo ATS (logo, cor, nome do produto)
    const { data: wm } = await supabaseAdmin
      .from("workspace_modules")
      .select("workspace_id")
      .eq("module_id", "ats")
      .eq("enabled", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    let branding: {
      product_name: string | null;
      logo_url: string | null;
      primary_color: string | null;
    } | null = null;
    if (wm?.workspace_id) {
      const { data: b } = await supabaseAdmin
        .from("module_branding")
        .select("product_name, logo_url, primary_color")
        .eq("workspace_id", wm.workspace_id as string)
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
    const ownerId = await resolveOwnerByHost(data.host ?? null);
    if (!ownerId) return null;

    const { data: job } = await supabaseAdmin
      .from("ats_jobs")
      .select(
        "id, owner_id, title, slug, seniority, employment_type, location, remote_mode, salary_min, salary_max, salary_currency, opened_at, description, requirements",
      )
      .eq("owner_id", ownerId)
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
        email: z.string().trim().email().max(200),
        phone: z.string().trim().max(40).optional().nullable(),
        linkedin_url: z.string().trim().url().max(400).optional().nullable(),
        location: z.string().trim().max(160).optional().nullable(),
        cv_url: z.string().trim().url().max(800).optional().nullable(),
        message: z.string().trim().max(4000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ownerId = await resolveOwnerByHost(data.host ?? null);
    if (!ownerId) throw new Error("Workspace não encontrado para este domínio.");

    // Garante que a vaga pertence ao owner e está publicada
    const { data: job } = await supabaseAdmin
      .from("ats_jobs")
      .select("id, owner_id, status, title")
      .eq("id", data.job_id)
      .maybeSingle();
    if (!job || job.owner_id !== ownerId || job.status !== "published") {
      throw new Error("Vaga indisponível para candidatura.");
    }

    // Deduplica candidato por email
    let candidateId: string | null = null;
    if (data.email) {
      const { data: existing } = await supabaseAdmin
        .from("ats_candidates")
        .select("id")
        .eq("owner_id", ownerId)
        .ilike("email", data.email)
        .maybeSingle();
      if (existing) candidateId = existing.id as string;
    }
    let candidateWasCreated = false;
    if (!candidateId) {
      const { data: created, error: cErr } = await supabaseAdmin
        .from("ats_candidates")
        .insert({
          owner_id: ownerId,
          full_name: data.full_name,
          email: data.email,
          phone: data.phone ?? null,
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

    // Application (idempotente via UNIQUE job_id,candidate_id)
    const { data: app, error: aErr } = await supabaseAdmin
      .from("ats_applications")
      .upsert(
        {
          owner_id: ownerId,
          candidate_id: candidateId,
          job_id: data.job_id,
          stage_value: "applied",
          status: "active",
          source: "career_page",
        } as never,
        { onConflict: "job_id,candidate_id" },
      )
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);

    // Auditoria + enfileira e-mail de confirmação ao candidato.
    try {
      await supabaseAdmin.from("ats_application_events").insert({
        owner_id: ownerId,
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
