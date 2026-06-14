import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickOnce } from "@/lib/integrations/hubspot-tick.server";
import { pushAllForOwner } from "@/lib/integrations/hubspot-push.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/hubspot-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const importResult = await tickOnce(supabaseAdmin);

          // Auto-push: para cada workspace com hubspot.config.auto_push_enabled = true,
          // dispara um push leve (10 por entidade) das 3 entidades.
          const pushResults: Array<{ owner: string; results: unknown }> = [];
          try {
            const { data: owners } = await supabaseAdmin
              .from("integrations")
              .select("owner_id, config")
              .eq("provider", "hubspot")
              .eq("status", "connected")
              .limit(50);
            const enabled = (owners ?? []).filter(
              (o) =>
                (o.config as { auto_push_enabled?: boolean } | null)?.auto_push_enabled === true,
            );
            for (const o of enabled) {
              try {
                const res = await pushAllForOwner(supabaseAdmin, o.owner_id as string, 10);
                pushResults.push({ owner: o.owner_id as string, results: res });
              } catch (e) {
                pushResults.push({
                  owner: o.owner_id as string,
                  results: { error: e instanceof Error ? e.message : String(e) },
                });
              }
            }
          } catch (e) {
            console.error("[hubspot-tick] auto-push scan failed", e);
          }

          return Response.json({ ok: true, import: importResult, push: pushResults });
        } catch (e) {
          console.error("[hubspot-tick] error", e);
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
