// Server functions de Entrevistas do ATS (Fase 2 — Onda A).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAtsEvent } from "./audit.server";

const KindEnum = z.enum(["phone", "video", "onsite", "async"]);
const StatusEnum = z.enum([
  "scheduled",
  "done",
  "no_show",
  "canceled",
  "rescheduled",
  "pending_candidate",
]);

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function recordEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  args: {
    ownerId: string;
    applicationId: string;
    jobId: string;
    candidateId: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase
    .from("ats_application_events")
    .insert({
      owner_id: args.ownerId,
      application_id: args.applicationId,
      job_id: args.jobId,
      candidate_id: args.candidateId,
      event_type: args.eventType,
      actor_id: args.ownerId,
      metadata: args.metadata ?? null,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

// ---------- listar -----------------------------------------------------------

export const listInterviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ application_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ats_interviews")
      .select(
        "id, kind, status, scheduled_at, duration_min, meet_url, location, notes, interviewer_id, self_schedule_token, self_schedule_expires_at, meeting_id, created_at",
      )
      .eq("application_id", data.application_id)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- agendar manual --------------------------------------------------

export const scheduleInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        interviewer_id: z.string().uuid().nullable().optional(),
        kind: KindEnum.default("video"),
        scheduled_at: z.string().datetime(),
        duration_min: z.number().int().min(5).max(480).default(45),
        meet_url: z.string().url().nullable().optional(),
        location: z.string().max(240).nullable().optional(),
        notes: z.string().max(4000).nullable().optional(),
        stage_value: z.string().max(80).nullable().optional(),
        interview_kit_id: z.string().uuid().nullable().optional(),
        panel_interviewer_ids: z.array(z.string().uuid()).max(8).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: app, error: aErr } = await supabase
      .from("ats_applications")
      .select("id, job_id, candidate_id, stage_value")
      .eq("id", data.application_id)
      .single();
    if (aErr || !app) throw new Error(aErr?.message || "Candidatura não encontrada");

    // snapshot de perguntas do kit (se houver)
    let snapshot: unknown = null;
    if (data.interview_kit_id) {
      const { data: kit } = await supabase
        .from("ats_interview_kits")
        .select("questions")
        .eq("owner_id", userId)
        .eq("id", data.interview_kit_id)
        .maybeSingle();
      snapshot = kit?.questions ?? null;
    }

    const { data: ins, error } = await supabase
      .from("ats_interviews")
      .insert({
        owner_id: userId,
        application_id: data.application_id,
        job_id: app.job_id as string,
        candidate_id: app.candidate_id as string,
        interviewer_id: data.interviewer_id ?? userId,
        kind: data.kind,
        status: "scheduled",
        scheduled_at: data.scheduled_at,
        duration_min: data.duration_min,
        meet_url: data.meet_url ?? null,
        location: data.location ?? null,
        notes: data.notes ?? null,
        stage_value: data.stage_value ?? (app.stage_value as string | null),
        interview_kit_id: data.interview_kit_id ?? null,
        async_questions_snapshot: snapshot as never,
        panel_interviewer_ids: (data.panel_interviewer_ids ?? []) as never,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await recordEvent(supabase, {
      ownerId: userId,
      applicationId: data.application_id,
      jobId: app.job_id as string,
      candidateId: app.candidate_id as string,
      eventType: "interview_scheduled",
      metadata: {
        interview_id: ins.id,
        kind: data.kind,
        scheduled_at: data.scheduled_at,
      },
    });
    await recordAtsEvent(supabase, {
      ownerId: userId,
      name: "ats.interview.scheduled",
      entityType: "interview",
      entityId: ins.id as string,
      payload: {
        applicationId: data.application_id,
        candidateId: app.candidate_id as string,
        jobId: app.job_id as string,
        scheduledAt: data.scheduled_at,
        kind: data.kind,
        source: "manual",
      },
    }).catch(() => undefined);
    return { id: ins.id as string };
  });

// ---------- reagendar -------------------------------------------------------

export const rescheduleInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        scheduled_at: z.string().datetime(),
        duration_min: z.number().int().min(5).max(480).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cur, error: cErr } = await supabase
      .from("ats_interviews")
      .select("application_id, job_id, candidate_id, scheduled_at")
      .eq("id", data.id)
      .single();
    if (cErr || !cur) throw new Error(cErr?.message || "Entrevista não encontrada");

    const patch: Record<string, unknown> = {
      scheduled_at: data.scheduled_at,
      status: "scheduled",
      reminder_d1_sent_at: null,
      reminder_1h_sent_at: null,
    };
    if (data.duration_min !== undefined) patch.duration_min = data.duration_min;

    const { error } = await supabase
      .from("ats_interviews")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await recordEvent(supabase, {
      ownerId: userId,
      applicationId: cur.application_id as string,
      jobId: cur.job_id as string,
      candidateId: cur.candidate_id as string,
      eventType: "interview_rescheduled",
      metadata: { interview_id: data.id, from: cur.scheduled_at, to: data.scheduled_at },
    });
    return { ok: true };
  });

// ---------- cancelar --------------------------------------------------------

export const cancelInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase
      .from("ats_interviews")
      .select("application_id, job_id, candidate_id")
      .eq("id", data.id)
      .single();
    if (!cur) throw new Error("Entrevista não encontrada");
    const { error } = await supabase
      .from("ats_interviews")
      .update({ status: "canceled" } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordEvent(supabase, {
      ownerId: userId,
      applicationId: cur.application_id as string,
      jobId: cur.job_id as string,
      candidateId: cur.candidate_id as string,
      eventType: "interview_canceled",
      metadata: { interview_id: data.id, reason: data.reason ?? null },
    });
    return { ok: true };
  });

// ---------- marcar como realizada ------------------------------------------

export const markInterviewStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["done", "no_show"]),
        notes: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase
      .from("ats_interviews")
      .select("application_id, job_id, candidate_id")
      .eq("id", data.id)
      .single();
    if (!cur) throw new Error("Entrevista não encontrada");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await supabase
      .from("ats_interviews")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordEvent(supabase, {
      ownerId: userId,
      applicationId: cur.application_id as string,
      jobId: cur.job_id as string,
      candidateId: cur.candidate_id as string,
      eventType: data.status === "done" ? "interview_completed" : "interview_no_show",
      metadata: { interview_id: data.id },
    });
    return { ok: true };
  });

// ---------- gerar link de auto-agendamento ---------------------------------

export const createSelfScheduleLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        interviewer_id: z.string().uuid().nullable().optional(),
        kind: KindEnum.default("video"),
        duration_min: z.number().int().min(5).max(480).default(45),
        slots: z.array(z.string().datetime()).min(1).max(20).optional(),
        expires_in_days: z.number().int().min(1).max(30).default(7),
        notes: z.string().max(4000).nullable().optional(),
        interview_kit_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: app, error: aErr } = await supabase
      .from("ats_applications")
      .select("id, job_id, candidate_id, stage_value")
      .eq("id", data.application_id)
      .single();
    if (aErr || !app) throw new Error(aErr?.message || "Candidatura não encontrada");

    let snapshot: unknown = null;
    if (data.interview_kit_id) {
      const { data: kit } = await supabase
        .from("ats_interview_kits")
        .select("questions")
        .eq("owner_id", userId)
        .eq("id", data.interview_kit_id)
        .maybeSingle();
      snapshot = kit?.questions ?? null;
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + data.expires_in_days * 86400_000).toISOString();
    const { data: ins, error } = await supabase
      .from("ats_interviews")
      .insert({
        owner_id: userId,
        application_id: data.application_id,
        job_id: app.job_id as string,
        candidate_id: app.candidate_id as string,
        interviewer_id: data.interviewer_id ?? userId,
        kind: data.kind,
        status: "pending_candidate",
        duration_min: data.duration_min,
        notes: data.notes ?? null,
        stage_value: app.stage_value as string | null,
        self_schedule_token: token,
        self_schedule_expires_at: expiresAt,
        slots: (data.slots ?? []) as never,
        interview_kit_id: data.interview_kit_id ?? null,
        async_questions_snapshot: snapshot as never,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await recordEvent(supabase, {
      ownerId: userId,
      applicationId: data.application_id,
      jobId: app.job_id as string,
      candidateId: app.candidate_id as string,
      eventType: "interview_link_sent",
      metadata: { interview_id: ins.id, slots: data.slots?.length ?? 0, kind: data.kind },
    });
    return { id: ins.id as string, token };
  });
