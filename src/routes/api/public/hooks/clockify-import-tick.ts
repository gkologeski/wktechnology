import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

// Avança em segundo plano execuções de importação de horas (Clockify e Jibble) já iniciadas
// por um admin.
// Nunca inicia importação sozinho. Exige Bearer CRON_SECRET.
export const Route = createFileRoute("/api/public/hooks/clockify-import-tick")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("clockify-import-tick", async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { advanceClockifyRun } =
            await import("@/lib/integrations/clockify/clockify-service.server");
          const { data: runs } = await supabaseAdmin
            .from("clockify_import_runs")
            .select("id, workspace_id")
            .in("status", ["queued", "running", "cancel_requested"])
            .limit(5);
          let advanced = 0;
          for (const r of runs ?? []) {
            const res = await advanceClockifyRun(r.workspace_id, r.id).catch(() => ({
              advanced: false,
            }));
            if (res.advanced) advanced++;
          }
          // Mesmo agendador para o Jibble (tabelas multi-provedor), sem job paralelo.
          const { advanceJibbleRun } =
            await import("@/lib/integrations/jibble/jibble-service.server");
          const { data: jbRuns } = await supabaseAdmin
            .from("time_import_runs")
            .select("id, workspace_id")
            .eq("provider", "jibble")
            .in("status", ["queued", "running", "cancel_requested"])
            .limit(5);
          for (const r of jbRuns ?? []) {
            const res = await advanceJibbleRun(r.workspace_id, r.id).catch(() => ({
              advanced: false,
            }));
            if (res.advanced) advanced++;
          }
          return {
            runs: (runs?.length ?? 0) + (jbRuns?.length ?? 0),
            advanced,
          } as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
    },
  },
});
