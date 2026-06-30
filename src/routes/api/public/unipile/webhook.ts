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
        const status =
          payload.status ?? payload.event ?? payload.type ?? payload.account_status ?? "";
        const unipileAccountId =
          payload.account_id ?? payload.id ?? payload.account?.id ?? null;
        const connectToken = payload.name ?? payload.connect_token ?? null;
        const errorMsg = payload.error ?? payload.message ?? null;

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
          const patch: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
          if (isSuccess && unipileAccountId) {
            patch.status = "connected";
            patch.unipile_account_id = unipileAccountId;
            patch.connected_at = new Date().toISOString();
            patch.last_error = null;
          } else if (isDisconnect) {
            patch.status = "disconnected";
            patch.last_error = errorMsg ?? null;
          } else if (isFailure) {
            patch.status = "error";
            patch.last_error = errorMsg ?? "Falha na conexão";
          }
          await supabaseAdmin.from("unipile_accounts").update(patch).eq("id", row.id);
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
