// Webhook público chamado pela Unipile quando uma conta termina o
// fluxo Hosted Auth (sucesso/erro) ou muda de estado.
//
// Auth: validamos HMAC SHA-256 sobre o corpo cru usando
// UNIPILE_WEBHOOK_SECRET. Sem header válido => 401.
//
// Idempotência: o payload identifica a conta por `name` (o
// connect_token gerado em startLinkedinConnect) e por account_id.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_HEADERS = [
  "x-unipile-signature",
  "x-webhook-signature",
  "x-signature",
];

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

        // Eventos esperados:
        //  - creation_success / account.connected => grava unipile_account_id
        //  - creation_failed                       => marca error
        //  - credentials_invalid / account.disconnected => marca disconnected
        //  - message_received / new_message        => pausa enrollments (opt-out on reply)
        const status =
          payload.status ?? payload.event ?? payload.type ?? payload.account_status ?? "";
        const unipileAccountId =
          payload.account_id ?? payload.id ?? payload.account?.id ?? null;
        const connectToken = payload.name ?? payload.connect_token ?? null;
        const errorMsg = payload.error ?? payload.message ?? null;

        // --- Opt-out on reply: detecta mensagem recebida no LinkedIn ---
        const statusStr = String(status).toLowerCase();
        const isIncomingMessage =
          statusStr.includes("message_received") ||
          statusStr.includes("new_message") ||
          statusStr === "message.received" ||
          statusStr === "messaging.received";
        if (isIncomingMessage && unipileAccountId) {
          // provider_id do remetente (candidato)
          const senderId =
            payload.sender?.provider_id ??
            payload.sender_id ??
            payload.from?.provider_id ??
            payload.attendee_provider_id ??
            null;
          if (senderId) {
            const { data: acc } = await supabaseAdmin
              .from("unipile_accounts")
              .select("id, owner_id")
              .eq("unipile_account_id", unipileAccountId)
              .maybeSingle();
            if (acc) {
              // localiza candidato pelo último log de mensagem/convite enviado a esse provider_id
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
                await supabaseAdmin
                  .from("ats_sourcing_enrollments")
                  .update({
                    status: "replied",
                    finished_at: new Date().toISOString(),
                  } as never)
                  .eq("owner_id", acc.owner_id)
                  .eq("candidate_id", log.candidate_id)
                  .eq("status", "active");
              }
            }
          }
          return new Response(JSON.stringify({ ok: true, event: "reply_processed" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!connectToken && !unipileAccountId) {
          return new Response("Missing identifiers", { status: 200 });
        }

        // Busca o registro pelo connect_token (preferência) ou unipile_account_id
        let query = supabaseAdmin
          .from("unipile_accounts")
          .select("id, owner_id")
          .limit(1);
        if (connectToken) {
          query = query.eq("connect_token", connectToken);
        } else if (unipileAccountId) {
          query = query.eq("unipile_account_id", unipileAccountId);
        }
        const { data: row } = await query.maybeSingle();

        const isSuccess =
          String(status).toLowerCase().includes("success") ||
          String(status).toLowerCase().includes("connected") ||
          String(status).toLowerCase() === "ok";
        const isFailure =
          String(status).toLowerCase().includes("fail") ||
          String(status).toLowerCase().includes("invalid") ||
          String(status).toLowerCase().includes("error");
        const isDisconnect =
          String(status).toLowerCase().includes("disconnect") ||
          String(status).toLowerCase().includes("credentials_invalid");

        if (row) {
          const nowIso = new Date().toISOString();
          let status: "connected" | "disconnected" | "error" | null = null;
          if (isSuccess && unipileAccountId) status = "connected";
          else if (isDisconnect) status = "disconnected";
          else if (isFailure) status = "error";

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
                ? { last_error: errorMsg ?? (status === "error" ? "Falha na conexão" : null) }
                : {}),
            })
            .eq("id", row.id);
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
