import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { tickAtsCandidateEmails, tickAtsStageEmails } from "@/lib/ats/email-engine.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/ats-emails-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("ats-emails-tick", async () => {
          const [candidate, stage] = await Promise.all([
            tickAtsCandidateEmails(20),
            tickAtsStageEmails(20),
          ]);
          return { candidate, stage } as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
