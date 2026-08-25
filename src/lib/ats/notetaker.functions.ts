import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAtsEvent } from "./audit.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

type AiNotes = {
  summary: string;
  strengths: string[];
  concerns: string[];
  followups: string[];
  recommendation: "strong_hire" | "hire" | "neutral" | "no_hire" | "strong_no_hire";
  score: number;
};

function buildPrompt(transcript: string, kit: unknown, jobTitle: string | null): string {
  return [
    `Você é um recrutador sênior. Analise a transcrição/anotações da entrevista abaixo e retorne JSON.`,
    jobTitle ? `Vaga: ${jobTitle}` : ``,
    kit ? `Roteiro/Perguntas previstas (JSON): ${JSON.stringify(kit).slice(0, 4000)}` : ``,
    ``,
    `Transcrição/Anotações:`,
    transcript.slice(0, 18000),
    ``,
    `Responda APENAS com JSON válido neste formato:`,
    `{`,
    `  "summary": "resumo executivo em pt-BR, 4-8 frases",`,
    `  "strengths": ["..."],`,
    `  "concerns": ["..."],`,
    `  "followups": ["perguntas/temas para próxima etapa"],`,
    `  "recommendation": "strong_hire|hire|neutral|no_hire|strong_no_hire",`,
    `  "score": 0-100`,
    `}`,
  ].join("\n");
}

async function callAi(prompt: string, model: string): Promise<AiNotes> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Responda apenas com JSON válido, sem markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (res.status === 429)
    throw new Error("Limite de uso da IA atingido. Tente novamente em alguns minutos.");
  if (res.status === 402)
    throw new Error("Créditos da IA esgotados. Adicione créditos em Workspace → Uso.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = j.choices?.[0]?.message?.content ?? "";
  const jsonStr = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .trim();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = { summary: raw.slice(0, 1000) };
  }
  const rec = String(parsed.recommendation ?? "neutral");
  const validRec = ["strong_hire", "hire", "neutral", "no_hire", "strong_no_hire"].includes(rec)
    ? (rec as AiNotes["recommendation"])
    : "neutral";
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.slice(0, 15).map((x) => String(x).slice(0, 400)) : [];
  return {
    summary: String(parsed.summary ?? "").slice(0, 6000),
    strengths: arr(parsed.strengths),
    concerns: arr(parsed.concerns),
    followups: arr(parsed.followups),
    recommendation: validRec,
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
  };
}

export const generateInterviewNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        interview_id: z.string().uuid(),
        transcript: z.string().min(40).max(60000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: itv, error: ie } = await supabase
      .from("ats_interviews")
      .select("id, interview_kit_id, job_id, candidate_id")
      .eq("id", data.interview_id)
      .maybeSingle();
    if (ie || !itv) throw new Error(ie?.message || "Entrevista não encontrada");

    let kit: unknown = null;
    if (itv.interview_kit_id) {
      const { data: k } = await supabase
        .from("ats_interview_kits")
        .select("questions")
        .eq("id", itv.interview_kit_id as string)
        .maybeSingle();
      kit = k?.questions ?? null;
    }
    let jobTitle: string | null = null;
    if (itv.job_id) {
      const { data: j } = await supabase
        .from("ats_jobs")
        .select("title")
        .eq("id", itv.job_id as string)
        .maybeSingle();
      jobTitle = (j?.title as string) ?? null;
    }

    const ai = await callAi(buildPrompt(data.transcript, kit, jobTitle), DEFAULT_MODEL);

    const { error: ue } = await supabase
      .from("ats_interviews")
      .update({
        transcript: data.transcript,
        ai_summary: ai.summary,
        ai_strengths: ai.strengths,
        ai_concerns: ai.concerns,
        ai_followups: ai.followups,
        ai_recommendation: ai.recommendation,
        ai_score: ai.score,
        ai_model: DEFAULT_MODEL,
        ai_generated_at: new Date().toISOString(),
      })
      .eq("id", data.interview_id);
    if (ue) throw new Error(ue.message);

    await recordAtsEvent(supabase, {
      ownerId: userId,
      name: "ats.interview.completed",
      entityType: "interview",
      entityId: data.interview_id,
      dedupeKey: `ats.interview.completed:${data.interview_id}`,
      payload: {
        interviewId: data.interview_id,
        jobId: itv.job_id,
        candidateId: itv.candidate_id,
        recommendation: ai.recommendation,
        score: ai.score,
      },
    }).catch(() => undefined);

    return { ok: true as const, ...ai };
  });

export const getInterviewWithNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interview_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("ats_interviews")
      .select(
        "id, scheduled_at, kind, status, candidate_id, job_id, transcript, ai_summary, ai_strengths, ai_concerns, ai_followups, ai_recommendation, ai_score, ai_generated_at, ai_model",
      )
      .eq("id", data.interview_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listRecentInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ats_interviews")
      .select(
        "id, scheduled_at, kind, status, candidate_id, job_id, ai_generated_at, ai_recommendation, ai_score",
      )
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
