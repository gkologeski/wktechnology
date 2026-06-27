// Fase 4 / Slice 2 — Webhook de captura de respostas inbound por e-mail.
//
// Casa de respostas de candidatos com enrollments ativos da sequência.
// Autenticação via Bearer CRON_SECRET (compartilhado com o relay/forwarder).
//
// Payload esperado:
// {
//   "owner_id": "<uuid do recrutador dono das sequências>",
//   "from_email": "candidato@exemplo.com",
//   "subject": "Re: ...",
//   "snippet": "trecho do corpo"
// }
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { recordAtsEvent } from "@/lib/ats/audit.server";

const Payload = z.object({
  owner_id: z.string().uuid(),
  from_email: z.string().email(),
  subject: z.string().max(500).optional(),
  snippet: z.string().max(4000).optional(),
});

export const Route = createFileRoute("/api/public/hooks/sourcing-inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const parsed = Payload.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: "invalid_payload", details: parsed.error.flatten() },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ownerId = parsed.data.owner_id;
        const fromEmail = parsed.data.from_email.toLowerCase().trim();

        // 1) candidato dono = owner_id + email
        const { data: candidate } = await supabaseAdmin
          .from("ats_candidates")
          .select("id, email")
          .eq("owner_id", ownerId)
          .ilike("email", fromEmail)
          .maybeSingle();

        if (!candidate) {
          return Response.json({ ok: true, matched: false, reason: "no_candidate" });
        }

        // 2) enrollments ativos desse candidato
        const { data: enrollments } = await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .select("id, current_step, status")
          .eq("owner_id", ownerId)
          .eq("candidate_id", candidate.id)
          .in("status", ["active", "paused"]);

        const list = enrollments ?? [];
        if (list.length === 0) {
          return Response.json({ ok: true, matched: true, updated: 0 });
        }

        const nowIso = new Date().toISOString();
        const ids = list.map((e) => e.id as string);

        await supabaseAdmin
          .from("ats_sourcing_enrollments")
          .update({
            status: "replied",
            finished_at: nowIso,
            last_error: null,
          } as never)
          .in("id", ids);

        // log + audit por enrollment
        const logRows = list.map((e) => ({
          enrollment_id: e.id as string,
          owner_id: ownerId,
          step_order: (e.current_step as number) ?? 0,
          channel: "inbound",
          status: "replied",
          metadata: {
            source: "email_webhook",
            from: fromEmail,
            subject: parsed.data.subject ?? null,
            snippet: parsed.data.snippet ?? null,
            at: nowIso,
          } as never,
        }));
        await supabaseAdmin.from("ats_sourcing_step_log").insert(logRows as never);

        // marca relacionamento do candidato
        await supabaseAdmin
          .from("ats_candidates")
          .update({
            relationship_status: "engaged",
            last_touch_at: nowIso,
          } as never)
          .eq("id", candidate.id);

        for (const e of list) {
          try {
            await recordAtsEvent(supabaseAdmin, {
              ownerId,
              name: "ats.sequence.replied",
              entityType: "enrollment",
              entityId: e.id as string,
              payload: { channel: "email", source: "webhook", from: fromEmail },
            });
          } catch {
            /* swallow audit failures */
          }
        }

        return Response.json({ ok: true, matched: true, updated: list.length });
      },
      GET: async () =>
        Response.json({
          ok: true,
          info: "POST with Bearer CRON_SECRET and JSON { owner_id, from_email, subject?, snippet? }",
        }),
    },
  },
});
