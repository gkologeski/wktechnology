import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging, logCronRejection } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/meeting-reminders-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) {
          await logCronRejection("meeting-reminders-tick");
          return unauth;
        }
        const run = await runCronWithLogging("meeting-reminders-tick", async () => {
          const { tickMeetingReminders } = await import("@/lib/whatsapp/meeting-reminders.server");
          return (await tickMeetingReminders(300)) as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        return Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" });
      },
    },
  },
});
