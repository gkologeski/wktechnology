// POST /api/public/refer/$slug/submit — recebe indicação externa.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordAtsEvent } from "@/lib/ats/audit.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const Payload = z.object({
  referrer_name: z.string().min(1).max(160),
  referrer_email: z.string().email().max(200),
  candidate_name: z.string().min(1).max(160),
  candidate_email: z.string().email().max(200).optional().nullable(),
  candidate_phone: z.string().max(40).optional().nullable(),
  candidate_linkedin: z.string().url().max(500).optional().nullable(),
  relationship: z.string().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // anti-bot
  _hp: z.string().optional(),
  _ts: z.number().optional(),
});

export const Route = createFileRoute("/api/public/refer/$slug/submit")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request, params }) => {
        const body = await request.json().catch(() => null);
        const parsed = Payload.safeParse(body);
        if (!parsed.success)
          return Response.json({ error: parsed.error.flatten() }, { status: 400, headers: cors });

        // honeypot
        if (parsed.data._hp && parsed.data._hp.length > 0)
          return Response.json({ ok: true }, { headers: cors });
        // time-to-fill
        if (parsed.data._ts && Date.now() - parsed.data._ts < 1500)
          return Response.json({ ok: true }, { headers: cors });

        const { data: program, error: pErr } = await supabaseAdmin
          .from("ats_referral_programs")
          .select("id, owner_id, default_bonus_cents, enabled, enable_public_form")
          .eq("public_slug", params.slug)
          .maybeSingle();
        if (pErr) return Response.json({ error: pErr.message }, { status: 500, headers: cors });
        if (!program || !program.enabled || !program.enable_public_form)
          return Response.json({ error: "Not found" }, { status: 404, headers: cors });

        // rate-limit best-effort por IP nos últimos 10 min
        const ip =
          request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || null;
        if (ip) {
          const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const { count } = await supabaseAdmin
            .from("ats_referrals")
            .select("id", { count: "exact", head: true })
            .eq("program_id", program.id)
            .gte("submitted_at", since)
            .ilike("referrer_email", parsed.data.referrer_email);
          if ((count ?? 0) >= 5)
            return Response.json({ error: "Too many submissions" }, { status: 429, headers: cors });
        }

        const { data: row, error } = await supabaseAdmin
          .from("ats_referrals")
          .insert({
            owner_id: program.owner_id,
            program_id: program.id,
            referrer_user_id: null,
            referrer_name: parsed.data.referrer_name,
            referrer_email: parsed.data.referrer_email,
            candidate_name: parsed.data.candidate_name,
            candidate_email: parsed.data.candidate_email ?? null,
            candidate_phone: parsed.data.candidate_phone ?? null,
            candidate_linkedin: parsed.data.candidate_linkedin ?? null,
            relationship: parsed.data.relationship ?? null,
            notes: parsed.data.notes ?? null,
            bonus_cents: program.default_bonus_cents ?? 0,
            source: "public_form",
          } as never)
          .select("id")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });

        await recordAtsEvent(supabaseAdmin, {
          ownerId: program.owner_id,
          name: "ats.referral.submitted",
          entityType: "referral",
          entityId: row.id,
          payload: { source: "public_form", program_id: program.id },
        });

        return Response.json({ ok: true, id: row.id }, { headers: cors });
      },
    },
  },
});
