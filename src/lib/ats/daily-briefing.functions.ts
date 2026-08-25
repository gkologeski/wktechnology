// Wave 8 — Slice 5: Daily Briefing IA
// Briefing diário gerado por IA com prioridades, riscos e recomendações,
// usando métricas agregadas das últimas 24h/7d. Persistido em
// `ats_daily_briefings` (RLS por owner_id).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callAiJson(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (r.status === 429)
    throw new Error("AI Gateway: limite de requisições. Tente novamente em instantes.");
  if (r.status === 402)
    throw new Error("AI Gateway: créditos esgotados. Adicione créditos no Workspace.");
  if (!r.ok) throw new Error(`AI Gateway ${r.status}: ${await r.text().catch(() => "")}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "{}";
}

async function buildBriefingMetrics(supabase: any) {
  const now = new Date();
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stale = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [jobsRes, apps24, apps7, staleRes, interviewsNext, offersOpen] = await Promise.all([
    supabase
      .from("ats_jobs")
      .select("id, title, status, seniority, created_at")
      .in("status", ["open", "active"])
      .limit(100),
    supabase
      .from("ats_applications")
      .select("id, status, stage_value")
      .gte("created_at", day)
      .limit(1000),
    supabase
      .from("ats_applications")
      .select("id, status, stage_value, job_id")
      .gte("created_at", week)
      .limit(2000),
    supabase
      .from("ats_applications")
      .select("id, stage_value, updated_at, ats_jobs(title)")
      .lt("updated_at", stale)
      .not("status", "in", "(rejected,hired,withdrawn)")
      .limit(50),
    supabase
      .from("ats_interviews")
      .select("id, status, scheduled_at")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(200),
    supabase
      .from("ats_offers")
      .select("id, status, created_at")
      .in("status", ["draft", "sent", "viewed", "negotiating"])
      .limit(100),
  ]);

  const stageCount: Record<string, number> = {};
  for (const a of apps7.data ?? []) {
    const k = a.stage_value ?? a.status ?? "unknown";
    stageCount[k] = (stageCount[k] ?? 0) + 1;
  }

  const stalePerStage: Record<string, number> = {};
  for (const a of staleRes.data ?? []) {
    const k = a.stage_value ?? "unknown";
    stalePerStage[k] = (stalePerStage[k] ?? 0) + 1;
  }

  return {
    period_start: week,
    period_end: now.toISOString(),
    open_jobs: (jobsRes.data ?? []).length,
    top_open_jobs: (jobsRes.data ?? []).slice(0, 10).map((j: any) => ({
      title: j.title,
      seniority: j.seniority,
    })),
    apps_last_24h: (apps24.data ?? []).length,
    apps_last_7d: (apps7.data ?? []).length,
    stage_count_7d: stageCount,
    stale_applications: (staleRes.data ?? []).length,
    stale_per_stage: stalePerStage,
    upcoming_interviews_7d: (interviewsNext.data ?? []).length,
    open_offers: (offersOpen.data ?? []).length,
  };
}

export const generateDailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const metrics = await buildBriefingMetrics(context.supabase);
    const sys =
      'Você é o copiloto de recrutamento. Gere um briefing diário em PT-BR baseado APENAS nas métricas fornecidas. Responda em JSON estrito: {"headline":"...","summary":"...","priorities":[{"title":"","why":""}],"risks":[{"title":"","why":""}],"recommendations":[{"title":"","action":""}]}. Máximo 4 itens em cada lista. Nunca invente números, vagas ou candidatos — use apenas os dados.';
    const content = await callAiJson([
      { role: "system", content: sys },
      { role: "user", content: `MÉTRICAS:\n${JSON.stringify(metrics)}` },
    ]);
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        headline: "Briefing",
        summary: String(content).slice(0, 1000),
        priorities: [],
        risks: [],
        recommendations: [],
      };
    }

    const { data, error } = await context.supabase
      .from("ats_daily_briefings")
      .insert({
        owner_id: context.userId,
        period_start: metrics.period_start,
        period_end: metrics.period_end,
        headline: parsed.headline ?? null,
        summary: parsed.summary ?? null,
        priorities: parsed.priorities ?? [],
        risks: parsed.risks ?? [],
        recommendations: parsed.recommendations ?? [],
        metrics,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const getLatestBriefing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ats_daily_briefings")
      .select("*")
      .eq("owner_id", context.userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const listBriefings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().min(1).max(50).default(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ats_daily_briefings")
      .select("id, generated_at, headline, summary")
      .eq("owner_id", context.userId)
      .order("generated_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
