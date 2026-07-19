// Webhook público do Banco Inter (modo mock/sandbox).
// Verifica HMAC-SHA256 sobre o corpo bruto usando INTER_WEBHOOK_SECRET
// e liquida a cobrança correspondente. Idempotente por charge_id.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const PayloadSchema = z.object({
  charge_id: z.string().uuid(),
  status: z.enum(["paid", "canceled", "expired"]),
  paid_at: z.string().datetime().optional(),
  external_id: z.string().optional(),
});

export const Route = createFileRoute("/api/public/banking/inter-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INTER_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret não configurado", { status: 503 });
        }

        const signature = request.headers.get("x-inter-signature");
        const raw = await request.text();

        if (!signature) return new Response("Missing signature", { status: 401 });
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed;
        try {
          parsed = PayloadSchema.parse(JSON.parse(raw));
        } catch (e) {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (parsed.status === "paid") {
          const { settleChargePaymentAdmin } = await import("@/lib/banking/charges.server");
          try {
            const r = await settleChargePaymentAdmin(
              supabaseAdmin,
              parsed.charge_id,
              parsed.paid_at ?? new Date().toISOString(),
            );
            return Response.json(r);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return new Response(msg, { status: 400 });
          }
        }

        if (parsed.status === "canceled" || parsed.status === "expired") {
          const patch: Record<string, unknown> = { status: parsed.status };
          if (parsed.status === "canceled") patch.canceled_at = new Date().toISOString();
          const { error } = await supabaseAdmin
            .from("bank_charges")
            .update(patch)
            .eq("id", parsed.charge_id)
            .eq("status", "pending");
          if (error) return new Response(error.message, { status: 400 });
          return Response.json({ ok: true });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
