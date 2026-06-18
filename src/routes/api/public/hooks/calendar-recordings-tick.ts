import { createFileRoute } from "@tanstack/react-router";
import { tickAllRecordings } from "@/lib/calendar/engine.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/calendar-recordings-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const res = await tickAllRecordings();
          return Response.json({ ok: true, ...res });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST with Bearer CRON_SECRET" }),
    },
  },
});
