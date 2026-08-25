// Wave 8 — Slice 4: Global Recruiter Copilot
// Q&A grounded em métricas agregadas do workspace ATS (vagas, candidatos,
// pipeline, ofertas). Apenas leitura, sem efeitos colaterais.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callAi(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (r.status === 429)
    throw new Error("AI Gateway: limite de requisições. Tente novamente em instantes.");
  if (r.status === 402)
    throw new Error("AI Gateway: créditos esgotados. Adicione créditos no Workspace.");
  if (!r.ok) throw new Error(`AI Gateway ${r.status}: ${await r.text().catch(() => "")}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function buildWorkspaceContext(supabase: any) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [jobsRes, appsRes, candRes, offersRes, interviewsRes] = await Promise.all([
    supabase
      .from("ats_jobs")
      .select("id, title, status, seniority, location, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ats_applications")
      .select("status, stage_value, created_at, job_id")
      .gte("created_at", since)
      .limit(2000),
    supabase
      .from("ats_candidates")
      .select("id, source, created_at")
      .gte("created_at", since)
      .limit(2000),
    supabase.from("ats_offers").select("status, created_at").gte("created_at", since).limit(500),
    supabase
      .from("ats_interviews")
      .select("status, scheduled_at")
      .gte("scheduled_at", since)
      .limit(500),
  ]);

  const jobs = jobsRes.data ?? [];
  const apps = appsRes.data ?? [];
  const cands = candRes.data ?? [];
  const offers = offersRes.data ?? [];
  const interviews = interviewsRes.data ?? [];

  const openJobs = jobs.filter((j: any) => j.status === "open" || j.status === "active");
  const stageCount: Record<string, number> = {};
  for (const a of apps) {
    const k = a.stage_value ?? a.status ?? "unknown";
    stageCount[k] = (stageCount[k] ?? 0) + 1;
  }
  const sourceCount: Record<string, number> = {};
  for (const c of cands) {
    const k = c.source ?? "unknown";
    sourceCount[k] = (sourceCount[k] ?? 0) + 1;
  }
  const offerCount: Record<string, number> = {};
  for (const o of offers) {
    const k = o.status ?? "unknown";
    offerCount[k] = (offerCount[k] ?? 0) + 1;
  }
  const interviewCount: Record<string, number> = {};
  for (const i of interviews) {
    const k = i.status ?? "unknown";
    interviewCount[k] = (interviewCount[k] ?? 0) + 1;
  }

  const lines: string[] = [];
  lines.push(`Janela analisada: últimos 90 dias.`);
  lines.push(`Vagas (total recentes): ${jobs.length} | Abertas/ativas: ${openJobs.length}`);
  if (openJobs.length) {
    lines.push("Top vagas abertas:");
    for (const j of openJobs.slice(0, 15)) {
      lines.push(`- ${j.title} (${j.seniority ?? "-"}) — ${j.location ?? "remoto/–"}`);
    }
  }
  lines.push(`\nAplicações nos últimos 90d: ${apps.length}`);
  lines.push(`Por etapa: ${JSON.stringify(stageCount)}`);
  lines.push(`\nCandidatos novos: ${cands.length}`);
  lines.push(`Por origem: ${JSON.stringify(sourceCount)}`);
  lines.push(`\nOfertas: ${offers.length} (${JSON.stringify(offerCount)})`);
  lines.push(`Entrevistas: ${interviews.length} (${JSON.stringify(interviewCount)})`);

  return lines.join("\n");
}

export const askGlobalCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        question: z.string().min(2).max(2000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .max(20)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = await buildWorkspaceContext(context.supabase);
    const sys =
      "Você é o copiloto de recrutamento do TechHire. Responda em PT-BR, de forma concisa, direta e acionável, baseando-se APENAS no contexto agregado do workspace fornecido. Cite números quando relevante. Se não houver evidência suficiente, diga claramente o que falta. Nunca invente vagas, candidatos, métricas ou datas.";
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: sys },
      { role: "user", content: `CONTEXTO DO WORKSPACE (ATS):\n${ctx}` },
      ...(data.history ?? []).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: data.question },
    ];
    const answer = await callAi(messages);
    return { answer: String(answer).trim() };
  });
