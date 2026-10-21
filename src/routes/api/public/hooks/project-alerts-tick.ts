import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

// Avaliação agendada dos alertas de risco do TechProjects.
// Só avalia workspaces cujo admin ligou "avaliação automática" nas regras versionadas (padrão: desligado),
// no máximo uma vez a cada ~20 h por workspace, com trava por workspace no banco.
// Grava apenas alertas/eventos/execuções; não altera apontamentos, projetos nem envia aviso externo.
// Exige Bearer CRON_SECRET.
export const Route = createFileRoute("/api/public/hooks/project-alerts-tick")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("project-alerts-tick", async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("project_alert_scheduled_tick", {
            p_limit: 5,
          });
          if (error) throw new Error(error.message);
          return (data ?? {}) as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
    },
  },
});
