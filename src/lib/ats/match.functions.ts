// AI Match Score (Fase 3): compara JD ↔ candidato e gera score 0-100
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAi(systemPrompt: string, userPrompt: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`AI Gateway ${r.status}: ${await r.text().catch(() => "")}`);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

export const computeMatchScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ job_id: z.string().uuid(), candidate_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [jobRes, candRes] = await Promise.all([
      supabase
        .from("ats_jobs")
        .select("title, description, requirements, seniority, location")
        .eq("id", data.job_id)
        .single(),
      supabase
        .from("ats_candidates")
        .select("full_name, current_position, current_company, skills, cv_parsed, notes")
        .eq("id", data.candidate_id)
        .single(),
    ]);
    if (jobRes.error || !jobRes.data) throw new Error("Vaga não encontrada");
    if (candRes.error || !candRes.data) throw new Error("Candidato não encontrado");
    const job = jobRes.data;
    const cand = candRes.data;

    const sys =
      'Você é um recrutador sênior. Avalie o match entre a vaga e o candidato. Responda APENAS JSON: {"score":0-100,"summary":"...","strengths":[...],"gaps":[...]}';
    const usr = `VAGA:\nTítulo: ${job.title}\nSenioridade: ${job.seniority ?? "-"}\nLocal: ${job.location ?? "-"}\nDescrição: ${job.description ?? ""}\nRequisitos: ${JSON.stringify(job.requirements ?? [])}\n\nCANDIDATO:\nNome: ${cand.full_name}\nCargo atual: ${cand.current_position ?? "-"} @ ${cand.current_company ?? "-"}\nSkills: ${JSON.stringify(cand.skills ?? [])}\nCV parseado: ${JSON.stringify(cand.cv_parsed ?? {}).slice(0, 6000)}\nNotas: ${(cand.notes ?? "").slice(0, 2000)}`;

    const out = await callAi(sys, usr);
    const score = Math.max(0, Math.min(100, Number(out.score) || 0));

    const { data: row, error } = await supabase
      .from("ats_match_scores")
      .upsert(
        {
          owner_id: userId,
          job_id: data.job_id,
          candidate_id: data.candidate_id,
          score,
          summary: String(out.summary ?? "").slice(0, 2000),
          strengths: Array.isArray(out.strengths) ? out.strengths : [],
          gaps: Array.isArray(out.gaps) ? out.gaps : [],
          model: "google/gemini-2.5-flash",
        },
        { onConflict: "job_id,candidate_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMatchScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ job_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ats_match_scores")
      .select("*, ats_candidates(full_name, email), ats_jobs(title)")
      .order("score", { ascending: false });
    if (data.job_id) q = q.eq("job_id", data.job_id);
    const { data: rows, error } = await q.limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
