// Fase 7 — Cron público para processar a régua de cobrança.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/dunning-tick")({
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
