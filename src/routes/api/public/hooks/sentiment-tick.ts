import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { tickSentiment } from "@/lib/sentiment/engine.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/sentiment-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const r = await tickSentiment(30);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "erro" },
            { status: 500 },
          );
        }
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
