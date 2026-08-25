import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runAuditExport } from "@/lib/audit-export.server";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/audit-export-tick")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("audit-export-tick", async () => {
          const { data: exports } = await supabaseAdmin
            .from("audit_exports")
            .select("id, workspace_id, last_run_at, schedule_cron")
            .eq("enabled", true);
          const results: Array<{ id: string; ok: boolean }> = [];
          for (const ex of exports ?? []) {
            const last = ex.last_run_at ? new Date(ex.last_run_at).getTime() : 0;
            if (Date.now() - last < 3600_000) continue;
            const r = await runAuditExport(ex.id, ex.workspace_id);
            results.push({ id: ex.id, ok: r.ok });
          }
          return { ran: results.length, results } as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
    },
  },
});
