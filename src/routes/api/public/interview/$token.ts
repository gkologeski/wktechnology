// Endpoint público para o candidato confirmar horário e/ou enviar
// respostas em vídeo assíncrono. Usa o token enviado por e-mail.
import { createFileRoute } from "@tanstack/react-router";
import { confirmSelfScheduledSlot } from "@/lib/ats/interviews-engine.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;
const BUCKET = "ats-async-videos";

type Question = {
  id: string;
  text: string;
  kind?: "text" | "video";
  time_limit_sec?: number;
  max_takes?: number;
};

export const Route = createFileRoute("/api/public/interview/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token) return new Response("missing token", { status: 400 });
        const { data: row } = await admin
          .from("ats_interviews")
          .select(
            "id, owner_id, status, slots, duration_min, kind, self_schedule_expires_at, job_id, candidate_id, interview_kit_id, async_questions_snapshot",
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

        // Resolve perguntas: snapshot prevalece, depois kit referenciado.
        let questions: Question[] = Array.isArray(row.async_questions_snapshot)
          ? (row.async_questions_snapshot as Question[])
          : [];
        if (questions.length === 0 && row.interview_kit_id) {
          const { data: kit } = await admin
            .from("ats_interview_kits")
            .select("questions")
            .eq("id", row.interview_kit_id)
            .maybeSingle();
          if (Array.isArray(kit?.questions)) questions = kit.questions as Question[];
        }

        // Lista respostas já enviadas (para retomada)
        const { data: responses } = await admin
          .from("ats_async_video_responses")
          .select("question_id, storage_path, created_at")
          .eq("interview_id", row.id);

        return Response.json({
          ok: true,
          interview_id: row.id,
          owner_id: row.owner_id,
          status: row.status,
          slots: row.slots ?? [],
          duration_min: row.duration_min,
          kind: row.kind,
          job_title: job?.title ?? null,
          candidate_name: cand?.full_name ?? null,
          questions,
          submitted_question_ids: (responses ?? []).map(
            (r: { question_id: string }) => r.question_id,
          ),
        });
      },
      POST: async ({ params, request }) => {
        const token = params.token;
        if (!token) return new Response("missing token", { status: 400 });
        const ct = request.headers.get("content-type") ?? "";

        // ---- Upload de vídeo (multipart/form-data) ---------------------------
        if (ct.includes("multipart/form-data")) {
          const { data: row } = await admin
            .from("ats_interviews")
            .select(
              "id, owner_id, kind, self_schedule_expires_at, async_questions_snapshot, interview_kit_id",
            )
            .eq("self_schedule_token", token)
            .maybeSingle();
          if (!row) return new Response("not found", { status: 404 });
          if (row.kind !== "async")
            return Response.json({ ok: false, error: "not_async" }, { status: 400 });
          if (row.self_schedule_expires_at && new Date(row.self_schedule_expires_at) < new Date())
            return Response.json({ ok: false, error: "expired" }, { status: 410 });

          const form = await request.formData();
          const questionId = String(form.get("question_id") ?? "");
          const duration = Number(form.get("duration_sec") ?? 0) || null;
          const file = form.get("file") as File | null;
          if (!questionId || !file)
            return Response.json({ ok: false, error: "missing_fields" }, { status: 400 });
          if (file.size > 100 * 1024 * 1024)
            return Response.json({ ok: false, error: "file_too_large" }, { status: 413 });

          // valida que questionId pertence ao kit/snapshot
          let questions: Question[] = Array.isArray(row.async_questions_snapshot)
            ? (row.async_questions_snapshot as Question[])
            : [];
          if (questions.length === 0 && row.interview_kit_id) {
            const { data: kit } = await admin
              .from("ats_interview_kits")
              .select("questions")
              .eq("id", row.interview_kit_id)
              .maybeSingle();
            if (Array.isArray(kit?.questions)) questions = kit.questions as Question[];
          }
          if (!questions.find((q) => q.id === questionId))
            return Response.json({ ok: false, error: "invalid_question" }, { status: 400 });

          const ext = (file.type.split("/")[1] || "webm").split(";")[0];
          const path = `${row.owner_id}/${row.id}/${questionId}-${Date.now()}.${ext}`;
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
            contentType: file.type || "video/webm",
            upsert: false,
          });
          if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 });

          const { error: insErr } = await admin.from("ats_async_video_responses").insert({
            owner_id: row.owner_id,
            interview_id: row.id,
            question_id: questionId,
            storage_path: path,
            duration_sec: duration,
            mime_type: file.type || "video/webm",
            size_bytes: file.size,
          });
          if (insErr) return Response.json({ ok: false, error: insErr.message }, { status: 500 });
          return Response.json({ ok: true });
        }

        // ---- Confirmação de slot (JSON) --------------------------------------
        const body = (await request.json().catch(() => null)) as { slot?: string } | null;
        if (!body?.slot)
          return Response.json({ ok: false, error: "missing slot" }, { status: 400 });
        const res = await confirmSelfScheduledSlot({ token, slot: body.slot });
        if (!res.ok) return Response.json(res, { status: 400 });
        return Response.json(res);
      },
    },
  },
});
