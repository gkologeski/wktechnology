// Tick para Onda 5 Slice 2 — processa enrollments de sourcing sequences
// com next_run_at vencido. Chamado por pg_cron via supabase--cron-schedule.
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { processDueEnrollments } from "@/lib/ats/sourcing-sequences-worker.server";

export const Route = createFileRoute("/api/public/hooks/sourcing-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const result = await processDueEnrollments(50);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[sourcing-tick]", e);
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
