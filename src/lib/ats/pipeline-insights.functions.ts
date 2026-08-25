// Wave 8 — Slice 3: Pipeline Insights (IA)
// Deriva métricas determinísticas do funil (conversão stage→stage, dwell time,
// dropoff) a partir de ats_applications + ats_application_events e usa Lovable AI
// para sintetizar gargalos e recomendações em PT-BR.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_ATS_STAGES } from "@/lib/ats/stages";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type StageMetric = {
  stage: string;
  label: string;
  active: number; // candidatos atualmente na etapa
  entered: number; // total que passaram por esta etapa (em todo o período)
  advanced: number; // que avançaram para etapa seguinte ou foram contratados
  rejectedHere: number; // rejeitados estando nesta etapa
  conversionToNext: number; // % advanced / entered
  avgDwellDays: number; // tempo médio em dias
};

async function callAi(messages: Array<{ role: string; content: string }>) {
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
    throw new Error("Limite de uso da IA atingido. Tente novamente em alguns instantes.");
  if (r.status === 402)
    throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
  if (!r.ok) throw new Error(`AI Gateway ${r.status}: ${await r.text().catch(() => "")}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

export const analyzePipelineHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        job_id: z.string().uuid().optional(),
        window_days: z.number().int().min(7).max(365).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const windowDays = data.window_days ?? 90;
    const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000).toISOString();

    // 1) Aplicações no período (ou da vaga)
    let appsQ = supabase
      .from("ats_applications")
      .select("id, stage_value, status, applied_at, moved_at, job_id, ats_jobs(title)")
      .gte("applied_at", since);
    if (data.job_id) appsQ = appsQ.eq("job_id", data.job_id);
    const { data: apps, error: appsErr } = await appsQ;
    if (appsErr) throw appsErr;
    const appsArr = (apps ?? []) as Array<{
      id: string;
      stage_value: string;
      status: string;
      applied_at: string;
      moved_at: string | null;
      job_id: string;
      ats_jobs: { title: string } | null;
    }>;

    // 2) Eventos de movimentação de stage para essas aplicações
    const ids = appsArr.map((a) => a.id);
    let events: Array<{
      application_id: string;
      from_stage: string | null;
      to_stage: string | null;
      created_at: string;
      event_type: string;
    }> = [];
    if (ids.length) {
      const { data: evs } = await supabase
        .from("ats_application_events")
        .select("application_id, from_stage, to_stage, created_at, event_type")
        .in("application_id", ids)
        .order("created_at", { ascending: true });
      events = (evs ?? []) as typeof events;
    }

    // 3) Construir transições por aplicação (lista ordenada de stages com entry time)
    const stageOrder = DEFAULT_ATS_STAGES.map((s) => s.value);
    const stageLabel = Object.fromEntries(DEFAULT_ATS_STAGES.map((s) => [s.value, s.label]));
    const orderIdx = (v: string) => stageOrder.indexOf(v);

    type Visit = {
      stage: string;
      enteredAt: number;
      exitedAt: number | null;
      exitedTo: string | null;
    };
    const visitsByStage: Record<string, Visit[]> = Object.fromEntries(
      stageOrder.map((s) => [s, [] as Visit[]]),
    );
    let avgTotalCloseDays = 0;
    let closedCount = 0;

    for (const a of appsArr) {
      const startMs = new Date(a.applied_at).getTime();
      const evs = events.filter((e) => e.application_id === a.id && e.event_type === "stage_moved");
      // Sequência de entradas em stage
      const seq: Array<{ stage: string; ts: number }> = [{ stage: "applied", ts: startMs }];
      for (const e of evs) {
        if (e.to_stage) seq.push({ stage: e.to_stage, ts: new Date(e.created_at).getTime() });
      }
      // Final
      const finalTs = a.moved_at ? new Date(a.moved_at).getTime() : Date.now();
      const isClosed = a.status === "hired" || a.status === "rejected";
      if (isClosed) {
        closedCount++;
        avgTotalCloseDays += (finalTs - startMs) / 86_400_000;
      }
      for (let i = 0; i < seq.length; i++) {
        const cur = seq[i];
        const next = seq[i + 1];
        const exitedAt = next ? next.ts : isClosed ? finalTs : null;
        const exitedTo = next
          ? next.stage
          : a.status === "hired"
            ? "hired"
            : a.status === "rejected"
              ? "rejected"
              : null;
        if (visitsByStage[cur.stage]) {
          visitsByStage[cur.stage].push({
            stage: cur.stage,
            enteredAt: cur.ts,
            exitedAt,
            exitedTo,
          });
        }
      }
    }

    // 4) Métricas por stage
    const metrics: StageMetric[] = stageOrder.map((s) => {
      const visits = visitsByStage[s];
      const entered = visits.length;
      const advanced = visits.filter(
        (v) => v.exitedTo === "hired" || (v.exitedTo && orderIdx(v.exitedTo) > orderIdx(s)),
      ).length;
      const rejectedHere = visits.filter((v) => v.exitedTo === "rejected").length;
      const active = visits.filter((v) => v.exitedAt === null).length;
      const dwellMs = visits
        .filter((v) => v.exitedAt !== null)
        .map((v) => (v.exitedAt as number) - v.enteredAt);
      const avgDwellDays = dwellMs.length
        ? Math.round((dwellMs.reduce((a, b) => a + b, 0) / dwellMs.length / 86_400_000) * 10) / 10
        : 0;
      const conversionToNext = entered > 0 ? Math.round((advanced / entered) * 100) : 0;
      return {
        stage: s,
        label: stageLabel[s] ?? s,
        active,
        entered,
        advanced,
        rejectedHere,
        conversionToNext,
        avgDwellDays,
      };
    });

    const avgCloseDays = closedCount ? Math.round((avgTotalCloseDays / closedCount) * 10) / 10 : 0;

    // 5) Detectar gargalo determinístico: stage com maior número ativo + maior dwell
    const candidates = metrics.filter((m) => m.entered >= 3);
    const bottleneck = candidates.length
      ? [...candidates].sort(
          (a, b) => b.avgDwellDays * (b.active + 1) - a.avgDwellDays * (a.active + 1),
        )[0]
      : null;

    // 6) Sintetizar com IA (curto, JSON estrito)
    const summaryInput = {
      window_days: windowDays,
      job_id: data.job_id ?? null,
      total_applications: appsArr.length,
      hired: appsArr.filter((a) => a.status === "hired").length,
      rejected: appsArr.filter((a) => a.status === "rejected").length,
      avg_days_to_close: avgCloseDays,
      stages: metrics,
      bottleneck_stage: bottleneck?.stage ?? null,
    };

    let aiInsights = {
      headline: "",
      bottlenecks: [] as Array<{ stage: string; reason: string }>,
      recommendations: [] as string[],
    };
    if (appsArr.length > 0) {
      try {
        const sys =
          'Você é analista de recrutamento. Com base nas métricas do funil, devolva JSON: {"headline":"...","bottlenecks":[{"stage":"<value>","reason":"..."}],"recommendations":["..."]}. PT-BR. Máx 3 bottlenecks e 5 recomendações. Use APENAS números fornecidos. Não invente.';
        const out = await callAi([
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify(summaryInput) },
        ]);
        const parsed = JSON.parse(out);
        aiInsights = {
          headline: String(parsed?.headline ?? "").slice(0, 400),
          bottlenecks: Array.isArray(parsed?.bottlenecks)
            ? parsed.bottlenecks.slice(0, 3).map((b: any) => ({
                stage: String(b.stage ?? ""),
                reason: String(b.reason ?? "").slice(0, 300),
              }))
            : [],
          recommendations: Array.isArray(parsed?.recommendations)
            ? parsed.recommendations.slice(0, 5).map((r: any) => String(r).slice(0, 280))
            : [],
        };
      } catch {
        // mantém defaults se IA falhar
      }
    }

    return {
      window_days: windowDays,
      job_id: data.job_id ?? null,
      totals: {
        applications: appsArr.length,
        hired: summaryInput.hired,
        rejected: summaryInput.rejected,
        avg_days_to_close: avgCloseDays,
      },
      stages: metrics,
      bottleneck_stage: bottleneck?.stage ?? null,
      ai: aiInsights,
    };
  });
