import { createFileRoute } from "@tanstack/react-router";
/** Disabled until an adapter validates the provider account, authoritative resource,
 * amount/currency, replay identity and applies a single tenant-bound transaction.
 * An unsigned/unsupported notification must never mutate payment or fiscal state. */
export const Route = createFileRoute("/api/public/payments/br-webhook/$provider")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        if (!["asaas", "pagarme", "mercadopago"].includes(params.provider.toLowerCase()))
          return new Response("Unknown provider", { status: 404 });
        return Response.json(
          { error: "Gateway de cobrança não habilitado; evento não processado." },
          { status: 503 },
        );
      },
    },
  },
});
