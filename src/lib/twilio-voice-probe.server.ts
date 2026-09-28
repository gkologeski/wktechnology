import { twilioEnvReady } from "@/lib/channel-availability";
import { mapProbeStatus, type ProbeResult } from "@/lib/twilio-voice-probe";

/** Testa o par API Key SID/Secret na API da Twilio (sem expor segredos). */
export async function probeTwilioVoiceCredentials(): Promise<ProbeResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();
  if (!twilioEnvReady({ accountSid, apiKeySid, apiKeySecret, twimlAppSid })) {
    return { ok: false, reason: "Telefonia não configurada", transient: false };
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Keys/${apiKeySid}.json`,
      {
        headers: { Authorization: `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    return mapProbeStatus(res.status);
  } catch {
    return { ok: false, reason: "Telefonia sem resposta", transient: true };
  }
}

/** Grava o último resultado (service role). Falhas de gravação são ignoradas. */
export async function saveCallHealth(r: ProbeResult): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("channel_health_checks").upsert({
      channel: "call",
      ready: r.ok,
      reason: r.reason ?? null,
      transient: r.transient,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[channel-health] save failed", e instanceof Error ? e.message : e);
  }
}
