import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickSequences } from "@/lib/sequences/engine.server";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/sequences-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("sequences-tick", async () => {
          const r = await tickSequences(supabaseAdmin, 100);
          return r as unknown as Record<string, unknown>;
        });
        if (run.status === "error") {
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        }
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
