/**
 * Worker do sourcing (isolado em .server.ts para não poluir o bundle do browser
 * com dependências server-only — Unipile/node:crypto).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  loadAccountCtx,
  sendLinkedinInvite,
  sendLinkedinMessage,
  fetchProfile,
  UnipileError,
} from "@/lib/unipile/client.server";
import { recordAtsEvent } from "./audit.server";
import { renderTokens } from "@/lib/message-tokens";
import { loadAgentContext } from "@/lib/message-tokens-agent.server";

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
      "id, owner_id, sequence_id, candidate_id, current_step, status, waiting_since, candidate:ats_candidates(id, full_name, email, phone, linkedin_url, headline, current_company)",
    )
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .limit(limit);

  if (error || !due) return result;

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
      const wkMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
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
    return hour >= qStart || hour < qEnd;
  }

  function nextAllowedTime(_meta: SeqMeta): string {
    return new Date(Date.now() + 30 * 60_000).toISOString();
  }

  for (const e of due) {
    result.processed += 1;
    try {
      const meta = await getSeqMeta(e.sequence_id);
      if (!meta?.enabled) continue;

      const { hour, day } = getZonedParts(meta.timezone);

      if (!meta.send_days.includes(day)) {
        result.quiet += 1;
        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({ next_run_at: nextAllowedTime(meta) } as never)
          .eq("id", e.id);
        continue;
      }

      if (inQuietHours(hour, meta.quiet_hours_start, meta.quiet_hours_end)) {
        result.quiet += 1;
        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({ next_run_at: nextAllowedTime(meta) } as never)
          .eq("id", e.id);
        continue;
      }

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
        max_wait_days: number | null;
        poll_interval_hours: number | null;
        on_timeout: string | null;
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

      // ---- Gate: aguardar aceite do convite antes de avançar ----
      if (next.channel === "wait_invite_accept") {
        const maxWaitDays = next.max_wait_days ?? 14;
        const pollHours = Math.max(6, next.poll_interval_hours ?? 12);
        const onTimeout = (next.on_timeout ?? "end_sequence") as
          | "skip_messages"
          | "end_sequence"
          | "continue";

        // Localiza último convite enviado desta enrollment
        const { data: lastInvite } = await supabaseAdmin
          .from("unipile_message_log")
          .select("id, status, sent_at, accepted_at")
          .eq("candidate_id", e.candidate_id)
          .eq("owner_id", e.owner_id)
          .eq("kind", "invite")
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const inviteRow = lastInvite as {
          id: string;
          status: string;
          sent_at: string | null;
          accepted_at: string | null;
        } | null;

        if (inviteRow?.status === "accepted") {
          // Avança normalmente para o próximo step
          await supabaseAdmin.from("ats_sourcing_step_log").insert({
            enrollment_id: e.id,
            owner_id: e.owner_id,
            step_order: next.step_order,
            channel: next.channel,
            status: "sent",
            error: null,
            metadata: { accepted_at: inviteRow.accepted_at, gate: "invite_accepted" },
          } as never);

          const followingVariants = stepList.filter((s) => s.step_order === next.step_order + 1);
          const followingDelay = followingVariants[0]?.delay_days ?? 0;
          await supabaseAdmin
            .from("ats_sourcing_enrollments")
            .update({
              current_step: next.step_order,
              waiting_since: null,
              waiting_for_invite_log_id: null,
              next_run_at: followingVariants.length
                ? new Date(Date.now() + followingDelay * 86400_000).toISOString()
                : null,
              status: followingVariants.length ? "active" : "completed",
              finished_at: followingVariants.length ? null : new Date().toISOString(),
            } as never)
            .eq("id", e.id);
          continue;
        }

        const sentAt = inviteRow?.sent_at ? new Date(inviteRow.sent_at).getTime() : Date.now();
        const deadline = sentAt + maxWaitDays * 86400_000;

        if (!inviteRow || Date.now() < deadline) {
          // Ainda dentro da janela — reagenda poll
          const nextPoll = new Date(Date.now() + pollHours * 3600_000).toISOString();
          await supabaseAdmin
            .from("ats_sourcing_enrollments")
            .update({
              waiting_since: e.waiting_since ?? new Date().toISOString(),
              waiting_for_invite_log_id: inviteRow?.id ?? null,
              next_run_at: nextPoll,
            } as never)
            .eq("id", e.id);
          result.throttled += 1;
          continue;
        }

        // Timeout — aplica política
        await supabaseAdmin.from("ats_sourcing_step_log").insert({
          enrollment_id: e.id,
          owner_id: e.owner_id,
          step_order: next.step_order,
          channel: next.channel,
          status: "failed",
          error: "invite_not_accepted",
          metadata: { on_timeout: onTimeout, max_wait_days: maxWaitDays },
        } as never);

        if (onTimeout === "end_sequence") {
          await supabaseAdmin
            .from("ats_sourcing_enrollments")
            .update({
              status: "completed",
              finished_at: new Date().toISOString(),
              waiting_since: null,
              waiting_for_invite_log_id: null,
              last_error: "invite_not_accepted",
            } as never)
            .eq("id", e.id);
          continue;
        }

        // skip_messages: pula todos os próximos linkedin_message consecutivos
        let advanceTo = next.step_order;
        if (onTimeout === "skip_messages") {
          let cursor = next.step_order + 1;
          while (
            stepList.some((s) => s.step_order === cursor && s.channel === "linkedin_message")
          ) {
            cursor += 1;
          }
          advanceTo = cursor - 1;
        }

        const followingVariants = stepList.filter((s) => s.step_order === advanceTo + 1);
        const followingDelay = followingVariants[0]?.delay_days ?? 0;
        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({
            current_step: advanceTo,
            waiting_since: null,
            waiting_for_invite_log_id: null,
            next_run_at: followingVariants.length
              ? new Date(Date.now() + followingDelay * 86400_000).toISOString()
              : null,
            status: followingVariants.length ? "active" : "completed",
            finished_at: followingVariants.length ? null : new Date().toISOString(),
          } as never)
          .eq("id", e.id);
        continue;
      }

      const candidate = e.candidate as {
        full_name?: string;
        email?: string;
        linkedin_url?: string | null;
        headline?: string | null;
        current_company?: string | null;
      } | null;

      // Contexto das variáveis anunciadas na interface (candidato + remetente).
      const agent = await loadAgentContext(supabaseAdmin, e.owner_id);
      const candFirstName = (candidate?.full_name ?? "").split(" ")[0] || null;
      const tokenCtx = {
        first_name: candFirstName,
        full_name: candidate?.full_name ?? null,
        email: candidate?.email ?? null,
        company: candidate?.current_company ?? null,
        headline: candidate?.headline ?? null,
        "candidate.first_name": candFirstName,
        "candidate.full_name": candidate?.full_name ?? null,
        "candidate.email": candidate?.email ?? null,
        agent,
      };
      const render = (v: string | null | undefined) =>
        v ? renderTokens(v, tokenCtx) : (v ?? null);
      next = {
        ...next,
        subject: render(next.subject),
        body: render(next.body),
        task_instructions: render(next.task_instructions),
      };
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
        if (!candidate?.linkedin_url) {
          logStatus = "failed";
          logError = "Candidato sem linkedin_url";
        } else {
          try {
            const ctx = await loadAccountCtx(e.owner_id);
            const m = candidate.linkedin_url.match(/linkedin\.com\/in\/([^/?#]+)/i);
            const publicId = m ? decodeURIComponent(m[1]).replace(/\/$/, "") : null;
            if (!publicId) throw new UnipileError("linkedin_url inválido", "provider_error");
            const profile: any = await fetchProfile(ctx, publicId);
            const { extractProfileProviderId, normalizeInviteResult } =
              await import("@/lib/unipile/client.server");
            const providerId = extractProfileProviderId(profile);
            if (!providerId) throw new UnipileError("provider_id não resolvido", "provider_error");
            const body = (next.body ?? next.task_instructions ?? "").slice(0, 8000);
            let inviteResp: any = null;
            if (next.channel === "linkedin_invite") {
              inviteResp = await sendLinkedinInvite(ctx, {
                providerId: String(providerId),
                message: body.slice(0, 300) || undefined,
              });
            } else {
              await sendLinkedinMessage(ctx, {
                attendeeProviderId: String(providerId),
                text: body || `Olá ${candidate.full_name ?? ""}`.trim(),
              });
            }
            const providerInviteId =
              next.channel === "linkedin_invite"
                ? normalizeInviteResult(inviteResp).invitationId
                : null;

            const isInvite = next.channel === "linkedin_invite";
            await supabaseAdmin.from("unipile_message_log").insert({
              account_id: ctx.accountId,
              owner_id: e.owner_id,
              kind: isInvite ? "invite" : "message",
              target_identifier: String(providerId),
              candidate_id: e.candidate_id,
              body: body || null,
              status: isInvite ? "pending" : "sent",
              provider_invite_id: providerInviteId,
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
