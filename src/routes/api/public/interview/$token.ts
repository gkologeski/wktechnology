// Endpoint público para o candidato confirmar um horário de entrevista
// (auto-agendamento). Usa o token enviado por e-mail.
import { createFileRoute } from "@tanstack/react-router";
import { confirmSelfScheduledSlot } from "@/lib/ats/interviews-engine.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export const Route = createFileRoute("/api/public/interview/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token) return new Response("missing token", { status: 400 });
        const { data: row } = await admin
          .from("ats_interviews")
          .select(
            "id, status, slots, duration_min, kind, self_schedule_expires_at, job_id, candidate_id",
          )
          .eq("self_schedule_token", token)
          .maybeSingle();
        if (!row) return new Response("not found", { status: 404 });
        if (row.self_schedule_expires_at && new Date(row.self_schedule_expires_at) < new Date()) {
          return Response.json({ ok: false, error: "expired" }, { status: 410 });
        }
        const [{ data: job }, { data: cand }] = await Promise.all([
          admin.from("ats_jobs").select("title").eq("id", row.job_id).maybeSingle(),
          admin.from("ats_candidates").select("full_name").eq("id", row.candidate_id).maybeSingle(),
        ]);
        return Response.json({
          ok: true,
          status: row.status,
          slots: row.slots ?? [],
          duration_min: row.duration_min,
          kind: row.kind,
          job_title: job?.title ?? null,
          candidate_name: cand?.full_name ?? null,
        });
      },
      POST: async ({ params, request }) => {
        const token = params.token;
        if (!token) return new Response("missing token", { status: 400 });
        const body = (await request.json().catch(() => null)) as { slot?: string } | null;
        if (!body?.slot) return Response.json({ ok: false, error: "missing slot" }, { status: 400 });
        const res = await confirmSelfScheduledSlot({ token, slot: body.slot });
        if (!res.ok) return Response.json(res, { status: 400 });
        return Response.json(res);
      },
    },
  },
});
