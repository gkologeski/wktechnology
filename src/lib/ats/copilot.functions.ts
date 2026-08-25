// Wave 8 — AI Recruiter Copilot
// Pergunta-resposta grounded no candidato (CV, aplicações, scorecards, notas).
// Usa Lovable AI Gateway (Gemini 2.5 Flash). Sem efeitos colaterais.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callAi(messages: Array<{ role: string; content: string }>, json = false) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`AI Gateway ${r.status}: ${await r.text().catch(() => "")}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function buildCandidateContext(supabase: any, candidateId: string) {
  const { data: cand } = await supabase
    .from("ats_candidates")
    .select(
      "full_name, email, phone, location, current_position, current_company, skills, tags, notes, cv_parsed, linkedin_url, source",
    )
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) throw new Error("Candidato não encontrado");

  const { data: apps } = await supabase
    .from("ats_applications")
    .select("id, status, stage_value, created_at, ats_jobs(title, seniority, location)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(20);

  const appIds = (apps ?? []).map((a: any) => a.id);
  const { data: scorecards } = appIds.length
    ? await supabase
        .from("ats_scorecard_responses")
        .select("rating, summary, created_at, application_id")
        .in("application_id", appIds)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as any[] };

  const lines: string[] = [];
  lines.push(`Nome: ${cand.full_name}`);
  if (cand.current_position || cand.current_company)
    lines.push(`Atual: ${cand.current_position ?? "-"} @ ${cand.current_company ?? "-"}`);
  if (cand.location) lines.push(`Local: ${cand.location}`);
  if (cand.email) lines.push(`Email: ${cand.email}`);
  if (cand.skills?.length) lines.push(`Skills: ${(cand.skills as string[]).join(", ")}`);
  if (cand.tags?.length) lines.push(`Tags: ${(cand.tags as string[]).join(", ")}`);
  if (cand.notes) lines.push(`Notas: ${String(cand.notes).slice(0, 1500)}`);
  if (cand.cv_parsed) lines.push(`CV (parseado): ${JSON.stringify(cand.cv_parsed).slice(0, 5000)}`);

  if (apps?.length) {
    lines.push("\nAplicações:");
    for (const a of apps) {
      lines.push(
        `- ${a.ats_jobs?.title ?? "?"} (${a.ats_jobs?.seniority ?? "-"}) — ${a.status}/${a.stage_value ?? "-"}`,
      );
    }
  }
  if (scorecards?.length) {
    lines.push("\nScorecards:");
    for (const s of scorecards) {
      lines.push(`- Rating ${s.rating ?? "-"}: ${(s.summary ?? "").slice(0, 300)}`);
    }
  }
  return { context: lines.join("\n"), candidateName: cand.full_name };
}

export const askCandidateCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        question: z.string().min(2).max(2000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .max(20)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { context: ctx } = await buildCandidateContext(context.supabase, data.candidate_id);
    const sys =
      "Você é um copiloto de recrutamento. Responda em PT-BR, conciso, baseado APENAS no contexto fornecido sobre o candidato. Se não houver evidência, diga claramente. Nunca invente experiências, datas ou empregadores.";
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: sys },
      { role: "user", content: `CONTEXTO DO CANDIDATO:\n${ctx}` },
      ...(data.history ?? []).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: data.question },
    ];
    const answer = await callAi(messages);
    return { answer: String(answer).trim() };
  });

export const summarizeCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ candidate_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { context: ctx } = await buildCandidateContext(context.supabase, data.candidate_id);
    const sys =
      'Você é um recrutador sênior. Resuma o candidato em JSON: {"headline":"...","strengths":["..."],"risks":["..."],"next_step":"..."}. PT-BR. Sem inventar.';
    const out = await callAi(
      [
        { role: "system", content: sys },
        { role: "user", content: ctx },
      ],
      true,
    );
    try {
      return JSON.parse(out);
    } catch {
      return { headline: String(out).slice(0, 300), strengths: [], risks: [], next_step: "" };
    }
  });
