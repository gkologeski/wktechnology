import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Issues a short-lived Twilio Voice access token (JWT) granting the current
 * user permission to use the configured TwiML App as a WebRTC client.
 */
export const getVoiceAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      throw new Error("Twilio Voice não está configurado (faltam secrets).");
    }

    // Identity must be URL/JWT-safe.
    const identity = `user_${context.userId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    const { jwt: jwtNs } = await import("twilio");
    const AccessToken = jwtNs.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    });
    const grant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });
    token.addGrant(grant);

    return { token: token.toJwt(), identity, ttl: 3600 };
  });

/**
 * Logs a completed call as an activity (type='call').
 * Called by the dialer when the user hangs up — captures duration + outcome.
 */
export const logCallActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contactId: z.string().uuid().optional(),
        leadId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
        toNumber: z.string().min(3).max(32),
        durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
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
