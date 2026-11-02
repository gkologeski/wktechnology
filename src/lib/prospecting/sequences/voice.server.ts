import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workRpc } from "@/lib/access-control/work-core.server";
import { isValidE164 } from "@/lib/phone/e164";
import { publicAppOrigin } from "@/lib/runtime-config.server";
import { SequenceNotStartedError } from "./runtime";
import type { EffectReservation, RuntimeContext, SequencePorts } from "./worker.server";
const voiceConfig = z.object({
  sourceKey: z.string().uuid(),
  script: z.object({
    id: z.string().uuid(),
    name: z.string(),
    firstMessage: z.string().min(1),
    prompt: z.string().min(1),
    voiceId: z.string().min(1),
    voiceProvider: z.string(),
  }),
  model: z.string().min(1),
  maxDurationSeconds: z.number().int().min(10).max(3600),
  language: z.string(),
});
function render(text: string, source: RuntimeContext["source"]) {
  const row = source as typeof source & {
    first_name?: string;
    last_name?: string;
    company_name?: string;
  };
  const value = text
    .replaceAll("{{lead.name}}", [row.first_name, row.last_name].filter(Boolean).join(" "))
    .replaceAll("{{lead.company}}", row.company_name || "");
  if (/\{\{/.test(value)) throw new Error("Variável de roteiro sem valor autorizado.");
  return value;
}
/** No credentials or network before the service-only current-subject authorization. */
export async function prepareSequenceVoice(
  admin: SupabaseClient,
  ctx: RuntimeContext,
): ReturnType<SequencePorts["prepare"]> {
  const access = () =>
    workRpc<unknown>(admin, "prospecting_sequence_voice_access", {
      p_run: ctx.run.id,
      p_lease: ctx.run.lease_token,
    });
  const cfg = voiceConfig.parse(await access());
  if (cfg.script.voiceProvider !== "elevenlabs" && cfg.script.voiceProvider !== "11labs")
    throw new Error("Provedor de voz não suportado nesta configuração.");
  const phone = ctx.source.phones.find((p): p is string => !!p && isValidE164(p));
  if (!phone) throw new Error("Telefone E.164 indisponível.");
  const apiKey = process.env.VAPI_API_KEY,
    secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!apiKey || !secret) throw new Error("Integração de telefonia indisponível.");
  const prompt = render(cfg.script.prompt, ctx.source),
    firstMessage = render(cfg.script.firstMessage, ctx.source);
  return async (effect: EffectReservation) => {
    if (
      effect.sourceKey !== cfg.sourceKey ||
      JSON.stringify(effect.source) !== JSON.stringify(ctx.source)
    )
      throw new SequenceNotStartedError("source_changed_before_send");
    try {
      if (JSON.stringify(voiceConfig.parse(await access())) !== JSON.stringify(cfg))
        throw new Error("changed");
    } catch {
      throw new SequenceNotStartedError("sender_changed_before_send");
    }
    const response = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: cfg.sourceKey,
        customer: { number: phone },
        metadata: { techerpSequenceEffect: effect.id },
        assistant: {
          name: cfg.script.name,
          firstMessage,
          firstMessageMode: "assistant-speaks-first",
          model: {
            provider: "openai",
            model: cfg.model,
            messages: [{ role: "system", content: prompt }],
          },
          voice: {
            provider: "11labs",
            voiceId: cfg.script.voiceId,
            model: "eleven_multilingual_v2",
            language: cfg.language.startsWith("pt") ? "pt" : cfg.language,
          },
          transcriber: { provider: "deepgram", model: "nova-2", language: cfg.language },
          maxDurationSeconds: cfg.maxDurationSeconds,
          endCallFunctionEnabled: true,
          serverMessages: ["status-update", "end-of-call-report"],
          server: { url: `${publicAppOrigin()}/api/public/hooks/vapi`, secret },
        },
      }),
    });
    // Provider errors may still represent an accepted request. Never blindly retry.
    if (!response.ok) throw new Error("voice_result_unknown");
    const result = z.object({ id: z.string().uuid() }).parse(await response.json());
    const payload = { provider: "vapi", messageId: result.id, to: phone, from: cfg.sourceKey };
    await workRpc(admin, "prospecting_sequence_receipt_store", {
      p_effect: effect.id,
      p_token: effect.token,
      p_payload: payload,
    });
    try {
      await workRpc(admin, "prospecting_sequence_delivery_commit", {
        p_effect: effect.id,
        p_token: effect.token,
        p_payload: payload,
      });
      return { receipt: result.id, committed: true as const };
    } catch {
      return { receipt: result.id, committed: true as const, projectionPending: true };
    }
  };
}
/** Called only AFTER the Vapi webhook has authenticated its shared secret. */
export async function handleSequenceVoiceEvent(
  admin: SupabaseClient,
  message: Record<string, unknown>,
) {
  const call = message.call as Record<string, unknown> | undefined;
  const metadata = call?.metadata as Record<string, unknown> | undefined;
  if (!metadata?.techerpSequenceEffect) return false;
  const id = z.string().uuid().parse(metadata.techerpSequenceEffect);
  if (message.type !== "status-update" && message.type !== "end-of-call-report") return true;
  const callId = z.string().uuid().parse(call?.id),
    sender = z.string().uuid().parse(call?.phoneNumberId);
  const customer = call?.customer as Record<string, unknown> | undefined;
  const phone = z.string().refine(isValidE164).parse(customer?.number);
  const reason = String(message.endedReason ?? call?.endedReason ?? "").toLowerCase();
  const terminal =
    message.type === "end-of-call-report" || (message.status === "ended" && !!reason);
  const noAnswer = /no-answer|did-not-answer|busy|voicemail|silence-timed-out/.test(reason);
  const answered =
    typeof call?.startedAt === "string" && !!call.startedAt && !/failed|error/.test(reason);
  const outcome = terminal ? (noAnswer ? "no_answer" : answered ? "answered" : "failed") : null;
  await workRpc(admin, "prospecting_sequence_voice_event", {
    p_effect: id,
    p_call: callId,
    p_phone_id: sender,
    p_number: phone,
    p_terminal: terminal,
    p_outcome: outcome,
  });
  return true;
}

/** Recover missing webhook facts by querying accepted IDs; no POST or new call. */
export async function reconcileSequenceVoice(admin: SupabaseClient) {
  const key = process.env.VAPI_API_KEY;
  if (!key) return { checked: 0, failed: 0 };
  const calls = await workRpc<{ effect_id: string; call_id: string }[]>(
    admin,
    "prospecting_sequence_voice_pending",
    {},
  );
  let checked = 0,
    failed = 0;
  for (const row of calls) {
    try {
      const id = z.string().uuid().parse(row.call_id);
      const response = await fetch(`https://api.vapi.ai/call/${id}`, {
        headers: { Authorization: `Bearer ${key}` },
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("unavailable");
      const call = (await response.json()) as Record<string, unknown>;
      if (
        call.id !== id ||
        (call.metadata as Record<string, unknown> | undefined)?.techerpSequenceEffect !==
          row.effect_id
      )
        throw new Error("mismatch");
      await handleSequenceVoiceEvent(admin, {
        type: call.status === "ended" ? "end-of-call-report" : "status-update",
        status: call.status,
        endedReason: call.endedReason,
        call,
      });
      checked++;
    } catch {
      failed++;
    }
  }
  return { checked, failed };
}
