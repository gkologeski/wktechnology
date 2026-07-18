import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickServicesBilling } from "@/lib/services/billing.server";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/services-billing-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("services-billing-tick", async () => {
          const r = await tickServicesBilling(supabaseAdmin, 200);
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
