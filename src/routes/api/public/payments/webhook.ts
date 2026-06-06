import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function verifyStripeSignature(body: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  try {
    const a = Buffer.from(v1, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = url.searchParams.get("env") === "live" ? "live" : "sandbox";
        const secret =
          env === "live"
            ? process.env.PAYMENTS_LIVE_WEBHOOK_SECRET
            : process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET;

        const body = await request.text();
        const sig = request.headers.get("stripe-signature");

        if (!secret || !verifyStripeSignature(body, sig, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const obj = (event.data?.object ?? {}) as {
            id?: string;
            client_reference_id?: string;
            metadata?: { quote_id?: string };
            payment_status?: string;
            amount_total?: number;
            currency?: string;
          };
          const quoteId = obj.metadata?.quote_id || obj.client_reference_id;
          if (quoteId && obj.payment_status === "paid") {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("quotes")
              .update({
                paid_at: new Date().toISOString(),
                status: "accepted",
                accepted_at: new Date().toISOString(),
              })
              .eq("id", quoteId);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
