import { createFileRoute } from "@tanstack/react-router";
import { runWebhookDispatch } from "@/lib/webhooks/dispatcher.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/webhook-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const r = await runWebhookDispatch();
        return Response.json({ ok: true, ...r });
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
