// Server functions do módulo ATS (Sprint A: CRUD + Kanban).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emitEvent } from "@/lib/events.server";
import { recordAtsEvent } from "./audit.server";
import { DEFAULT_ATS_STAGES, type AtsStage } from "./stages";

// ---------- helpers ---------------------------------------------------------

async function ensureDefaultPipeline(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<{ id: string; stages: AtsStage[] }> {
  const { data: existing, error } = await supabase
    .from("ats_pipelines")
    .select("id, stages, is_default")
    .eq("owner_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) {
    return {
      id: existing.id as string,
      stages: (existing.stages as AtsStage[]) ?? DEFAULT_ATS_STAGES,
    };
  }
  const { data: created, error: insErr } = await supabase
    .from("ats_pipelines")
    .insert({
      owner_id: userId,
      name: "Pipeline padrão",
      is_default: true,
      stages: DEFAULT_ATS_STAGES as never,
    } as never)
    .select("id, stages")
    .single();
  if (insErr) throw new Error(insErr.message);
  return { id: created.id as string, stages: created.stages as AtsStage[] };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

// ---------- pipelines -------------------------------------------------------

export const getAtsDefaultPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    return ensureDefaultPipeline(supabase, userId);
  });

// ---------- jobs ------------------------------------------------------------

const JobSaveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).optional().nullable(),
  requirements: z.string().max(10000).optional().nullable(),
  seniority: z
    .enum(["intern", "junior", "mid", "senior", "lead", "principal"])
    .optional()
    .nullable(),
  employment_type: z.enum(["clt", "pj", "contract", "internship", "temporary"]).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  remote_mode: z.enum(["onsite", "hybrid", "remote"]).optional().nullable(),
  salary_min: z.number().min(0).optional().nullable(),
  salary_max: z.number().min(0).optional().nullable(),
  status: z.enum(["draft", "published", "on_hold", "filled", "closed"]).default("draft"),
  deal_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  hiring_manager_id: z.string().uuid().optional().nullable(),
  recruiter_id: z.string().uuid().optional().nullable(),
  pipeline_id: z.string().uuid().optional().nullable(),
});

export const listAtsJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: string; search?: string } | undefined) => data ?? {})
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    let q = supabase
      .from("ats_jobs")
      .select(
        "id, title, slug, status, seniority, employment_type, location, remote_mode, salary_min, salary_max, deal_id, opened_at, filled_at, updated_at, created_at, owner_id, hiring_manager_id, recruiter_id, metadata",
      )
      // Sem filtro por owner_id: as políticas RLS já expõem vagas do próprio
      // usuário, das quais é hiring manager/recruiter, e das compartilhadas no
      // workspace (ats_jobs_workspace_shared_select). Filtrar por owner_id aqui
      // escondia vagas criadas por colegas do mesmo workspace.
      .order("updated_at", { ascending: false })
      .limit(200);

    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await q;

    if (error) throw new Error(error.message);

    // contagem de candidaturas ativas por vaga
    const ids = (rows ?? []).map((r) => r.id as string);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: apps } = await supabase
        .from("ats_applications")
        .select("job_id")
        .in("job_id", ids)
        .eq("status", "active");
      for (const a of (apps ?? []) as Array<{ job_id: string }>) {
        counts[a.job_id] = (counts[a.job_id] ?? 0) + 1;
      }
    }
    type JobRow = {
      id: string;
      title: string;
      slug: string | null;
      status: string;
      seniority: string | null;
      employment_type: string | null;
      location: string | null;
      remote_mode: string | null;
      salary_min: number | null;
      salary_max: number | null;
      deal_id: string | null;
      opened_at: string | null;
      filled_at: string | null;
      updated_at: string;
      created_at: string;
      metadata: Record<string, unknown> | null;
    };
    return ((rows ?? []) as unknown as JobRow[]).map((r) => ({
      ...r,
      metadata: undefined,
      department: ((r.metadata as { department?: string } | null)?.department) ?? null,
      active_applications: counts[r.id] ?? 0,
    }));
  });



export const getAtsJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: job, error } = await supabase
      .from("ats_jobs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!job) throw new Error("Vaga não encontrada");
    return job;
  });

export const saveAtsJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobSaveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let pipelineId: string;
    if (data.pipeline_id) {
      const { data: pipe, error: pErr } = await supabase
        .from("ats_pipelines")
        .select("id")
        .eq("id", data.pipeline_id)
        .eq("owner_id", userId)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!pipe) throw new Error("Pipeline não encontrado neste workspace");
      pipelineId = pipe.id as string;
    } else {
      const pipeline = await ensureDefaultPipeline(supabase, userId);
      pipelineId = pipeline.id;
    }
    const slug = slugify(data.title) + "-" + Date.now().toString(36);
    const base = {
      owner_id: userId,
      pipeline_id: pipelineId,
      title: data.title,
      description: data.description ?? null,
      requirements: data.requirements ?? null,
      seniority: data.seniority ?? null,
      employment_type: data.employment_type ?? null,
      location: data.location ?? null,
      remote_mode: data.remote_mode ?? null,
      salary_min: data.salary_min ?? null,
      salary_max: data.salary_max ?? null,
      status: data.status,
      deal_id: data.deal_id ?? null,
      company_id: data.company_id ?? null,
      hiring_manager_id: data.hiring_manager_id ?? null,
      recruiter_id: data.recruiter_id ?? null,
      opened_at: data.status === "published" ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { data: updated, error } = await supabase
        .from("ats_jobs")
        .update(base as never)
        .eq("id", data.id)
        .select("id, status")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("Vaga não encontrada ou sem permissão para editar");
      if (data.status === "published") {
        await emitEvent(supabase, {
          ownerId: userId,
          eventName: "ats.job.opened",
          entityType: "ats_job",
          entityId: data.id,
          dedupeKey: `ats.job.opened:${data.id}`,
          payload: { jobId: data.id, title: data.title },
        }).catch(() => undefined);
      }
      return updated;
    }
    const { data: inserted, error } = await supabase
      .from("ats_jobs")
      .insert({ ...base, slug } as never)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    if (data.status === "published") {
      await emitEvent(supabase, {
        ownerId: userId,
        eventName: "ats.job.opened",
        entityType: "ats_job",
        entityId: inserted.id as string,
        dedupeKey: `ats.job.opened:${inserted.id}`,
        payload: { jobId: inserted.id, title: data.title },
      }).catch(() => undefined);
    }
    return inserted;
  });

export const deleteAtsJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ats_jobs")
      .delete()
      .eq("owner_id", userId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createJobFromDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ dealId: z.string().uuid(), title: z.string().min(1).max(200).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: deal, error: dErr } = await supabase
      .from("deals")
      .select("id, name, company_id, owner_id")
      .eq("owner_id", userId)
      .eq("id", data.dealId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!deal) throw new Error("Negócio não encontrado");
    const pipeline = await ensureDefaultPipeline(supabase, userId);
    const title = data.title ?? `Vaga para ${deal.name as string}`;
    const slug = slugify(title) + "-" + Date.now().toString(36);
    const { data: inserted, error } = await supabase
      .from("ats_jobs")
      .insert({
        owner_id: userId,
        pipeline_id: pipeline.id,
        title,
        slug,
        status: "draft",
        deal_id: deal.id as string,
        company_id: (deal.company_id as string) ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await emitEvent(supabase, {
      ownerId: userId,
      eventName: "crm.deal.linked_to_job",
      entityType: "deal",
      entityId: deal.id as string,
      payload: { dealId: deal.id, jobId: inserted.id },
    }).catch(() => undefined);
    return inserted;
  });

// ---------- candidates -----------------------------------------------------

const ExperienceEntrySchema = z.object({
  title: z.string().trim().max(200).optional().default(""),
  company: z.string().trim().max(200).optional().default(""),
  start: z.string().trim().max(40).optional().default(""),
  end: z.string().trim().max(40).optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
});
const EducationEntrySchema = z.object({
  school: z.string().trim().max(200).optional().default(""),
  degree: z.string().trim().max(200).optional().default(""),
  start: z.string().trim().max(40).optional().default(""),
  end: z.string().trim().max(40).optional().default(""),
});

const CandidateSaveSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  linkedin_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  location: z.string().max(120).optional().nullable(),
  current_position: z.string().max(200).optional().nullable(),
  current_company: z.string().max(200).optional().nullable(),
  skills: z.array(z.string().max(60)).max(100).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  experiences: z.array(ExperienceEntrySchema).max(20).optional(),
  education: z.array(EducationEntrySchema).max(20).optional(),
  source: z.enum(["manual", "career_page", "linkedin_easy_apply", "referral", "import"]).default("manual"),
  notes: z.string().max(5000).optional().nullable(),
});

export const listAtsCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("ats_candidates")
      .select(
        "id, full_name, email, phone, location, current_position, current_company, skills, tags, source, score, updated_at",
      )
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(300);
    if (data.search)
      q = q.or(`full_name.ilike.%${data.search}%,email.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveAtsCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandidateSaveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const base = {
      owner_id: userId,
      full_name: data.full_name,
      email: data.email || null,
      phone: data.phone ?? null,
      linkedin_url: data.linkedin_url || null,
      location: data.location ?? null,
      current_position: data.current_position ?? null,
      current_company: data.current_company ?? null,
      skills: data.skills ?? [],
      tags: data.tags ?? [],
      experiences: (data.experiences ?? []) as unknown as never,
      education: (data.education ?? []) as unknown as never,
      source: data.source,
      notes: data.notes ?? null,
      created_by: userId,
    };
    if (data.id) {
      const { data: u, error } = await supabase
        .from("ats_candidates")
        .update(base as never)
        .eq("id", data.id)
        .eq("owner_id", userId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return u;
    }
    const { data: ins, error } = await supabase
      .from("ats_candidates")
      .insert(base as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await recordAtsEvent(supabase, {
      ownerId: userId,
      name: "ats.candidate.sourced",
      entityType: "candidate",
      entityId: ins.id as string,
      payload: {
        source: data.source,
        fullName: data.full_name,
        email: data.email || null,
      },
    }).catch(() => undefined);
    return ins;
  });

export const deleteAtsCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ats_candidates")
      .delete()
      .eq("owner_id", userId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- applications (kanban) ------------------------------------------

export const listJobApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: apps, error } = await supabase
      .from("ats_applications")
      .select(
        "id, candidate_id, job_id, stage_value, status, source, applied_at, moved_at, position, ai_match_score",
      )
      .eq("job_id", data.jobId)
      .order("stage_value", { ascending: true })
      .order("position", { ascending: true });

    if (error) throw new Error(error.message);
    type Cand = {
      id: string;
      full_name: string;
      email: string | null;
      current_position: string | null;
      current_company: string | null;
      skills: string[] | null;
    };
    const candidateIds = Array.from(new Set((apps ?? []).map((a) => a.candidate_id as string)));
    const candidatesMap: Record<string, Cand> = {};
    if (candidateIds.length) {
      const { data: cands } = await supabase
        .from("ats_candidates")
        .select("id, full_name, email, current_position, current_company, skills")
        .in("id", candidateIds);
      for (const c of (cands ?? []) as unknown as Cand[]) {
        candidatesMap[c.id] = c;
      }
    }
    type AppRow = {
      id: string;
      candidate_id: string;
      job_id: string;
      stage_value: string;
      status: string;
      source: string;
      applied_at: string;
      moved_at: string;
      position: number;
      ai_match_score: number | null;
    };
    return (apps ?? []).map((a) => {
      const row = a as unknown as AppRow;
      return { ...row, candidate: candidatesMap[row.candidate_id] ?? null };
    });
  });

export const addApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        jobId: z.string().uuid(),
        candidateId: z.string().uuid(),
        source: z
          .enum(["manual", "career_page", "linkedin_easy_apply", "referral", "import"])
          .default("manual"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: ins, error } = await supabase
      .from("ats_applications")
      .insert({
        owner_id: userId,
        job_id: data.jobId,
        candidate_id: data.candidateId,
        stage_value: "applied",
        status: "active",
        source: data.source,
        position: 0,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase
      .from("ats_application_events")
      .insert({
        owner_id: userId,
        application_id: ins.id as string,
        job_id: data.jobId,
        candidate_id: data.candidateId,
        event_type: "application_created",
        to_stage: "applied",
        actor_id: userId,
        metadata: { source: data.source },
      } as never)
      .then(() => undefined, () => undefined);
    await emitEvent(supabase, {
      ownerId: userId,
      eventName: "ats.application.created",
      entityType: "ats_application",
      entityId: ins.id as string,
      payload: { applicationId: ins.id, jobId: data.jobId, candidateId: data.candidateId },
    }).catch(() => undefined);
    return ins;
  });

export const listApplicationEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ application_id: z.string().uuid(), limit: z.number().int().min(1).max(200).default(100) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ats_application_events")
      .select("id, event_type, from_stage, to_stage, actor_id, metadata, created_at")
      .eq("application_id", data.application_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const actorIds = Array.from(
      new Set((rows ?? []).map((r) => (r as { actor_id: string | null }).actor_id).filter(Boolean) as string[]),
    );
    let nameMap: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      nameMap = Object.fromEntries(((profs ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name ?? ""]));
    }
    return (rows ?? []).map((r) => {
      const row = r as { id: string; event_type: string; from_stage: string | null; to_stage: string | null; actor_id: string | null; metadata: unknown; created_at: string };
      return {
        id: row.id,
        event_type: row.event_type,
        from_stage: row.from_stage,
        to_stage: row.to_stage,
        actor_id: row.actor_id,
        actor_name: row.actor_id ? (nameMap[row.actor_id] || null) : null,
        metadata: (row.metadata ?? null) as Record<string, string | number | boolean | null> | null,
        created_at: row.created_at,
      };
    });

  });


export const moveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        toStage: z.string().min(1).max(50),
        position: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Estado anterior para detectar transição.
    const { data: prev } = await supabase
      .from("ats_applications")
      .select("id, stage_value, job_id, candidate_id, status")
      .eq("owner_id", userId)
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!prev) throw new Error("Aplicação não encontrada");

    const patch: Record<string, unknown> = {
      stage_value: data.toStage,
      position: data.position,
      moved_at: new Date().toISOString(),
    };
    if (data.toStage === "hired") patch.status = "hired";
    else if (data.toStage === "rejected") patch.status = "rejected";
    else patch.status = "active";

    const { error } = await supabase
      .from("ats_applications")
      .update(patch as never)
      .eq("owner_id", userId)
      .eq("id", data.applicationId);
    if (error) throw new Error(error.message);

    if (prev.stage_value !== data.toStage) {
      // Auditoria
      await supabase
        .from("ats_application_events")
        .insert({
          owner_id: userId,
          application_id: data.applicationId,
          job_id: prev.job_id,
          candidate_id: prev.candidate_id,
          event_type: "stage_moved",
          from_stage: prev.stage_value,
          to_stage: data.toStage,
          actor_id: userId,
        } as never)
        .then(() => undefined, () => undefined);

      await emitEvent(supabase, {
        ownerId: userId,
        eventName: "ats.application.stage_changed",
        entityType: "ats_application",
        entityId: data.applicationId,
        payload: {
          applicationId: data.applicationId,
          fromStage: prev.stage_value,
          toStage: data.toStage,
          jobId: prev.job_id,
          candidateId: prev.candidate_id,
        },
      }).catch(() => undefined);

      if (data.toStage === "hired") {
        await recordAtsEvent(supabase, {
          ownerId: userId,
          name: "ats.candidate.hired",
          entityType: "candidate",
          entityId: prev.candidate_id as string,
          dedupeKey: `ats.candidate.hired:${data.applicationId}`,
          payload: {
            applicationId: data.applicationId,
            jobId: prev.job_id,
            candidateId: prev.candidate_id,
          },
        }).catch(() => undefined);
      }
      if (data.toStage === "rejected") {
        await emitEvent(supabase, {
          ownerId: userId,
          eventName: "ats.application.rejected",
          entityType: "ats_application",
          entityId: data.applicationId,
          payload: {
            applicationId: data.applicationId,
            jobId: prev.job_id,
            candidateId: prev.candidate_id,
          },
        }).catch(() => undefined);
      }
    }

    // Enfileirar e-mail automático por etapa (se configurado)
    try {
      const { data: tpl } = await supabase
        .from("ats_stage_emails")
        .select("subject, body, enabled")
        .eq("owner_id", userId)
        .eq("stage_value", data.toStage)
        .maybeSingle();
      if (tpl && (tpl as { enabled: boolean }).enabled) {
        const { data: cand } = await supabase
          .from("ats_candidates")
          .select("id, full_name, email")
          .eq("id", prev.candidate_id as string)
          .maybeSingle();
        const c = cand as { full_name: string; email: string | null } | null;
        if (c?.email) {
          await supabase
            .from("ats_stage_email_log")
            .insert({
              owner_id: userId,
              application_id: data.applicationId,
              candidate_id: prev.candidate_id,
              job_id: prev.job_id,
              stage_value: data.toStage,
              to_email: c.email,
              subject: (tpl as { subject: string }).subject,
              body: (tpl as { body: string }).body,
              status: "pending",
            } as never);
        }
      }
    } catch {
      /* não bloqueia movimentação */
    }

    return { ok: true };
  });

// ---------- job activity feed & interviews -------------------------------

export const listJobEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        jobId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ats_application_events")
      .select(
        "id, event_type, from_stage, to_stage, application_id, candidate_id, metadata, created_at",
      )
      .eq("job_id", data.jobId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    type Row = {
      id: string;
      event_type: string;
      from_stage: string | null;
      to_stage: string | null;
      application_id: string;
      candidate_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    };
    const candIds = Array.from(
      new Set(
        ((rows ?? []) as unknown as Row[])
          .map((r) => r.candidate_id)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const map: Record<string, string> = {};
    if (candIds.length) {
      const { data: cs } = await supabase
        .from("ats_candidates")
        .select("id, full_name")
        .in("id", candIds);
      for (const c of (cs ?? []) as Array<{ id: string; full_name: string }>) {
        map[c.id] = c.full_name;
      }
    }
    return ((rows ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      event_type: r.event_type,
      from_stage: r.from_stage,
      to_stage: r.to_stage,
      application_id: r.application_id,
      candidate_id: r.candidate_id,
      candidate_name: r.candidate_id ? map[r.candidate_id] ?? null : null,
      created_at: r.created_at,
    }));
  });

export const listJobInterviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ jobId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(100) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ats_interviews")
      .select(
        "id, application_id, candidate_id, interviewer_id, stage_value, kind, status, scheduled_at, duration_min, meet_url, location",
      )
      .eq("job_id", data.jobId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    type Row = {
      id: string;
      application_id: string;
      candidate_id: string;
      interviewer_id: string | null;
      stage_value: string | null;
      kind: string | null;
      status: string;
      scheduled_at: string | null;
      duration_min: number | null;
      meet_url: string | null;
      location: string | null;
    };
    const candIds = Array.from(
      new Set(((rows ?? []) as unknown as Row[]).map((r) => r.candidate_id)),
    );
    const map: Record<string, string> = {};
    if (candIds.length) {
      const { data: cs } = await supabase
        .from("ats_candidates")
        .select("id, full_name")
        .in("id", candIds);
      for (const c of (cs ?? []) as Array<{ id: string; full_name: string }>) {
        map[c.id] = c.full_name;
      }
    }
    return ((rows ?? []) as unknown as Row[]).map((r) => ({
      ...r,
      candidate_name: map[r.candidate_id] ?? null,
    }));
  });


// ---------- patches leves (DnD nos kanbans) --------------------------------

export const setAtsJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "published", "on_hold", "filled", "closed"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "published") patch.opened_at = new Date().toISOString();
    const { error } = await supabase
      .from("ats_jobs")
      .update(patch as never)
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    if (data.status === "published") {
      await emitEvent(supabase, {
        ownerId: userId,
        eventName: "ats.job.opened",
        entityType: "ats_job",
        entityId: data.id,
        dedupeKey: `ats.job.opened:${data.id}`,
        payload: { jobId: data.id },
      }).catch(() => undefined);
    }
    return { id: data.id, status: data.status };
  });

export const setAtsJobDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        department: z.string().trim().min(1).max(120).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cur, error: readErr } = await supabase
      .from("ats_jobs")
      .select("metadata")
      .eq("id", data.id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const metaSrc =
      (cur?.metadata as Record<string, unknown> | null | undefined) ?? {};
    const next: Record<string, unknown> = { ...metaSrc };
    if (data.department === null) {
      delete next.department;
    } else {
      next.department = data.department;
    }
    const { error } = await supabase
      .from("ats_jobs")
      .update({ metadata: next } as never)
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { id: data.id, department: data.department };
  });

export const setCandidateArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ats_candidates")
      .update({ archived: data.archived } as never)
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { id: data.id, archived: data.archived };
  });

