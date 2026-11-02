import { requireCronAuth } from "@/lib/cron-auth.server";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { scheduledSequenceTick } from "@/lib/prospecting/sequences/tick.server";
export const Route = createFileRoute("/api/public/hooks/sequences-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => scheduledSequenceTick(request, supabaseAdmin),
      GET: async ({ request }) =>
        requireCronAuth(request) ??
        Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
