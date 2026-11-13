// Webhook público chamado pela Unipile quando uma conta termina o
// fluxo Hosted Auth (sucesso/erro), muda de estado ou recebe mensagem.
//
// Auth: validamos HMAC SHA-256 sobre o corpo cru usando
// UNIPILE_WEBHOOK_SECRET. Sem header válido => 401.
//
// v1: payload "gordo" com `status`/`event` e `name` = connect_token.
// v2: payload reduzido com `event_type` e `state` (hosted auth). Quando os
// dados da mensagem não vêm no corpo, hidratamos via API (ver
// src/lib/unipile/webhook-events.server.ts).

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { verifyUnipileSignature } from "@/lib/unipile/webhook-signature.server";

const SIGNATURE_HEADERS = ["x-unipile-signature", "x-webhook-signature", "x-signature"];

function verifySignature(body: string, headerValue: string | null, secret: string): boolean {
  if (!headerValue) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  // Algumas variantes vêm como "sha256=<hash>"
  const provided = headerValue.startsWith("sha256=")
    ? headerValue.slice("sha256=".length)
    : headerValue;
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/unipile/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.UNIPILE_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });

        if (Number(request.headers.get("content-length")) > 1048576)
          return new Response("Payload too large", { status: 413 });
        const body = await request.text();
        if (new TextEncoder().encode(body).length > 1048576)
          return new Response("Payload too large", { status: 413 });
        const signature =
          SIGNATURE_HEADERS.map((h) => request.headers.get(h)).find((v) => !!v) ?? null;

        const v2Signature = request.headers.get("unipile-signature");
        // An invalid V2 header must never downgrade to the legacy verifier.
        const verified =
          v2Signature !== null
            ? verifyUnipileSignature(body, v2Signature, secret)
            : verifySignature(body, signature, secret);
        if (!verified) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { parseUnipileWebhook, hydrateV2Message } =
          await import("@/lib/unipile/webhook-events.server");

        const event = parseUnipileWebhook(payload);
        const unipileAccountId = event.unipileAccountId;
        const connectToken = event.connectToken;

        // Replies pause cadence; they are not automatically classified as opt-out.
        if (event.kind === "message_received" && unipileAccountId) {
          const known = await supabaseAdmin
            .from("unipile_accounts")
            .select("id,status")
            .eq("unipile_account_id", unipileAccountId)
            .maybeSingle();
          if (known.error) return json({ error: "Account lookup failed" }, 503);
          if (!known.data || known.data.status !== "connected")
            return json({ ok: true, event: "unmapped_or_inactive" });
          let msg = event.message!;
          if (msg.needsHydration && msg.messageId) {
            const full = await hydrateV2Message(unipileAccountId, msg.messageId, msg.chatId);
            if (!full) return json({ error: "Message hydration unavailable" }, 503);
            msg = {
              ...msg,
              senderProviderId: msg.senderProviderId ?? full.senderProviderId,
              text: msg.text ?? full.text,
              chatId: msg.chatId ?? full.chatId,
              isSelfSent: msg.isSelfSent || full.isSelfSent,
            };
          }
          if (msg.isSelfSent) return json({ ok: true, event: "self_echo_ignored" });
          if (!msg.messageId || !msg.chatId || !msg.senderProviderId)
            return json({ error: "Incomplete message identifiers" }, 422);
          const received = await supabaseAdmin.rpc(
            "unipile_receive_message" as never,
            {
              p_account: known.data.id,
              p_message: msg.messageId,
              p_chat: msg.chatId,
              p_sender: msg.senderProviderId,
              p_body: msg.text,
            } as never,
          );
          if (received.error) return json({ error: "Message persistence unavailable" }, 503);
          return json({ ok: true, event: "reply_processed", result: received.data });
        }

        // Eventos de mensageria irrelevantes (message.sent, message.read, ...)
        if (event.kind === "unknown" && !connectToken && !unipileAccountId) {
          return json({ ok: true, event: "ignored", event_type: event.eventType });
        }

        if (!connectToken && !unipileAccountId) {
          return new Response("Missing identifiers", { status: 200 });
        }

        // Only the authenticated Hosted Auth finalizer may connect or re-connect an account.
        // Lifecycle notifications may update an already mapped exact provider ID, never adopt one.
        if (!unipileAccountId) return json({ ok: true, event: "unmapped" });
        const { data: row, error: lookupError } = await supabaseAdmin
          .from("unipile_accounts")
          .select("id,owner_id")
          .eq("unipile_account_id", unipileAccountId)
          .maybeSingle();
        if (lookupError) return json({ error: "Account lookup failed" }, 503);

        if (row) {
          const nowIso = new Date().toISOString();
          let status: "connected" | "disconnected" | "error" | null = null;
          if (event.kind === "account_disconnected") status = "disconnected";
          else if (event.kind === "account_failed") status = "error";

          await supabaseAdmin
            .from("unipile_accounts")
            .update({
              last_seen_at: nowIso,
              ...(status ? { status } : {}),
              ...(status === "error" || status === "disconnected"
                ? {
                    last_error: event.error ?? (status === "error" ? "Falha na conexão" : null),
                  }
                : {}),
            })
            .eq("id", row.id);
        }

        return json({ ok: true, event_type: event.eventType, kind: event.kind });
      },
    },
  },
});
