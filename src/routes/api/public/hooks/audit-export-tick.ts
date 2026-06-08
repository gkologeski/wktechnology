// Cron tick: executa exportações de audit logs cuja agenda vence.
// Chamado por pg_cron via /api/public/hooks/audit-export-tick com header apikey.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runAuditExport } from "@/lib/audit-export.server";

export const Route = createFileRoute("/api/public/hooks/audit-export-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        const got = request.headers.get("apikey");
        if (!expected || got !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { data: exports } = await supabaseAdmin
          .from("audit_exports")
          .select("id, workspace_id, last_run_at, schedule_cron")
          .eq("enabled", true);
        const results: Array<{ id: string; ok: boolean }> = [];
        for (const ex of exports ?? []) {
          // Heurística simples: roda se nunca rodou ou se passou >= 1h.
          const last = ex.last_run_at ? new Date(ex.last_run_at).getTime() : 0;
          if (Date.now() - last < 3600_000) continue;
          const r = await runAuditExport(ex.id, ex.workspace_id);
          results.push({ id: ex.id, ok: r.ok });
        }
        return Response.json({ ran: results.length, results });
      },
    },
  },
});
