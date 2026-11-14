import { workRpc } from "@/lib/access-control/work-core.server";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickWorkflows } from "@/lib/workflows/engine.server";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/workflows-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("workflows-tick", async () => {
          const { cleanupExpiredRoleViews } = await import("@/lib/view-as.server");
          const cleanup = await cleanupExpiredRoleViews();
          if (cleanup.blocked)
            console.warn(
              "[view-as] Contas de teste desativadas aguardando revisão:",
              cleanup.blocked,
            );
          const [workflows, handoffs] = await Promise.allSettled([
            tickWorkflows(supabaseAdmin, 50),
            workRpc<Record<string, number>>(supabaseAdmin, "contract_handoff_tick", {
              p_limit: 30,
            }),
          ]);
          if (workflows.status === "rejected" || handoffs.status === "rejected")
            throw new Error(
              "Falha em um dos processamentos de workflow/encaminhamento. As filas permanecem para nova tentativa.",
            );
          return { ...workflows.value, contract_handoffs: handoffs.value } as unknown as Record<
            string,
            unknown
          >;
        });
        if (run.status === "error") {
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        }
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        return Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" });
      },
    },
  },
});
