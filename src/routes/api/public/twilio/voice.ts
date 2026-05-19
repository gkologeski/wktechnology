import { createFileRoute } from "@tanstack/react-router";

/**
 * TwiML endpoint hit by Twilio when a WebRTC client initiates an outbound call
 * through the configured TwiML App. Returns a <Dial> verb that bridges the
 * browser to the requested PSTN number using the configured caller ID.
 */
export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerId = process.env.TWILIO_CALLER_ID;
        if (!callerId) {
          return new Response("Twilio caller ID not configured", { status: 500 });
        }

        const form = await request.formData();
        const to = (form.get("To") ?? "").toString().trim();

        // Basic E.164 validation to keep this endpoint from being weaponized.
        const isE164 = /^\+[1-9]\d{6,14}$/.test(to);

        const escape = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        const twiml = isE164
          ? `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${escape(callerId)}" answerOnBridge="true"><Number>${escape(to)}</Number></Dial></Response>`
          : `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-BR">Número inválido.</Say><Hangup/></Response>`;

        return new Response(twiml, {
          status: 200,
          headers: { "Content-Type": "text/xml; charset=utf-8" },
        });
      },
    },
  },
});
