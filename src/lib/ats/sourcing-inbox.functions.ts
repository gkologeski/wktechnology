/**
 * Sourcing Inbox — Onda 5 / Slice 2 / Fase 3.
 *
 * Caixa unificada de triagem para sequências em andamento:
 *  - Tarefas manuais pendentes (WhatsApp / LinkedIn) geradas pelos steps;
 *  - Falhas de envio (status="failed" no step_log ou enrollments.last_error);
 *  - Enrollments aguardando intervenção (paused / replied).
 *
 * Todas as ações respeitam RLS via `requireSupabaseAuth`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAtsEvent } from "./audit.server";

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];
type Json = { [k: string]: JsonValue };

type StepLogRow = {
  id: string;
  enrollment_id: string;
  step_order: number;
  channel: string;
  status: string;
  error: string | null;
  metadata: Json | null;
  created_at: string;
};

type EnrollmentRow = {
  id: string;
  status: string;
  current_step: number;
  next_run_at: string | null;
  last_error: string | null;
  started_at: string;
  finished_at: string | null;
  sequence_id: string;
  candidate_id: string;
};

type CandidateRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type SequenceRow = { id: string; name: string };

export const listInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    // 1) últimos 200 logs de step e enrollments ativos/aguardando
    const [{ data: logs }, { data: enrollments }] = await Promise.all([
      supabase
        .from("ats_sourcing_step_log")
        .select("id, enrollment_id, step_order, channel, status, error, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("ats_sourcing_enrollments")
        .select(
          "id, status, current_step, next_run_at, last_error, started_at, finished_at, sequence_id, candidate_id",
        )
        .in("status", ["active", "paused", "replied"])
        .order("started_at", { ascending: false })
        .limit(200),
    ]);

    const stepLogs = (logs ?? []) as StepLogRow[];
    const enrolls = (enrollments ?? []) as EnrollmentRow[];

    // hidrata candidatos + sequências em batch
    const candidateIds = Array.from(new Set(enrolls.map((e) => e.candidate_id)));
    const sequenceIds = Array.from(new Set(enrolls.map((e) => e.sequence_id)));

    const [{ data: candidates }, { data: sequences }] = await Promise.all([
      candidateIds.length
        ? supabase
            .from("ats_candidates")
            .select("id, full_name, email, phone")
            .in("id", candidateIds)
        : Promise.resolve({ data: [] as CandidateRow[] }),
      sequenceIds.length
        ? supabase.from("ats_sourcing_sequences").select("id, name").in("id", sequenceIds)
        : Promise.resolve({ data: [] as SequenceRow[] }),
    ]);

    const candById = new Map<string, CandidateRow>(
      ((candidates ?? []) as CandidateRow[]).map((c) => [c.id, c]),
    );
    const seqById = new Map<string, SequenceRow>(
      ((sequences ?? []) as SequenceRow[]).map((s) => [s.id, s]),
    );
    const enrById = new Map<string, EnrollmentRow>(enrolls.map((e) => [e.id, e]));

    const enrich = (e: EnrollmentRow) => ({
      enrollment: e,
      candidate: candById.get(e.candidate_id) ?? null,
      sequence: seqById.get(e.sequence_id) ?? null,
    });

    // 2) tasks pendentes: step_log task_created sem metadata.handled_at
    const pendingTasks = stepLogs
      .filter(
        (l) =>
          l.status === "task_created" &&
          (l.channel === "whatsapp" || l.channel === "linkedin_task") &&
          !(l.metadata && (l.metadata as Json).handled_at),
      )
      .map((l) => {
        const e = enrById.get(l.enrollment_id);
        return e ? { log: l, ...enrich(e) } : null;
      })
      .filter(Boolean);

    // 3) failures: step_log failed (últimos 50) + enrollments com last_error
    const failures = [
      ...stepLogs
        .filter((l) => l.status === "failed")
        .slice(0, 50)
        .map((l) => {
          const e = enrById.get(l.enrollment_id);
          return e ? { log: l, ...enrich(e) } : null;
        })
        .filter(Boolean),
    ];

    // 4) replied/paused: enrollments que precisam decisão humana
    const needsReview = enrolls
      .filter((e) => e.status === "paused" || e.status === "replied" || e.last_error)
      .map(enrich);

    return {
      pendingTasks,
      failures,
      needsReview,
      counts: {
        tasks: pendingTasks.length,
        failures: failures.length,
        review: needsReview.length,
      },
    };
  });

export const markStepHandled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ log_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("ats_sourcing_step_log")
      .select("metadata, enrollment_id, step_order, channel")
      .eq("id", data.log_id)
      .maybeSingle();
    if (!row) throw new Error("Log não encontrado");
    const metadata = { ...((row.metadata as Json) ?? {}), handled_at: new Date().toISOString() };
    const { error } = await context.supabase
      .from("ats_sourcing_step_log")
      .update({ metadata } as never)
      .eq("id", data.log_id);
    if (error) throw new Error(error.message);
    await recordAtsEvent(context.supabase, {
      ownerId: context.userId,
      name: "ats.sequence.step_sent",
      entityType: "enrollment",
      entityId: row.enrollment_id,
      payload: { handled: true, channel: row.channel, step: row.step_order, log_id: data.log_id },
    });

    return { ok: true };
  });

export const resumeEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enrollment_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ats_sourcing_enrollments")
      .update({
        status: "active",
        next_run_at: new Date().toISOString(),
        last_error: null,
        finished_at: null,
      } as never)
      .eq("id", data.enrollment_id);
    if (error) throw new Error(error.message);
    await recordAtsEvent(context.supabase, {
      ownerId: context.userId,
      name: "ats.sequence.resumed",
      entityType: "enrollment",
      entityId: data.enrollment_id,
      payload: {},
    });
    return { ok: true };
  });

/**
 * Fase 4 — Inbound Replies.
 * Marca um enrollment como "replied" manualmente (WhatsApp/LinkedIn) e
 * registra um step_log de canal `inbound` para auditoria.
 */
export const markCandidateReplied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enrollment_id: z.string().uuid(),
        channel: z.enum(["whatsapp", "linkedin_task", "email", "inbound"]).default("inbound"),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: enrollment, error: fetchErr } = await supabase
      .from("ats_sourcing_enrollments")
      .select("id, current_step, owner_id, candidate_id")
      .eq("id", data.enrollment_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!enrollment) throw new Error("Enrollment não encontrado");

    const nowIso = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("ats_sourcing_enrollments")
      .update({
        status: "replied",
        finished_at: nowIso,
        last_error: null,
      } as never)
      .eq("id", data.enrollment_id);
    if (upErr) throw new Error(upErr.message);

    await supabase.from("ats_sourcing_step_log").insert({
      enrollment_id: data.enrollment_id,
      owner_id: userId,
      step_order: enrollment.current_step ?? 0,
      channel: data.channel,
      status: "replied",
      metadata: { source: "manual", note: data.note ?? null, at: nowIso } as never,
    } as never);

    await recordAtsEvent(context.supabase, {
      ownerId: userId,
      name: "ats.sequence.replied",
      entityType: "enrollment",
      entityId: data.enrollment_id,
      payload: { channel: data.channel, source: "manual" },
    });

    return { ok: true };
  });
