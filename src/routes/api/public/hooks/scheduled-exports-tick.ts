// Endpoint chamado pelo pg_cron a cada hora para processar agendamentos
// de exportação de relatórios vencidos.
import { createFileRoute } from "@tanstack/react-router";
import { tickScheduledExports } from "@/lib/scheduled-exports/engine.server";

export const Route = createFileRoute("/api/public/hooks/scheduled-exports-tick")({
  server: {
    handlers: {
      POST: async () => {
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
      GET: async () => Response.json({ ok: true, info: "POST to tick" }),
    },
  },
});
