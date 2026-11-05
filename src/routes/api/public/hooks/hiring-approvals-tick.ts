import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";
export const Route = createFileRoute("/api/public/hooks/hiring-approvals-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireCronAuth(request);
        if (denied) return denied;
        const run = await runCronWithLogging("hiring-approvals-tick", async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { dispatchHiringEmails } = await import("@/lib/hiring/hiring-email.server");
          return dispatchHiringEmails(supabaseAdmin);
        });
        return Response.json(
          { ok: run.status !== "error", ...run.metrics },
          { status: run.status === "error" ? 500 : 200 },
        );
      },
    },
  },
});
