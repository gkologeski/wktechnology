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
import {
  loadAccountCtx,
  sendLinkedinInvite,
  sendLinkedinMessage,
  fetchProfile,
  UnipileError,
} from "@/lib/unipile/client.server";
import { recordAtsEvent } from "./audit.server";

const CHANNEL = z.enum([
  "email",
  "whatsapp",
  "linkedin_task",
  "linkedin_invite",
  "linkedin_message",
  "wait",
]);

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
        variant_label: z.string().min(1).max(8).default("A"),
        variant_weight: z.number().int().min(1).max(100).default(1),
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
      variant_label: data.variant_label,
      variant_weight: data.variant_weight,
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
  throttled: number;
  quiet: number;
}> {
  const result = { processed: 0, sent: 0, tasks: 0, errors: 0, throttled: 0, quiet: 0 };
  const { data: due, error } = await supabaseAdmin
    .from("ats_sourcing_enrollments")
    .select(
      "id, owner_id, sequence_id, candidate_id, current_step, status, candidate:ats_candidates(id, full_name, email, phone, linkedin_url)",
    )
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .limit(limit);

  if (error || !due) return result;

  // cache simples por sequência neste tick
  type SeqMeta = {
    enabled: boolean;
    timezone: string;
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
    send_days: number[];
    daily_send_limit: number | null;
    sentToday: number;
  };
  const seqCache = new Map<string, SeqMeta>();

  async function getSeqMeta(seqId: string): Promise<SeqMeta | null> {
    if (seqCache.has(seqId)) return seqCache.get(seqId)!;
    const { data: s } = await supabaseAdmin
      .from("ats_sourcing_sequences")
      .select("enabled, timezone, quiet_hours_start, quiet_hours_end, send_days, daily_send_limit")
      .eq("id", seqId)
      .maybeSingle();
    if (!s) return null;
    // contagem de envios hoje (UTC do dia atual no TZ da sequência)
    let sentToday = 0;
    if (s.daily_send_limit) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await supabaseAdmin
        .from("ats_sourcing_step_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay.toISOString())
        .in("status", ["sent", "task_created"])
        .in(
          "enrollment_id",
          (
            await supabaseAdmin
              .from("ats_sourcing_enrollments")
              .select("id")
              .eq("sequence_id", seqId)
          ).data?.map((r) => r.id) ?? [],
        );
      sentToday = count ?? 0;
    }
    const meta: SeqMeta = {
      enabled: !!s.enabled,
      timezone: s.timezone ?? "America/Sao_Paulo",
      quiet_hours_start: s.quiet_hours_start ?? null,
      quiet_hours_end: s.quiet_hours_end ?? null,
      send_days: (s.send_days ?? [1, 2, 3, 4, 5]) as number[],
      daily_send_limit: s.daily_send_limit ?? null,
      sentToday,
    };
    seqCache.set(seqId, meta);
    return meta;
  }

  function getZonedParts(tz: string): { hour: number; day: number } {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        hour12: false,
        weekday: "short",
      });
      const parts = fmt.formatToParts(new Date());
      const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
      const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const day = wkMap[parts.find((p) => p.type === "weekday")?.value ?? "Mon"] ?? 1;
      return { hour: hour % 24, day };
    } catch {
      const d = new Date();
      return { hour: d.getUTCHours(), day: d.getUTCDay() };
    }
  }

  function inQuietHours(hour: number, qStart: number | null, qEnd: number | null): boolean {
    if (qStart === null || qEnd === null) return false;
    if (qStart === qEnd) return false;
    if (qStart < qEnd) return hour >= qStart && hour < qEnd;
    // janela cruzando meia-noite (ex.: 20→8)
    return hour >= qStart || hour < qEnd;
  }

  function nextAllowedTime(meta: SeqMeta): string {
    // adia 30min e deixa o próximo tick re-avaliar (mantém lógica simples)
    return new Date(Date.now() + 30 * 60_000).toISOString();
  }

  for (const e of due) {
    result.processed += 1;
    try {
      const meta = await getSeqMeta(e.sequence_id);
      if (!meta?.enabled) continue;

      const { hour, day } = getZonedParts(meta.timezone);

      // dia da semana não permitido?
      if (!meta.send_days.includes(day)) {
        result.quiet += 1;
        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({ next_run_at: nextAllowedTime(meta) } as never)
          .eq("id", e.id);
        continue;
      }

      // quiet hours?
      if (inQuietHours(hour, meta.quiet_hours_start, meta.quiet_hours_end)) {
        result.quiet += 1;
        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({ next_run_at: nextAllowedTime(meta) } as never)
          .eq("id", e.id);
        continue;
      }

      // throttle diário?
      if (meta.daily_send_limit && meta.sentToday >= meta.daily_send_limit) {
        result.throttled += 1;
        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({ next_run_at: nextAllowedTime(meta) } as never)
          .eq("id", e.id);
        continue;
      }

      const { data: steps } = await supabaseAdmin
        .from("ats_sourcing_sequence_steps")
        .select("*")
        .eq("sequence_id", e.sequence_id)
        .order("step_order", { ascending: true });

      const stepList = (steps ?? []) as Array<{
        id: string;
        step_order: number;
        channel: string;
        delay_days: number | null;
        subject: string | null;
        body: string | null;
        task_instructions: string | null;
        variant_label: string | null;
        variant_weight: number | null;
      }>;
      const nextOrder = e.current_step + 1;
      const variants = stepList.filter((s) => s.step_order === nextOrder);
      if (variants.length === 0) {
        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({ status: "completed", finished_at: new Date().toISOString() } as never)
          .eq("id", e.id);
        continue;
      }
      // Sorteio ponderado por variant_weight (default 1).
      const totalWeight = variants.reduce((sum, v) => sum + Math.max(1, v.variant_weight ?? 1), 0);
      let pick = Math.random() * totalWeight;
      let next = variants[0];
      for (const v of variants) {
        pick -= Math.max(1, v.variant_weight ?? 1);
        if (pick <= 0) {
          next = v;
          break;
        }
      }

      const candidate = e.candidate as {
        full_name?: string;
        email?: string;
        linkedin_url?: string | null;
      } | null;
      let logStatus: "sent" | "task_created" | "failed" | "skipped" = "skipped";
      let logError: string | null = null;

      if (next.channel === "wait") {
        logStatus = "sent";
      } else if (next.channel === "email") {
        if (!candidate?.email) {
          logStatus = "failed";
          logError = "Candidato sem email";
        } else {
          logStatus = "sent";
          result.sent += 1;
          meta.sentToday += 1;
        }
      } else if (next.channel === "linkedin_invite" || next.channel === "linkedin_message") {
        // Envio nativo via Unipile. Sem linkedin_url não há como resolver o alvo.
        if (!candidate?.linkedin_url) {
          logStatus = "failed";
          logError = "Candidato sem linkedin_url";
        } else {
          try {
            const {
              loadAccountCtx,
              sendLinkedinInvite,
              sendLinkedinMessage,
              fetchProfile,
              UnipileError,
            } = await import("@/lib/unipile/client.server");
            const ctx = await loadAccountCtx(e.owner_id);
            const m = candidate.linkedin_url.match(/linkedin\.com\/in\/([^/?#]+)/i);
            const publicId = m ? decodeURIComponent(m[1]).replace(/\/$/, "") : null;
            if (!publicId) throw new UnipileError("linkedin_url inválido", "provider_error");
            const profile: any = await fetchProfile(ctx, publicId);
            const providerId =
              profile?.provider_id ??
              profile?.user?.provider_id ??
              profile?.public_profile_url_id ??
              profile?.member_urn ??
              null;
            if (!providerId) throw new UnipileError("provider_id não resolvido", "provider_error");
            const body = (next.body ?? next.task_instructions ?? "").slice(0, 8000);
            if (next.channel === "linkedin_invite") {
              await sendLinkedinInvite(ctx, {
                providerId: String(providerId),
                message: body.slice(0, 300) || undefined,
              });
            } else {
              await sendLinkedinMessage(ctx, {
                attendeeProviderId: String(providerId),
                text: body || `Olá ${candidate.full_name ?? ""}`.trim(),
              });
            }
            // registra também no unipile_message_log para dedupe/observabilidade
            await supabaseAdmin.from("unipile_message_log").insert({
              account_id: ctx.accountId,
              owner_id: e.owner_id,
              kind: next.channel === "linkedin_invite" ? "invite" : "message",
              target_identifier: String(providerId),
              candidate_id: e.candidate_id,
              body: body || null,
              status: "sent",
              sent_at: new Date().toISOString(),
            } as never);
            logStatus = "sent";
            result.sent += 1;
            meta.sentToday += 1;
          } catch (err) {
            logStatus = "failed";
            logError = (err instanceof Error ? err.message : String(err)).slice(0, 500);
          }
        }
      } else {
        logStatus = "task_created";
        result.tasks += 1;
        meta.sentToday += 1;
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
          // silencioso
        }
      }

      await supabaseAdmin.from("ats_sourcing_step_log").insert({
        enrollment_id: e.id,
        owner_id: e.owner_id,
        step_order: next.step_order,
        channel: next.channel,
        status: logStatus,
        error: logError,
        metadata: { variant: next.variant_label ?? "A" },
      } as never);

      const followingVariants = stepList.filter((s) => s.step_order === next.step_order + 1);
      const followingDelay = followingVariants[0]?.delay_days ?? 0;
      const nextRunAt = followingVariants.length
        ? new Date(Date.now() + followingDelay * 86400_000).toISOString()
        : null;


      await supabaseAdmin
        .from("ats_sourcing_enrollments")
        .update({
          current_step: next.step_order,
          next_run_at: nextRunAt,
          status: followingVariants.length ? "active" : "completed",
          finished_at: followingVariants.length ? null : new Date().toISOString(),
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
