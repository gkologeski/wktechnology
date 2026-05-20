// Endpoint público de cancelamento de inscrição.
// GET: confirma e cancela (também aceita POST para clientes "one-click").
import { createFileRoute } from "@tanstack/react-router";
import { recordUnsubscribe } from "@/lib/email-broadcast/engine.server";

function html(body: string) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Cancelar inscrição</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:system-ui,sans-serif;max-width:520px;margin:64px auto;padding:24px;color:#111}h1{font-size:22px}p{color:#555;line-height:1.5}</style></head><body>${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/email/unsubscribe/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const r = await recordUnsubscribe(params.token).catch(() => null);
        if (!r) return html(`<h1>Link inválido</h1><p>Este link de cancelamento não é válido ou já expirou.</p>`);
        return html(`<h1>Inscrição cancelada</h1><p><strong>${r.email}</strong> não receberá mais emails desta lista.</p>`);
      },
      POST: async ({ params }) => {
        const r = await recordUnsubscribe(params.token).catch(() => null);
        if (!r) return new Response("invalid", { status: 404 });
        return new Response("ok");
      },
    },
  },
});
