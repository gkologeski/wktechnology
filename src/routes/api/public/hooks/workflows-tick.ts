// Endpoint chamado pelo pg_cron a cada minuto para processar eventos pendentes
// da fila `workflow_events`. Cada evento é avaliado contra os workflows ativos
// do mesmo owner e cria entradas em `workflow_runs`.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickWorkflows } from "@/lib/workflows/engine.server";

export const Route = createFileRoute("/api/public/hooks/workflows-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await tickWorkflows(supabaseAdmin, 50);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[workflows-tick] error", e);
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
