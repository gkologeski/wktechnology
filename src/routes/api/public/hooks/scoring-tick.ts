// Endpoint chamado pelo pg_cron para aplicar regras de Lead Scoring
// contra a fila workflow_events.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickScoring } from "@/lib/scoring/engine.server";

export const Route = createFileRoute("/api/public/hooks/scoring-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await tickScoring(supabaseAdmin, 200);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[scoring-tick] error", e);
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
