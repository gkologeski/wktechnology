import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Builds a Twilio Voice Access Token (HS256 JWT) using Web Crypto.
 * Avoids importing the `twilio` Node SDK, which breaks Worker SSR.
 *
 * Twilio AccessToken spec: https://www.twilio.com/docs/iam/access-tokens
 */
function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signTwilioVoiceToken(opts: {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
  identity: string;
  ttlSeconds: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${opts.apiKeySid}-${now}`,
    iss: opts.apiKeySid,
    sub: opts.accountSid,
    iat: now,
    exp: now + opts.ttlSeconds,
    grants: {
      identity: opts.identity,
      voice: {
        outgoing: { application_sid: opts.twimlAppSid },
        incoming: { allow: true },
      },
    },
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(opts.apiKeySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}

export const getVoiceAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      return { ok: false, error: "Twilio Voice não está configurado (faltam secrets)." } as const;
    }
    if (!accountSid.startsWith("AC")) {
      return { ok: false, error: "TWILIO_ACCOUNT_SID inválido (deve começar com AC)." } as const;
    }
    if (!apiKeySid.startsWith("SK")) {
      return {
        ok: false,
        error:
          "TWILIO_API_KEY_SID inválido (deve começar com SK, não AC). Crie uma API Key em Console → Account → API keys & tokens.",
      } as const;
    }
    if (!twimlAppSid.startsWith("AP")) {
      return { ok: false, error: "TWILIO_TWIML_APP_SID inválido (deve começar com AP)." } as const;
    }

    // Diagnóstico: valida o par API Key SID/Secret contra a Twilio REST API.
    // Se a credencial não bate, retornamos um erro claro ao invés de um JWT
    // que vai falhar como "AccessTokenInvalid (20101)" no client.
    const probe = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Keys/${apiKeySid}.json`,
      { headers: { Authorization: `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}` } },
    );
    if (!probe.ok) {
      const body = await probe.text();
      console.error("[twilio-voice] credential probe failed", probe.status, body);
      if (probe.status === 401) {
        return {
          ok: false,
          error:
            "Credenciais Twilio rejeitadas (401). O TWILIO_API_KEY_SECRET não corresponde ao TWILIO_API_KEY_SID, ou a API Key não pertence ao TWILIO_ACCOUNT_SID informado. Recrie a API Key no Console (Account → API keys & tokens) na MESMA conta do Account SID e cole SID+Secret novamente.",
        } as const;
      }
      if (probe.status === 404) {
        return {
          ok: false,
          error:
            "API Key não encontrada nessa conta (404). O TWILIO_API_KEY_SID existe em outra subconta diferente do TWILIO_ACCOUNT_SID.",
        } as const;
      }
      return {
        ok: false,
        error: `Falha ao validar credenciais Twilio (${probe.status}): ${body.slice(0, 200)}`,
      } as const;
    }

    const identity = `user_${context.userId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const ttl = 3600;
    const token = await signTwilioVoiceToken({
      accountSid,
      apiKeySid,
      apiKeySecret,
      twimlAppSid,
      identity,
      ttlSeconds: ttl,
    });

    return { ok: true, token, identity, ttl } as const;
  });

export const logCallActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contactId: z.string().uuid().optional(),
        leadId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
        toNumber: z.string().min(3).max(32),
        durationMs: z
          .number()
          .int()
          .min(0)
          .max(24 * 60 * 60 * 1000),
        outcome: z.string().max(255).optional(),
        notes: z.string().max(5000).optional(),
        callSid: z.string().max(64).optional(),
        disposition: z.string().max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const subject = `Ligação para ${data.toNumber}`;
    const { data: row, error } = await supabase
      .from("activities")
      .insert({
        owner_id: userId,
        type: "call",
        subject,
        body: data.notes ?? null,
        duration_ms: data.durationMs,
        outcome: data.outcome ?? null,
        disposition: data.disposition ?? null,
        related_contact_id: data.contactId ?? null,
        related_lead_id: data.leadId ?? null,
        related_deal_id: data.dealId ?? null,
        external_ids: data.callSid ? { twilio_call_sid: data.callSid } : {},
        completed: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { activityId: row.id };
  });
