// Sprint H — Fase 2: endpoint público para o pg_cron acionar recorrências. Auth: Bearer CRON_SECRET.
import { createFileRoute } from "@tanstack/react-router";
import { requireFinanceCronAuth } from "@/lib/access-control/finance-cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/recurrences-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = await requireFinanceCronAuth(request, "recurrences");
        if (unauth) return unauth;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runAllDueRecurrences } = await import("@/lib/finance-recurrences.server");
        try {
          const result = await runAllDueRecurrences(supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[recurrences-tick] fatal", err);
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
