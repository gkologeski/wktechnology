// Endpoint chamado pelo pg_cron a cada hora para processar agendamentos
// de exportação de relatórios vencidos.
import { createFileRoute } from "@tanstack/react-router";
import { tickScheduledExports } from "@/lib/scheduled-exports/engine.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/scheduled-exports-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const result = await tickScheduledExports(25);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[scheduled-exports-tick] error", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
