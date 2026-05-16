// Cron-callable endpoint: avança UM step de qualquer job HubSpot que esteja
// 'queued' ou 'running'. Chamado pelo pg_cron a cada minuto e garante que
// jobs progridam mesmo quando ninguém está olhando o wizard.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickOnce } from "@/lib/integrations/hubspot-tick.server";

export const Route = createFileRoute("/api/public/hooks/hubspot-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          // Executa até 5 ticks em sequência (limite seguro contra timeout do Worker).
          const results = [];
          for (let i = 0; i < 5; i++) {
            const r = await tickOnce(supabaseAdmin);
            results.push(r);
            if (r.kind === "no_job") break;
            if (r.kind === "no_pending") break;
          }
          return Response.json({ ok: true, results });
        } catch (e) {
          console.error("[hubspot-tick] error", e);
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
