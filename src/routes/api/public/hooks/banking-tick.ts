import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";
import { tickAllBankConnections } from "@/lib/banking/tick.server";

export const Route = createFileRoute("/api/public/hooks/banking-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("banking-tick", async () => {
          const r = await tickAllBankConnections();
          return r;
        });
        if (run.status === "error") {
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        }
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async () => Response.json({ ok: true, hint: "POST with Bearer CRON_SECRET to run" }),
    },
  },
});
