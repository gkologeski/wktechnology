import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/sla-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const now = new Date().toISOString();
          const { data: fr, error: e1 } = await supabaseAdmin
            .from("tickets")
            .update({ sla_first_response_breached: true })
            .lt("sla_first_response_due_at", now)
            .is("sla_first_response_at", null)
            .eq("sla_first_response_breached", false)
            .is("deleted_at", null)
            .select("id");
          if (e1) throw e1;
          const { data: rs, error: e2 } = await supabaseAdmin
            .from("tickets")
            .update({ sla_resolution_breached: true })
            .lt("sla_resolution_due_at", now)
            .is("resolved_at", null)
            .eq("sla_resolution_breached", false)
            .is("deleted_at", null)
            .select("id");
          if (e2) throw e2;
          return Response.json({
            ok: true,
            first_response_breaches: fr?.length ?? 0,
            resolution_breaches: rs?.length ?? 0,
          });
        } catch (e) {
          console.error("[sla-tick] error", e);
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
