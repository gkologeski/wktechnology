import { createFileRoute } from "@tanstack/react-router";
import { runWebhookDispatch } from "@/lib/webhooks/dispatcher.server";

export const Route = createFileRoute("/api/public/hooks/webhook-tick")({
  server: {
    handlers: {
      POST: async () => {
        const r = await runWebhookDispatch();
        return Response.json({ ok: true, ...r });
      },
    },
  },
});
