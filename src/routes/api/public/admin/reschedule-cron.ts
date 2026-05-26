// One-shot admin endpoint: re-registers all pg_cron jobs so they send
// Authorization: Bearer <CRON_SECRET> when calling the protected tick endpoints.
//
// Call once with:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//     https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/admin/reschedule-cron
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/admin/reschedule-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const secret = process.env.CRON_SECRET!;
        const { data, error } = await supabaseAdmin.rpc(
          "reschedule_lovable_cron" as never,
          { p_secret: secret } as never,
        );
        if (error) {
          console.error("[reschedule-cron]", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, result: data });
      },
      GET: async () =>
        Response.json({ ok: true, info: "POST with Bearer CRON_SECRET to reschedule pg_cron jobs" }),
    },
  },
});
