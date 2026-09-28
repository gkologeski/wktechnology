// Agendado (pg_cron) às 8h, 11h, 14h e 17h BRT. Auth: Bearer CRON_SECRET.
import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { probeTwilioVoiceCredentials, saveCallHealth } from "@/lib/twilio-voice-probe.server";

export const Route = createFileRoute("/api/public/hooks/channel-health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const r = await probeTwilioVoiceCredentials();
        await saveCallHealth(r);
        return Response.json({ ok: true, call: { ready: r.ok, transient: r.transient } });
      },
    },
  },
});
