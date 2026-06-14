import { createFileRoute } from "@tanstack/react-router";
import { verifyTwilioSignature } from "@/lib/twilio-signature.server";

/**
 * TwiML endpoint hit by Twilio when a WebRTC client initiates an outbound call
 * through the configured TwiML App. Returns a <Dial> verb that bridges the
 * browser to the requested PSTN number using the configured caller ID.
 *
 * Release 11: enables dual-channel recording with a status callback that
 * persists the recording URL + triggers transcription back into the matching
 * `activities` row (lookup by `external_ids.twilio_call_sid`).
 */
export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerId = process.env.TWILIO_CALLER_ID;
        if (!callerId) {
          return new Response("Twilio caller ID not configured", { status: 500 });
        }

        const rawBody = await request.text();
        if (!verifyTwilioSignature(request, rawBody)) {
          console.warn("[twilio-voice] invalid signature");
          return new Response("Forbidden", { status: 403 });
        }
        const form = new URLSearchParams(rawBody);
        const to = (form.get("To") ?? "").toString().trim();

        const isE164 = /^\+[1-9]\d{6,14}$/.test(to);

        const escape = (s: string) =>
          s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        // Build absolute callback URL honoring proxy headers.
        const url = new URL(request.url);
        const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
        const host =
          request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
        const recordingCallback = `${proto}://${host}/api/public/twilio/recording-status`;

        const dialAttrs = [
          `callerId="${escape(callerId)}"`,
          `answerOnBridge="true"`,
          `record="record-from-answer-dual"`,
          `recordingStatusCallback="${escape(recordingCallback)}"`,
          `recordingStatusCallbackEvent="completed"`,
          `recordingStatusCallbackMethod="POST"`,
          `recordingTrack="both"`,
        ].join(" ");

        const twiml = isE164
          ? `<?xml version="1.0" encoding="UTF-8"?><Response><Dial ${dialAttrs}><Number>${escape(to)}</Number></Dial></Response>`
          : `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-BR">Número inválido.</Say><Hangup/></Response>`;

        return new Response(twiml, {
          status: 200,
          headers: { "Content-Type": "text/xml; charset=utf-8" },
        });
      },
    },
  },
});
