// Webhook da Apollo.io para entrega assíncrona de telefones revelados.
// Auth: querystring `?secret=` comparada com APOLLO_WEBHOOK_SECRET (a Apollo
// não envia headers customizados). Sem o segredo configurado, a rota recusa.
import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/apollo-phone")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["APOLLO_WEBHOOK_SECRET"];
        if (!expected) {
          return Response.json({ ok: false, error: "Webhook não configurado" }, { status: 503 });
        }
        const provided = new URL(request.url).searchParams.get("secret");
        if (provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        }

        try {
          const { applyApolloPhonePayload } =
            await import("@/lib/integrations/apollo-phone-webhook.server");
          const updated = await applyApolloPhonePayload(payload as never);
          return Response.json({ ok: true, updated });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "erro" },
            { status: 500 },
          );
        }
      },
      GET: async () =>
        Response.json({
          ok: true,
          info: "POST payload da Apollo com ?secret=APOLLO_WEBHOOK_SECRET",
        }),
    },
  },
});
