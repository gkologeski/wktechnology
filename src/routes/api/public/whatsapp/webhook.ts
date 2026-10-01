// Recebe mensagens e avisos de status do WhatsApp pela conexão Lovable.
import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WHATSAPP_API_KEY;
        if (!secret) return new Response("not configured", { status: 503 });
        let payload: unknown;
        try {
          ({ payload } = await verifyWebhookRequest({
            req: request,
            secret,
            maxBodyBytes: 4 * 1024 * 1024,
          }));
        } catch {
          return new Response("invalid signature", { status: 401 });
        }
        const deliveryId = request.headers.get("x-lovable-delivery")?.trim();
        const event = request.headers.get("x-lovable-event")?.trim();
        if (!deliveryId || !event) return new Response("missing headers", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processEvent, processPending } =
          await import("@/lib/whatsapp/webhook-processor.server");
        const admin = supabaseAdmin as any;

        const { error: insErr } = await admin
          .from("whatsapp_webhook_events")
          .upsert(
            { delivery_id: deliveryId, event, payload },
            { onConflict: "delivery_id", ignoreDuplicates: true },
          );
        if (insErr) {
          console.error("[whatsapp-webhook] falha ao gravar", insErr.message);
          return new Response("storage error", { status: 500 });
        }
        const { data: row, error: selErr } = await admin
          .from("whatsapp_webhook_events")
          .select("id, event, payload, attempts, processed_at")
          .eq("delivery_id", deliveryId)
          .single();
        if (selErr || !row) return new Response("storage error", { status: 500 });

        if (!row.processed_at) await processEvent(admin, row);
        // Recuperação de pendências antigas (limitada para caber no prazo).
        await processPending(admin, 5).catch(() => {});
        // Recebimento durável garantido; pendências são retomadas depois.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
