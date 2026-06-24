// Cron: lembretes D-1 e 1h antes das entrevistas do ATS.
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { tickAtsInterviewReminders } from "@/lib/ats/interviews-engine.server";

export const Route = createFileRoute("/api/public/hooks/ats-interview-reminders-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const res = await tickAtsInterviewReminders(30);
          return Response.json({ ok: true, ...res });
        } catch (e) {
          console.error("[ats-interview-reminders-tick]", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
