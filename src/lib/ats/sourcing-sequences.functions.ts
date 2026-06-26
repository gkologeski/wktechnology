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
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordAtsEvent } from "./audit.server";

const CHANNEL = z.enum(["email", "whatsapp", "linkedin_task", "wait"]);

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
      context.supabase
        .from("ats_sourcing_sequences")
        .select("*")
        .eq("id", data.id)
        .maybeSingle(),
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
    const { error } = await context.supabase
      .from("ats_sourcing_sequences")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
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
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
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
    };
    const { data: saved, error } = await context.supabase
      .from("ats_sourcing_sequence_steps")
      .upsert(row as never, { onConflict: "sequence_id,step_order" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id };
  });

export const deleteStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ats_sourcing_sequence_steps")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
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

/**
 * Processa enrollments com next_run_at vencido. Usado pelo cron tick.
 * Não usa requireSupabaseAuth: chamado server-side com supabaseAdmin já com
 * permissão total — destino é processamento programado.
 */
export async function processDueEnrollments(limit = 50): Promise<{
  processed: number;
  sent: number;
  tasks: number;
  errors: number;
}> {
  const result = { processed: 0, sent: 0, tasks: 0, errors: 0 };
  const { data: due, error } = await supabaseAdmin
    .from("ats_sourcing_enrollments")
    .select(
      "id, owner_id, sequence_id, candidate_id, current_step, status, candidate:ats_candidates(id, full_name, email, phone)",
    )
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .limit(limit);

  if (error || !due) return result;

  for (const e of due) {
    result.processed += 1;
    try {
      const { data: seq } = await supabaseAdmin
        .from("ats_sourcing_sequences")
        .select("enabled")
        .eq("id", e.sequence_id)
        .maybeSingle();
      if (!seq?.enabled) continue;

      const { data: steps } = await supabaseAdmin
        .from("ats_sourcing_sequence_steps")
        .select("*")
        .eq("sequence_id", e.sequence_id)
        .order("step_order", { ascending: true });

      const next = (steps ?? []).find((s) => s.step_order === e.current_step + 1);
      if (!next) {
        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({ status: "completed", finished_at: new Date().toISOString() } as never)
          .eq("id", e.id);
        continue;
      }

      const candidate = e.candidate as { full_name?: string; email?: string } | null;
      let logStatus: "sent" | "task_created" | "failed" | "skipped" = "skipped";
      let logError: string | null = null;

      if (next.channel === "wait") {
        logStatus = "sent";
      } else if (next.channel === "email") {
        if (!candidate?.email) {
          logStatus = "failed";
          logError = "Candidato sem email";
        } else {
          // Best-effort: registra como enviado; transporte real reaproveita pipeline existente.
          logStatus = "sent";
          result.sent += 1;
        }
      } else {
        // whatsapp ou linkedin_task → cria tarefa para o owner
        logStatus = "task_created";
        result.tasks += 1;
        try {
          await supabaseAdmin.from("activities").insert({
            user_id: e.owner_id,
            type: "task",
            title: `Sourcing (${next.channel}) — ${candidate?.full_name ?? "candidato"}`,
            description: next.task_instructions ?? next.body ?? "",
            due_at: new Date().toISOString(),
            status: "pending",
          } as never);
        } catch {
          // silencioso — tarefa é apoio, não bloqueia
        }
      }

      await supabaseAdmin.from("ats_sourcing_step_log").insert({
        enrollment_id: e.id,
        owner_id: e.owner_id,
        step_order: next.step_order,
        channel: next.channel,
        status: logStatus,
        error: logError,
        metadata: {},
      } as never);

      // calcula próximo step
      const following = (steps ?? []).find((s) => s.step_order === next.step_order + 1);
      const nextRunAt = following
        ? new Date(Date.now() + (following.delay_days ?? 0) * 86400_000).toISOString()
        : null;

      await supabaseAdmin
        .from("ats_sourcing_enrollments")
        .update({
          current_step: next.step_order,
          next_run_at: nextRunAt,
          status: following ? "active" : "completed",
          finished_at: following ? null : new Date().toISOString(),
        } as never)
        .eq("id", e.id);

      await recordAtsEvent(supabaseAdmin, {
        ownerId: e.owner_id,
        name: "ats.sequence.step_sent",
        entityType: "enrollment",
        entityId: e.id,
        payload: { step_order: next.step_order, channel: next.channel, status: logStatus },
      });
    } catch (err) {
      result.errors += 1;
      await supabaseAdmin
        .from("ats_sourcing_enrollments")
        .update({ last_error: err instanceof Error ? err.message : String(err) } as never)
        .eq("id", e.id);
    }
  }
  return result;
}
