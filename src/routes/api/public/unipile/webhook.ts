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

        const body = await request.text();
        const signature =
          SIGNATURE_HEADERS.map((h) => request.headers.get(h)).find((v) => !!v) ?? null;

        if (!verifySignature(body, signature, secret)) {
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

        // --- Opt-out on reply: mensagem recebida no LinkedIn ---
        if (event.kind === "message_received" && unipileAccountId) {
          let msg = event.message!;

          // v2 reduzido: busca os dados completos da mensagem.
          if (msg.needsHydration && msg.messageId) {
            const full = await hydrateV2Message(unipileAccountId, msg.messageId);
            if (full) {
              msg = {
                ...msg,
                senderProviderId: msg.senderProviderId ?? full.senderProviderId,
                text: msg.text ?? full.text,
                chatId: msg.chatId ?? full.chatId,
                isSelfSent: msg.isSelfSent || full.isSelfSent,
              };
            }
          }

          // Guard: ignora echo do próprio outbound (nossos envios de sourcing).
          if (msg.isSelfSent) {
            return json({ ok: true, event: "self_echo_ignored" });
          }

          const senderId = msg.senderProviderId;
          if (senderId) {
            const { data: acc } = await supabaseAdmin
              .from("unipile_accounts")
              .select("id, owner_id")
              .eq("unipile_account_id", unipileAccountId)
              .maybeSingle();
            if (acc) {
              // localiza candidato pelo último log de mensagem/convite enviado
              // a esse provider_id
              const { data: log } = await supabaseAdmin
                .from("unipile_message_log")
                .select("candidate_id")
                .eq("account_id", acc.id)
                .eq("target_identifier", String(senderId))
                .not("candidate_id", "is", null)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (log?.candidate_id) {
                // Pausa qualquer enrollment ativo desse candidato para esse owner.
                const { data: updated } = await supabaseAdmin
                  .from("ats_sourcing_enrollments")
                  .update({
                    status: "replied",
                    finished_at: new Date().toISOString(),
                    next_run_at: null,
                    last_error: "Opt-out automático: candidato respondeu no LinkedIn",
                  } as never)
                  .eq("owner_id", acc.owner_id)
                  .eq("candidate_id", log.candidate_id)
                  .eq("status", "active")
                  .select("id");

                // Registra a resposta para auditoria/timeline
                await supabaseAdmin.from("unipile_message_log").insert({
                  account_id: acc.id,
                  owner_id: acc.owner_id,
                  kind: "reply",
                  target_identifier: String(senderId),
                  candidate_id: log.candidate_id,
                  body: (msg.text ?? "").slice(0, 4000) || null,
                  status: "received",
                  sent_at: new Date().toISOString(),
                } as never);

                return json({
                  ok: true,
                  event: "reply_processed",
                  paused_enrollments: updated?.length ?? 0,
                });
              }
            }
          }
          return json({ ok: true, event: "reply_no_match" });
        }

        // Eventos de mensageria irrelevantes (message.sent, message.read, ...)
        if (event.kind === "unknown" && !connectToken && !unipileAccountId) {
          return json({ ok: true, event: "ignored", event_type: event.eventType });
        }

        if (!connectToken && !unipileAccountId) {
          return new Response("Missing identifiers", { status: 200 });
        }

        // Busca o registro pelo connect_token/state (preferência) ou unipile_account_id
        let query = supabaseAdmin.from("unipile_accounts").select("id, owner_id").limit(1);
        if (connectToken) {
          query = query.eq("connect_token", connectToken);
        } else if (unipileAccountId) {
          query = query.eq("unipile_account_id", unipileAccountId);
        }
        const { data: row } = await query.maybeSingle();

        if (row) {
          const nowIso = new Date().toISOString();
          let status: "connected" | "disconnected" | "error" | null = null;
          if (event.kind === "account_connected" && unipileAccountId) status = "connected";
          else if (event.kind === "account_disconnected") status = "disconnected";
          else if (event.kind === "account_failed") status = "error";

          await supabaseAdmin
            .from("unipile_accounts")
            .update({
              last_seen_at: nowIso,
              ...(status ? { status } : {}),
              ...(status === "connected"
                ? {
                    unipile_account_id: unipileAccountId,
                    connected_at: nowIso,
                    last_error: null,
                  }
                : {}),
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
