import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging, logCronRejection } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/activity-reminders-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) {
          await logCronRejection("activity-reminders-tick");
          return unauth;
        }
        const run = await runCronWithLogging("activity-reminders-tick", async () => {
          const { tickActivityReminders } = await import("@/lib/activity-reminders.server");
          const r = await tickActivityReminders(200);
          return r as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
