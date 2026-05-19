// Endpoint chamado pelo pg_cron a cada minuto para processar enrollments
// de sequências cujo next_run_at já passou.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickSequences } from "@/lib/sequences/engine.server";

export const Route = createFileRoute("/api/public/hooks/sequences-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await tickSequences(supabaseAdmin, 100);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[sequences-tick] error", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async () => Response.json({ ok: true, info: "POST to tick" }),
    },
  },
});
