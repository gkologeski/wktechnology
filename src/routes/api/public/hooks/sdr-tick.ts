import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

function cronInfo() {
  return Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" });
}

export const Route = createFileRoute("/api/public/hooks/sdr-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { tickSdr } = await import("@/lib/prospecting/sdr/worker.server");
        const { tickServiceAgents } = await import("@/lib/prospecting/sdr/service-worker.server");
        const run = await runCronWithLogging("sdr-tick", async () => {
          // Start independently: a waiting or failing channel cannot starve the other.
          const [whatsapp, service] = await Promise.allSettled([
            tickSdr(supabaseAdmin, 10),
            tickServiceAgents(supabaseAdmin, 3),
          ]);
          const failed = [
            whatsapp.status === "rejected" ? "WhatsApp" : null,
            service.status === "rejected" ? "e-mail/chat" : null,
          ].filter(Boolean);
          if (whatsapp.status === "rejected" || service.status === "rejected")
            throw new Error(`Falha no processamento dos canais: ${failed.join(", ")}`);
          return { ...whatsapp.value, email_chat: service.value };
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async () => cronInfo(),
    },
  },
});
