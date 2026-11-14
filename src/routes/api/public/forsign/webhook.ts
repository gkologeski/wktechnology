import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { timestampFresh, verifyForsignSignature } from "@/lib/integrations/forsign/forsign-core";

// Avisos do ForSign. Exige HMAC-SHA256 com o segredo do webhook do workspace e horário recente;
// o conteúdo do aviso só aponta a operação — a situação real é sempre reconsultada na API.
export const Route = createFileRoute("/api/public/forsign/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ws = new URL(request.url).searchParams.get("w") ?? "";
        if (!z.string().uuid().safeParse(ws).success)
          return new Response("Bad request", { status: 400 });
        const raw = await request.text();
        if (raw.length > 512_000) return new Response("Too large", { status: 413 });
        const { webhookSecretFor, handleWebhookEvent } =
          await import("@/lib/integrations/forsign/forsign-service.server");
        const secret = await webhookSecretFor(ws).catch(() => null);
        if (
          !secret ||
          !timestampFresh(request.headers.get("x-forsign-timestamp")) ||
          !(await verifyForsignSignature(raw, request.headers.get("x-forsign-signature"), secret))
        )
          return new Response("Unauthorized", { status: 401 });
        let evt: unknown;
        try {
          evt = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        try {
          await handleWebhookEvent(ws, evt as Record<string, unknown>);
        } catch (e) {
          console.error("forsign webhook", e instanceof Error ? e.message : "erro");
          return new Response("Retry", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
