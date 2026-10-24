import { requireFinanceCronAuth } from "@/lib/access-control/finance-cron-auth.server";
// Fase 7 — Cron público para processar a régua de cobrança.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/dunning-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireFinanceCronAuth(request, "dunning");
        if (unauth) return unauth;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processDunningRuns } = await import("@/lib/dunning-runner.server");
        try {
          const result = await processDunningRuns(supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[dunning-tick] fatal", err);
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
