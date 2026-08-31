/**
 * Sourcing Sequences — Onda 5 / Slice 2 / Fase 2.
 *
 * Cadências multi-step (email/whatsapp/linkedin_task/wait) com inscrição por
 * candidato e tick periódico que avança steps elegíveis. WhatsApp/LinkedIn são
 * registrados como tarefas para execução manual; email usa o transporte do
 * workspace (sendLovableEmail).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAtsEvent } from "./audit.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const CHANNEL = z.enum([
  "email",
  "whatsapp",
  "linkedin_task",
  "linkedin_invite",
  "linkedin_message",
  "wait",
  "wait_invite_accept",
]);

const ON_TIMEOUT = z.enum(["skip_messages", "end_sequence", "continue"]);

export const listSequences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ats_sourcing_sequences")
      .select("id, name, description, enabled, pool_id, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { sequences: data ?? [] };
  });

export const getSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const [{ data: seq }, { data: steps }, { data: enrollments }] = await Promise.all([
      context.supabase.from("ats_sourcing_sequences").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("ats_sourcing_sequence_steps")
        .select("*")
        .eq("sequence_id", data.id)
        .order("step_order", { ascending: true }),
      context.supabase
        .from("ats_sourcing_enrollments")
        .select(
          "id, status, current_step, next_run_at, started_at, finished_at, last_error, candidate:ats_candidates(id, full_name, email)",
        )
        .eq("sequence_id", data.id)
        .order("started_at", { ascending: false })
        .limit(200),
    ]);
    if (!seq) throw new Error("Sequência não encontrada");
    return { sequence: seq, steps: steps ?? [], enrollments: enrollments ?? [] };
  });

export const createSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        pool_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("ats_sourcing_sequences")
      .insert({
        owner_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        pool_id: data.pool_id ?? null,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(500).nullable().optional(),
        enabled: z.boolean().optional(),
        pool_id: z.string().uuid().nullable().optional(),
        daily_send_limit: z.number().int().min(0).max(10000).nullable().optional(),
        quiet_hours_start: z.number().int().min(0).max(23).nullable().optional(),
        quiet_hours_end: z.number().int().min(0).max(23).nullable().optional(),
        timezone: z.string().min(1).max(64).optional(),
        send_days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("ats_sourcing_sequences")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await deleteByIdGuarded(
      context.supabase,
      "ats_sourcing_sequences",
      data.id,
      "Você não tem permissão para excluir esta cadência.",
    );
    return { ok: true };
  });

export const upsertStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        sequence_id: z.string().uuid(),
        step_order: z.number().int().min(1).max(50),
        channel: CHANNEL,
        delay_days: z.number().int().min(0).max(180).default(0),
        subject: z.string().max(200).nullable().optional(),
        body: z.string().max(10000).nullable().optional(),
        task_instructions: z.string().max(2000).nullable().optional(),
        variant_label: z.string().min(1).max(8).default("A"),
        variant_weight: z.number().int().min(1).max(100).default(1),
        max_wait_days: z.number().int().min(1).max(30).nullable().optional(),
        poll_interval_hours: z.number().int().min(6).max(48).nullable().optional(),
        on_timeout: ON_TIMEOUT.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const isWaitAccept = data.channel === "wait_invite_accept";
    const row = {
      ...(data.id ? { id: data.id } : {}),
      sequence_id: data.sequence_id,
      owner_id: context.userId,
      step_order: data.step_order,
      channel: data.channel,
      delay_days: data.delay_days,
      subject: data.subject ?? null,
      body: data.body ?? null,
      task_instructions: data.task_instructions ?? null,
      variant_label: data.variant_label,
      variant_weight: data.variant_weight,
      max_wait_days: isWaitAccept ? (data.max_wait_days ?? 14) : null,
      poll_interval_hours: isWaitAccept ? (data.poll_interval_hours ?? 12) : null,
      on_timeout: isWaitAccept ? (data.on_timeout ?? "end_sequence") : null,
    };
    const { data: saved, error } = await context.supabase
      .from("ats_sourcing_sequence_steps")
      .upsert(row as never, { onConflict: "sequence_id,step_order,variant_label" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id };
  });

export const deleteStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await deleteByIdGuarded(
      context.supabase,
      "ats_sourcing_sequence_steps",
      data.id,
      "Você não tem permissão para excluir este passo da cadência.",
    );
    return { ok: true };
  });

export const enrollCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sequence_id: z.string().uuid(),
        candidate_ids: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const rows = data.candidate_ids.map((cid) => ({
      sequence_id: data.sequence_id,
      candidate_id: cid,
      owner_id: context.userId,
      status: "active",
      current_step: 0,
      next_run_at: new Date().toISOString(),
      started_by: context.userId,
    }));
    const { error } = await context.supabase
      .from("ats_sourcing_enrollments")
      .upsert(rows as never, { onConflict: "sequence_id,candidate_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    for (const cid of data.candidate_ids) {
      await recordAtsEvent(context.supabase, {
        ownerId: context.userId,
        name: "ats.sequence.started",
        entityType: "enrollment",
        entityId: cid,
        payload: { sequence_id: data.sequence_id },
      });
    }
    return { enrolled: rows.length };
  });

export const stopEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enrollment_id: z.string().uuid(),
        reason: z.enum(["paused", "stopped", "replied"]).default("stopped"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ats_sourcing_enrollments")
      .update({
        status: data.reason,
        finished_at: data.reason === "stopped" ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.enrollment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
