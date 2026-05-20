// Endpoint chamado pelo pg_cron a cada minuto para processar broadcasts pendentes.
import { createFileRoute } from "@tanstack/react-router";
import { tickEmailBroadcasts } from "@/lib/email-broadcast/engine.server";

export const Route = createFileRoute("/api/public/hooks/email-broadcast-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const r = await tickEmailBroadcasts(5);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          console.error("[email-broadcast-tick]", e);
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
