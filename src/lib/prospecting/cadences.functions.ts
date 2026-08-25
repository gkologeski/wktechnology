/**
 * Suíte de Prospecção — Cadências multi-canal unificadas.
 *
 * Engine própria (sales/hr) com passos email/whatsapp/linkedin/call/task/wait.
 * O tick de execução vive fora deste arquivo; aqui expomos apenas o CRUD e a
 * inscrição de leads/contatos/candidatos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAnyPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import {
  CADENCES_CREATE,
  CADENCES_DELETE,
  CADENCES_UPDATE,
  asKeys,
} from "@/lib/prospecting/permission-keys";

const SCOPE = z.enum(["sales", "hr"]);
const ENTITY = z.enum(["lead", "contact", "candidate"]);
const CHANNEL = z.enum([
  "email",
  "whatsapp",
  "linkedin_task",
  "linkedin_invite",
  "linkedin_message",
  "call",
  "task",
  "wait",
  "wait_invite_accept",
]);
const ON_TIMEOUT = z.enum(["skip_messages", "end_sequence", "continue"]);

export const listCadences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prospecting_cadences")
      .select("id, name, description, enabled, scope, queue_id, timezone, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const [{ data: cadence }, { data: steps }, { data: enrollments }] = await Promise.all([
      context.supabase.from("prospecting_cadences").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("prospecting_cadence_steps")
        .select("*")
        .eq("cadence_id", data.id)
        .order("step_order", { ascending: true }),
      context.supabase
        .from("prospecting_enrollments")
        .select(
          "id, entity, entity_id, status, current_step, next_run_at, started_at, finished_at, last_error",
        )
        .eq("cadence_id", data.id)
        .order("started_at", { ascending: false })
        .limit(200),
    ]);
    if (!cadence) throw new Error("Cadência não encontrada");
    return { cadence, steps: steps ?? [], enrollments: enrollments ?? [] };
  });

export const upsertCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).nullable().optional(),
        enabled: z.boolean().default(true),
        scope: SCOPE.default("sales"),
        queue_id: z.string().uuid().nullable().optional(),
        timezone: z.string().max(64).default("America/Sao_Paulo"),
        quiet_hours_start: z.number().int().min(0).max(23).nullable().optional(),
        quiet_hours_end: z.number().int().min(0).max(23).nullable().optional(),
        daily_send_limit: z.number().int().min(0).max(10000).nullable().optional(),
        send_days: z.array(z.number().int().min(0).max(6)).max(7).default([1, 2, 3, 4, 5]),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(
      context.supabase,
      context.userId,
      ws,
      asKeys(data.id ? CADENCES_UPDATE : CADENCES_CREATE),
    );
    const payload = {
      owner_id: context.userId,
      name: data.name,
      description: data.description ?? null,
      enabled: data.enabled,
      scope: data.scope,
      queue_id: data.queue_id ?? null,
      timezone: data.timezone,
      quiet_hours_start: data.quiet_hours_start ?? null,
      quiet_hours_end: data.quiet_hours_end ?? null,
      daily_send_limit: data.daily_send_limit ?? null,
      send_days: data.send_days,
    } as never;
    if (data.id) {
      // Não sobrescreve owner_id ao editar registro de outro usuário.
      const { owner_id: _owner, ...updatable } = payload as Record<string, unknown>;
      const { error } = await context.supabase
        .from("prospecting_cadences")
        .update(updatable as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("prospecting_cadences")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(CADENCES_DELETE));
    const { error } = await context.supabase
      .from("prospecting_cadences")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertCadenceStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        cadence_id: z.string().uuid(),
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
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(CADENCES_UPDATE));
    const isWaitAccept = data.channel === "wait_invite_accept";
    const row = {
      ...(data.id ? { id: data.id } : {}),
      cadence_id: data.cadence_id,
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
    } as never;
    // Passo existente: atualiza pelo id (a ordem pode mudar em reordenações).
    if (data.id) {
      const { error: updErr } = await context.supabase
        .from("prospecting_cadence_steps")
        .update(row)
        .eq("id", data.id);
      if (updErr) throw new Error(updErr.message);
      return { id: data.id };
    }
    const { data: saved, error } = await context.supabase
      .from("prospecting_cadence_steps")
      .upsert(row, { onConflict: "cadence_id,step_order,variant_label" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id };
  });

export const deleteCadenceStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertAnyPermission(context.supabase, context.userId, ws, asKeys(CADENCES_UPDATE));
    const { error } = await context.supabase
      .from("prospecting_cadence_steps")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const enrollEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        cadence_id: z.string().uuid(),
        entity: ENTITY,
        entity_ids: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const rows = data.entity_ids.map((eid) => ({
      cadence_id: data.cadence_id,
      owner_id: context.userId,
      entity: data.entity,
      entity_id: eid,
      status: "active",
      current_step: 0,
      next_run_at: new Date().toISOString(),
      started_by: context.userId,
    }));
    const { error } = await context.supabase
      .from("prospecting_enrollments")
      .upsert(rows as never, { onConflict: "cadence_id,entity,entity_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { enrolled: rows.length };
  });

export const stopEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        enrollment_id: z.string().uuid(),
        reason: z.enum(["paused", "stopped", "replied", "completed"]).default("stopped"),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("prospecting_enrollments")
      .update({
        status: data.reason,
        finished_at: data.reason === "paused" ? null : new Date().toISOString(),
      } as never)
      .eq("id", data.enrollment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
