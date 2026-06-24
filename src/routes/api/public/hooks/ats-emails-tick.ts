// Endpoint chamado pelo pg_cron a cada minuto para processar:
//   - fila de e-mails ao candidato (ats_candidate_email_queue)
//   - fila de e-mails de stage (ats_stage_email_log status='pending')
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import {
  tickAtsCandidateEmails,
  tickAtsStageEmails,
} from "@/lib/ats/email-engine.server";

export const Route = createFileRoute("/api/public/hooks/ats-emails-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const [candidate, stage] = await Promise.all([
            tickAtsCandidateEmails(20),
            tickAtsStageEmails(20),
          ]);
          return Response.json({ ok: true, candidate, stage });
        } catch (e) {
          console.error("[ats-emails-tick]", e);
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
