// Webhook público do Banco Inter (modo mock/sandbox).
// Verifica HMAC-SHA256 sobre o corpo bruto usando INTER_WEBHOOK_SECRET
// e processa eventos de cobrança (AR) e pagamento (AP). Idempotente.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const PayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("charge"),
    charge_id: z.string().uuid(),
    status: z.enum(["paid", "canceled", "expired"]),
    paid_at: z.string().datetime().optional(),
    external_id: z.string().optional(),
  }),
  z.object({
    kind: z.literal("payment"),
    payment_id: z.string().uuid(),
    status: z.enum(["processing", "paid", "failed"]),
    paid_at: z.string().datetime().optional(),
    failure_reason: z.string().optional(),
    external_id: z.string().optional(),
  }),
  // Compat com payload antigo (sem kind, tratado como charge)
  z.object({
    charge_id: z.string().uuid(),
    status: z.enum(["paid", "canceled", "expired"]),
    paid_at: z.string().datetime().optional(),
    external_id: z.string().optional(),
  }),
]);

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
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const kind = "kind" in parsed ? parsed.kind : "charge";

        // -------- COBRANÇAS (AR) --------
        if (kind === "charge") {
          const p = parsed as Extract<typeof parsed, { charge_id: string }>;
          if (p.status === "paid") {
            const { settleChargePaymentAdmin } = await import("@/lib/banking/charges.server");
            try {
              const r = await settleChargePaymentAdmin(
                supabaseAdmin,
                p.charge_id,
                p.paid_at ?? new Date().toISOString(),
              );
              return Response.json(r);
            } catch (e) {
              return new Response(e instanceof Error ? e.message : String(e), { status: 400 });
            }
          }
          const patch =
            p.status === "canceled"
              ? { status: "canceled" as const, canceled_at: new Date().toISOString() }
              : { status: "expired" as const };
          const { error } = await supabaseAdmin
            .from("bank_charges")
            .update(patch)
            .eq("id", p.charge_id)
            .eq("status", "pending");
          if (error) return new Response(error.message, { status: 400 });
          return Response.json({ ok: true });
        }

        // -------- PAGAMENTOS (AP) --------
        if (kind === "payment") {
          const p = parsed as Extract<typeof parsed, { payment_id: string }>;
          if (p.status === "paid") {
            const { settleBankPaymentAdmin } = await import("@/lib/banking/payments.server");
            try {
              const r = await settleBankPaymentAdmin(
                supabaseAdmin,
                p.payment_id,
                p.paid_at ?? new Date().toISOString(),
              );
              return Response.json(r);
            } catch (e) {
              return new Response(e instanceof Error ? e.message : String(e), { status: 400 });
            }
          }
          if (p.status === "failed") {
            const { failBankPaymentAdmin } = await import("@/lib/banking/payments.server");
            await failBankPaymentAdmin(
              supabaseAdmin,
              p.payment_id,
              p.failure_reason ?? "Falha reportada pelo provider",
            );
            return Response.json({ ok: true });
          }
          // processing — apenas garante o status
          await supabaseAdmin
            .from("bank_payments")
            .update({ status: "processing", external_id: p.external_id ?? null })
            .eq("id", p.payment_id)
            .in("status", ["approved", "processing"]);
          return Response.json({ ok: true });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
