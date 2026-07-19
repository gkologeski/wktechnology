// Sprint H — Fase 2: endpoint público para o pg_cron acionar recorrências.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/recurrences-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("apikey") ?? request.headers.get("authorization");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const cleaned = authHeader?.replace(/^Bearer\s+/i, "");
        if (!expected || !cleaned || cleaned !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
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
