// Guarda de envio por nó (WhatsApp e e-mail) dos fluxos:
// - chave estável por fluxo/execução de origem/passo, mantida entre retomadas;
// - reserva atômica (CAS + lease) em `workflow_delivery_claim`: nunca dois envios;
// - horário comercial, cota diária e deduplicação por workspace (comercial),
//   separados do disjuntor técnico do SDR;
// - 429/5xx → nova tentativa com espera crescente; rede/timeout → "incerto",
//   reconciliado no histórico do canal e nunca reenviado às cegas.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogStep } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";
import { buildDeliveryMeta } from "../delivery-meta";
import {
  backoffMs,
  classifyFailure,
  nextSendSlot,
  DELIVERY_LEASE_SECONDS,
  MAX_DELIVERY_ATTEMPTS,
  type SendPolicy,
} from "./delivery-policy";

type Channel = "whatsapp" | "email";
type ClaimResult = {
  result:
    | "claimed"
    | "already_sent"
    | "in_flight"
    | "uncertain"
    | "exhausted"
    | "quota"
    | "deduped"
    | "forbidden";
  attempts?: number;
  provider_id?: string | null;
  error?: string | null;
  used?: number;
  limit?: number;
};

export function deliveryChannel(action: RunnableAction): Channel | null {
  if (action.type === "send_whatsapp") return "whatsapp";
  if (action.type === "send_email") return "email";
  return null;
}

export function recipientFor(action: RunnableAction, ctx: RunCtx): string | null {
  if (action.type === "send_whatsapp") {
    const v = ctx.after?.[action.to_field || "phone"];
    return typeof v === "string" && v.replace(/\D/g, "") ? v.replace(/\D/g, "") : null;
  }
  if (action.type === "send_email") {
    const v = ctx.after?.[action.to_field || "email"];
    return typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null;
  }
  return null;
}

export async function loadSendPolicy(
  supabase: SupabaseClient,
  ctx: RunCtx,
): Promise<SendPolicy | null> {
  if (ctx.sendPolicy !== undefined) return ctx.sendPolicy;
  const { data } = await supabase
    .from("workflow_send_policies")
    .select(
      "whatsapp_daily_limit, email_daily_limit, dedupe_hours, timezone, window_start, window_end, weekdays, email_provider, email_account_id, default_booking_page_id",
    )
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  ctx.sendPolicy = (data as SendPolicy | null) ?? null;
  return ctx.sendPolicy;
}

/** Chave estável do envio: sobrevive a pausas/retomadas do mesmo passo. */
export function stableDeliveryKey(ctx: RunCtx, stepPath: string): string | null {
  if (!ctx.runId) return null;
  const state = (ctx.state = ctx.state ?? {});
  const slot = `dk:${stepPath}`;
  const prior = state[slot];
  if (typeof prior === "string") return prior;
  const key = `wfd:${ctx.workspaceId}:${ctx.workflowId ?? "-"}:${ctx.runId}:${stepPath}`;
  state[slot] = key;
  return key;
}

/** Procura no histórico do canal se o envio incerto chegou a sair. */
async function reconcile(
  supabase: SupabaseClient,
  channel: Channel,
  ctx: RunCtx,
  key: string,
): Promise<string | null> {
  if (channel === "whatsapp") {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("id, wa_message_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("raw->source->>idempotency_key", key)
      .limit(1);
    const r = (data ?? [])[0] as { id: string; wa_message_id?: string | null } | undefined;
    return r ? (r.wa_message_id ?? r.id) : null;
  }
  const { data } = await supabase
    .from("email_messages")
    .select("id, provider_message_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("headers->>x-wf-idempotency", key)
    .not("sent_at", "is", null)
    .limit(1);
  const r = (data ?? [])[0] as { id: string; provider_message_id?: string | null } | undefined;
  return r ? (r.provider_message_id ?? r.id) : null;
}

async function finish(
  supabase: SupabaseClient,
  key: string,
  status: "sent" | "retry_scheduled" | "failed" | "uncertain",
  extra: {
    provider?: string | null;
    providerId?: string | null;
    error?: string | null;
    next?: string | null;
  },
) {
  const { error } = await supabase.rpc(
    "workflow_delivery_finish" as never,
    {
      p_key: key,
      p_status: status,
      p_provider: extra.provider ?? null,
      p_provider_id: extra.providerId ?? null,
      p_error: extra.error ?? null,
      p_next_attempt: extra.next ?? null,
    } as never,
  );
  if (error) console.error("[workflow-delivery] falha ao fechar reserva", error.message);
}

function step(
  ctx: RunCtx,
  at: string,
  action: RunnableAction,
  channel: Channel,
  o: {
    ok: boolean;
    status: string;
    detail?: Record<string, unknown>;
    error?: string;
    suspendUntil?: string;
    providerId?: string | null;
    attempts?: number;
  },
): LogStep {
  return {
    at,
    ok: o.ok,
    action: action.type,
    ...(o.error ? { error: o.error } : {}),
    detail: { ...(o.detail ?? {}), ...(o.attempts ? { attempts: o.attempts } : {}) },
    ...(o.suspendUntil ? { suspend_until: o.suspendUntil } : {}),
    delivery: buildDeliveryMeta(ctx, {
      channel,
      provider: channel === "whatsapp" ? "meta" : null,
      provider_status: o.status,
      provider_id: o.providerId ?? null,
    }),
  };
}

export async function guardedDelivery(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  stepPath: string,
  send: () => Promise<LogStep>,
  now: () => Date = () => new Date(),
): Promise<LogStep> {
  const channel = deliveryChannel(action)!;
  const at = now().toISOString();
  const key = stableDeliveryKey(ctx, stepPath);
  if (!key) return send(); // teste manual sem execução: sem reserva

  const policy = await loadSendPolicy(supabase, ctx);
  if (policy) {
    const slot = nextSendSlot(now(), policy);
    if (slot)
      return step(ctx, at, action, channel, {
        ok: true,
        status: "outside_window",
        detail: { scheduled_for: slot.toISOString() },
        suspendUntil: slot.toISOString(),
      });
  }

  const { data, error } = await supabase.rpc(
    "workflow_delivery_claim" as never,
    {
      p_workspace: ctx.workspaceId,
      p_workflow: ctx.workflowId ?? null,
      p_key: key,
      p_channel: channel,
      p_step_path: stepPath,
      p_recipient: recipientFor(action, ctx),
      p_lease_seconds: DELIVERY_LEASE_SECONDS,
      p_max_attempts: MAX_DELIVERY_ATTEMPTS,
    } as never,
  );
  if (error) throw new Error(`Reserva de envio falhou: ${error.message}`);
  const claim = (data ?? { result: "forbidden" }) as ClaimResult;

  switch (claim.result) {
    case "already_sent":
      return step(ctx, at, action, channel, {
        ok: true,
        status: "skipped_duplicate",
        providerId: claim.provider_id ?? null,
        detail: { skipped: "already_sent" },
      });
    case "deduped":
      return step(ctx, at, action, channel, {
        ok: true,
        status: "deduped",
        detail: { skipped: "deduped", dedupe_hours: policy?.dedupe_hours ?? null },
      });
    case "in_flight": {
      const retry = new Date(now().getTime() + DELIVERY_LEASE_SECONDS * 1000).toISOString();
      return step(ctx, at, action, channel, {
        ok: true,
        status: "in_flight",
        detail: { scheduled_for: retry },
        suspendUntil: retry,
      });
    }
    case "quota": {
      const retry = new Date(now().getTime() + 3_600_000).toISOString();
      return step(ctx, at, action, channel, {
        ok: true,
        status: "quota_reached",
        detail: { used: claim.used, limit: claim.limit, scheduled_for: retry },
        suspendUntil: retry,
      });
    }
    case "uncertain": {
      const found = await reconcile(supabase, channel, ctx, key);
      if (found) {
        await finish(supabase, key, "sent", { providerId: found });
        return step(ctx, at, action, channel, {
          ok: true,
          status: "reconciled_sent",
          providerId: found,
          detail: { skipped: "already_sent" },
        });
      }
      await finish(supabase, key, "uncertain", { error: "Sem confirmação do provedor" });
      return step(ctx, at, action, channel, {
        ok: false,
        status: "uncertain",
        error:
          "Envio incerto: o provedor não confirmou e o histórico do canal não mostra a mensagem. Não reenviado automaticamente; confira o canal antes de repetir.",
      });
    }
    case "exhausted":
      return step(ctx, at, action, channel, {
        ok: false,
        status: "failed",
        attempts: claim.attempts,
        error: `Envio não concluído após ${claim.attempts ?? MAX_DELIVERY_ATTEMPTS} tentativa(s): ${claim.error ?? "falha do provedor"}`,
      });
    case "forbidden":
      return step(ctx, at, action, channel, {
        ok: false,
        status: "failed",
        error: "Reserva de envio pertence a outra empresa.",
      });
    case "claimed":
      break;
  }

  const attempts = claim.attempts ?? 1;
  ctx.deliveryKey = key;
  let result: LogStep;
  try {
    result = await send();
  } catch (e) {
    result = {
      at,
      ok: false,
      action: action.type,
      error: e instanceof Error ? e.message : String(e),
      detail: { __err: e },
    };
  } finally {
    ctx.deliveryKey = undefined;
  }

  if (result.ok) {
    const st = result.delivery?.provider_status ?? "sent";
    // Fila interna (sem caixa conectada) também fecha a reserva: nada a repetir.
    await finish(supabase, key, "sent", {
      provider: result.delivery?.provider ?? null,
      providerId: result.delivery?.provider_id ?? null,
      error: st === "queued_local" ? "Sem caixa conectada: ficou na fila interna" : null,
    });
    return { ...result, detail: { ...((result.detail as object) ?? {}), attempts } };
  }

  const errObj =
    (result.detail as { __err?: unknown } | undefined)?.__err ?? new Error(result.error);
  const kind = classifyFailure(errObj);
  const clean = { ...result, detail: { attempts } };
  if (kind === "retry" && attempts < MAX_DELIVERY_ATTEMPTS) {
    const next = new Date(now().getTime() + backoffMs(attempts)).toISOString();
    await finish(supabase, key, "retry_scheduled", { error: result.error ?? null, next });
    return {
      ...clean,
      ok: true,
      error: undefined,
      detail: { attempts, scheduled_for: next, last_error: result.error },
      suspend_until: next,
      delivery: buildDeliveryMeta(ctx, {
        channel,
        provider: channel === "whatsapp" ? "meta" : null,
        provider_status: "retry_scheduled",
      }),
    };
  }
  if (kind === "uncertain") {
    const found = await reconcile(supabase, channel, ctx, key);
    if (found) {
      await finish(supabase, key, "sent", { providerId: found });
      return step(ctx, at, action, channel, {
        ok: true,
        status: "reconciled_sent",
        providerId: found,
        attempts,
      });
    }
    await finish(supabase, key, "uncertain", { error: result.error ?? null });
    return step(ctx, at, action, channel, {
      ok: false,
      status: "uncertain",
      attempts,
      error: `Envio incerto (${result.error}). Não reenviado automaticamente; confira o canal antes de repetir.`,
    });
  }
  await finish(supabase, key, "failed", { error: result.error ?? null });
  return {
    ...clean,
    delivery: result.delivery ?? buildDeliveryMeta(ctx, { channel, provider_status: "failed" }),
  };
}
