// Webhook público do Banco Inter (modo mock/sandbox).
// Verifica HMAC-SHA256 sobre o corpo bruto usando INTER_WEBHOOK_SECRET
// e processa eventos de cobrança (AR) e pagamento (AP). Idempotente.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const ChargePayload = z.object({
  kind: z.literal("charge").optional(),
  charge_id: z.string().uuid(),
  status: z.enum(["paid", "canceled", "expired"]),
  paid_at: z.string().datetime().optional(),
  external_id: z.string().min(1).max(200),
});

const PaymentPayload = z.object({
  kind: z.literal("payment"),
  payment_id: z.string().uuid(),
  status: z.enum(["processing", "paid", "failed"]),
  paid_at: z.string().datetime().optional(),
  failure_reason: z.string().optional(),
  external_id: z.string().min(1).max(200),
});

const PayloadSchema = z.union([PaymentPayload, ChargePayload]);

export const Route = createFileRoute("/api/public/banking/inter-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INTER_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret não configurado", { status: 503 });
        }

        const signature = request.headers.get("x-inter-signature");
        if (Number(request.headers.get("content-length") ?? 0) > 65536)
          return new Response("Payload too large", { status: 413 });
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 65536)
          return new Response("Payload too large", { status: 413 });

        if (!signature) return new Response("Missing signature", { status: 401 });
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof PayloadSchema>;
        try {
          parsed = PayloadSchema.parse(JSON.parse(raw));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { financeRpc } = await import("@/lib/access-control/finance-records.server");
        try {
          const payment = "payment_id" in parsed;
          const result = await financeRpc(supabaseAdmin, "banking_apply_event", {
            _kind: payment ? "payment" : "charge",
            _id: "payment_id" in parsed ? parsed.payment_id : parsed.charge_id,
            _status: parsed.status,
            _external: parsed.external_id,
            _paid_at: parsed.paid_at ?? new Date().toISOString(),
            _reason: "payment_id" in parsed ? (parsed.failure_reason ?? null) : null,
          });
          return Response.json(result);
        } catch {
          return new Response("Evento incompatível ou registro indisponível", { status: 409 });
        }
      },
    },
  },
});
