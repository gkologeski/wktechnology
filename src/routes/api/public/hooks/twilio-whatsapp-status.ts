// Status callback do Twilio: atualiza status/delivered_at/read_at em whatsapp_messages.
// Configure como StatusCallback (já enviado automaticamente em cada envio).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyTwilioSignature } from "@/lib/twilio-signature.server";

export const Route = createFileRoute("/api/public/hooks/twilio-whatsapp-status")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true }),
      POST: async ({ request }) => {
        try {
          const text = await request.text();
          if (!verifyTwilioSignature(request, text)) {
            console.warn("[twilio-status] invalid signature");
            return new Response("Forbidden", { status: 403 });
          }
          const params = new URLSearchParams(text);
          const sid = params.get("MessageSid") ?? params.get("SmsSid");
          const status = params.get("MessageStatus") ?? params.get("SmsStatus");
          const errorCode = params.get("ErrorCode");
          const errorMessage = params.get("ErrorMessage");
          if (!sid || !status) return new Response("missing sid/status", { status: 400 });

          const now = new Date().toISOString();
          const patch: {
            status: string;
            delivered_at?: string;
            read_at?: string;
            sent_at?: string;
            error_code?: string;
            error_message?: string;
          } = { status };
          if (status === "delivered") patch.delivered_at = now;
          if (status === "read") patch.read_at = now;
          if (status === "sent") patch.sent_at = now;
          if (errorCode) patch.error_code = errorCode;
          if (errorMessage) patch.error_message = errorMessage;

          const { error } = await supabaseAdmin
            .from("whatsapp_messages")
            .update(patch)
            .eq("twilio_sid", sid);
          if (error) console.error("[twilio-status] update", error);

          return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
        } catch (e) {
          console.error("[twilio-status] erro", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
