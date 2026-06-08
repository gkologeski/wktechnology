// Public webhook receiver for BR payment gateways (Asaas / Pagar.me / Mercado Pago).
// Each provider sends its own signature scheme; we verify with the matching secret,
// log the event, find the related invoice by external_id, and mark it paid.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ProviderSecret = { key: string; type: "asaas-token" | "hmac-sha256" | "hmac-sha1" };

function getProviderSecret(provider: string): ProviderSecret | null {
  if (provider === "asaas") {
    const key = process.env.ASAAS_WEBHOOK_SECRET;
    return key ? { key, type: "asaas-token" } : null;
  }
  if (provider === "pagarme") {
    const key = process.env.PAGARME_WEBHOOK_SECRET;
    return key ? { key, type: "hmac-sha256" } : null;
  }
  if (provider === "mercadopago") {
    const key = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    return key ? { key, type: "hmac-sha1" } : null;
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function verifySignature(
  provider: string,
  secret: ProviderSecret,
  body: string,
  headers: Headers,
): boolean {
  if (provider === "asaas") {
    return safeEqual(headers.get("asaas-access-token") ?? "", secret.key);
  }
  if (provider === "pagarme") {
    const signature = headers.get("x-hub-signature") ?? "";
    const [, given] = signature.split("=");
    if (!given) return false;
    const expected = createHmac("sha256", secret.key).update(body).digest("hex");
    return safeEqual(given, expected);
  }
  if (provider === "mercadopago") {
    const xSig = headers.get("x-signature") ?? "";
    const parts = Object.fromEntries(
      xSig.split(",").map((kv) => {
        const [k, v] = kv.split("=");
        return [k?.trim() ?? "", v?.trim() ?? ""];
      }),
    );
    const v1 = parts["v1"];
    const ts = parts["ts"];
    if (!v1 || !ts) return false;
    const expected = createHmac("sha256", secret.key).update(`${ts}.${body}`).digest("hex");
    return safeEqual(v1, expected);
  }
  return false;
}

function parseEvent(provider: string, payload: unknown): {
  externalId: string | null;
  status: "received" | "refunded" | "failed" | "chargeback" | "pending";
  amount: number | null;
  eventType: string | null;
} {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (provider === "asaas") {
    const payment = (p.payment ?? {}) as Record<string, unknown>;
    const event = (p.event as string) ?? null;
    const map: Record<string, "received" | "refunded" | "failed" | "chargeback" | "pending"> = {
      PAYMENT_RECEIVED: "received",
      PAYMENT_CONFIRMED: "received",
      PAYMENT_REFUNDED: "refunded",
      PAYMENT_DELETED: "failed",
      PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
    };
    return {
      externalId: (payment.id as string) ?? null,
      status: map[event ?? ""] ?? "pending",
      amount: typeof payment.value === "number" ? (payment.value as number) : null,
      eventType: event,
    };
  }
  if (provider === "pagarme") {
    const data = ((p.data ?? {}) as Record<string, unknown>);
    const event = (p.type as string) ?? (p.event as string) ?? null;
    const status = event?.includes("paid") ? "received" : event?.includes("refund") ? "refunded" : "pending";
    return {
      externalId: (data.id as string) ?? null,
      status,
      amount: typeof data.amount === "number" ? (data.amount as number) / 100 : null,
      eventType: event,
    };
  }
  if (provider === "mercadopago") {
    const data = ((p.data ?? {}) as Record<string, unknown>);
    return {
      externalId: (data.id as string) ?? null,
      status: (p.action as string)?.includes("payment.updated") ? "received" : "pending",
      amount: null,
      eventType: (p.action as string) ?? null,
    };
  }
  return { externalId: null, status: "pending", amount: null, eventType: null };
}

export const Route = createFileRoute("/api/public/payments/br-webhook/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const provider = String(params.provider).toLowerCase();
        if (!["asaas", "pagarme", "mercadopago"].includes(provider)) {
          return new Response("Unknown provider", { status: 404 });
        }
        const body = await request.text();
        const secret = getProviderSecret(provider);

        let signatureValid = false;
        if (secret) signatureValid = verifySignature(provider, secret, body, request.headers);

        let payload: unknown = {};
        try { payload = JSON.parse(body); } catch { /* keep empty */ }

        const parsed = parseEvent(provider, payload);

        // Log the event for auditing regardless of signature validity.
        await supabaseAdmin.from("payment_webhook_events").insert({
          gateway: provider,
          event_type: parsed.eventType,
          external_id: parsed.externalId,
          signature_valid: signatureValid,
          processed: false,
          payload: payload as never,
        });

        if (!secret || !signatureValid) {
          return new Response("Invalid signature", { status: 401 });
        }

        if (!parsed.externalId) {
          return new Response("ok", { status: 200 });
        }

        // Idempotent: look up the invoice by external id + provider.
        const { data: invoice } = await supabaseAdmin
          .from("customer_invoices")
          .select("id, workspace_id, status")
          .eq("gateway", provider)
          .eq("external_id", parsed.externalId)
          .maybeSingle();

        if (!invoice) return new Response("ok", { status: 200 });

        // Insert payment row (idempotent via uq_customer_payments_gw_ext).
        await supabaseAdmin
          .from("customer_payments")
          .upsert(
            {
              workspace_id: invoice.workspace_id,
              invoice_id: invoice.id,
              gateway: provider,
              external_payment_id: parsed.externalId,
              amount: parsed.amount ?? 0,
              status: parsed.status,
              received_at: parsed.status === "received" ? new Date().toISOString() : null,
              raw: payload as never,
            },
            { onConflict: "gateway,external_payment_id" },
          );

        if (parsed.status === "received" && invoice.status !== "paid") {
          await supabaseAdmin
            .from("customer_invoices")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", invoice.id);
          // Pause any dunning runs for this invoice.
          await supabaseAdmin
            .from("dunning_runs")
            .update({ status: "completed" })
            .eq("invoice_id", invoice.id)
            .eq("status", "active");
        }

        await supabaseAdmin
          .from("payment_webhook_events")
          .update({ processed: true })
          .eq("external_id", parsed.externalId)
          .eq("processed", false);

        return new Response("ok", { status: 200 });
      },
    },
  },
});
