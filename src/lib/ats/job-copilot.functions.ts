// Wave 8 — Slice 2: Job Copilot
// IA grounded em uma vaga: rankeia candidatos da pipeline, sugere perguntas
// para entrevista e drafta outreach personalizado. Sem efeitos colaterais.
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
  if (r.status === 429)
    throw new Error("Limite de uso da IA atingido. Tente novamente em alguns instantes.");
  if (r.status === 402)
    throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
  if (!r.ok) throw new Error(`AI Gateway ${r.status}: ${await r.text().catch(() => "")}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function buildJobContext(supabase: any, jobId: string, userId?: string) {
  const cols =
    "title, seniority, remote_mode, employment_type, location, description, requirements, metadata, owner_id, hiring_manager_id, recruiter_id";
  // eslint-disable-next-line prefer-const -- `job` é reatribuído abaixo
  let { data: job, error } = await supabase
    .from("ats_jobs")
    .select(cols)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) {
    // Fallback: usuário pode ter acesso via role admin ou membership futura.
    // Lê via admin e valida que o caller é owner/HM/recruiter ou admin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: full } = await supabaseAdmin
      .from("ats_jobs")
      .select(cols)
      .eq("id", jobId)
      .maybeSingle();
    if (!full) throw new Error("Vaga não encontrada");
    let allowed =
      userId != null &&
      (full.owner_id === userId ||
        full.hiring_manager_id === userId ||
        full.recruiter_id === userId);
    if (!allowed && userId) {
      const { data: isAdmin } = await supabaseAdmin.rpc("is_platform_admin", { _user: userId });
      allowed = Boolean(isAdmin);
    }
    if (!allowed) throw new Error("Sem permissão para acessar esta vaga");
    job = full;
  }
  const department = (job.metadata as { department?: string } | null)?.department ?? null;
  const lines: string[] = [];
  lines.push(`Vaga: ${job.title}`);
  if (job.seniority) lines.push(`Senioridade: ${job.seniority}`);
  if (job.remote_mode) lines.push(`Modo: ${job.remote_mode}`);
  if (job.employment_type) lines.push(`Contrato: ${job.employment_type}`);
  if (job.location) lines.push(`Local: ${job.location}`);
  if (department) lines.push(`Departamento: ${department}`);
  if (job.description) lines.push(`Descrição:\n${String(job.description).slice(0, 2500)}`);
  if (job.requirements) lines.push(`Requisitos:\n${String(job.requirements).slice(0, 2500)}`);
  return { context: lines.join("\n"), job };
}

export const rankPipelineCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ job_id: z.string().uuid(), limit: z.number().int().min(1).max(50).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { context: jobCtx } = await buildJobContext(supabase, data.job_id, context.userId);

    const { data: apps } = await supabase
      .from("ats_applications")
      .select(
        "id, status, stage_value, ats_candidates(id, full_name, current_position, current_company, skills, location)",
      )
      .eq("job_id", data.job_id)
      .neq("status", "rejected")
      .limit(data.limit ?? 25);

    const items = (apps ?? []).filter((a: any) => a.ats_candidates);
    if (items.length === 0)
      return { ranking: [] as Array<{ candidate_id: string; score: number; reason: string }> };

    const candidatesBlock = items
      .map((a: any, i: number) => {
        const c = a.ats_candidates;
        const skills = Array.isArray(c.skills) ? c.skills.join(", ") : "";
        return `#${i + 1} [${c.id}] ${c.full_name} — ${c.current_position ?? "-"} @ ${c.current_company ?? "-"} — Stage:${a.stage_value ?? "-"} — Skills:${skills} — Local:${c.location ?? "-"}`;
      })
      .join("\n");

    const sys =
      'Você é um recrutador sênior. Avalie cada candidato em relação à vaga e devolva JSON: {"ranking":[{"candidate_id":"<uuid>","score":0-100,"reason":"<1 frase em PT-BR>"}]}. Score reflete fit técnico+contexto. Use APENAS as evidências fornecidas. Nunca invente.';
    const out = await callAi(
      [
        { role: "system", content: sys },
        { role: "user", content: `VAGA:\n${jobCtx}\n\nCANDIDATOS:\n${candidatesBlock}` },
      ],
      true,
    );
    try {
      const parsed = JSON.parse(out);
      const valid = new Set(items.map((a: any) => a.ats_candidates.id));
      const ranking = Array.isArray(parsed?.ranking)
        ? parsed.ranking
            .filter((r: any) => valid.has(r.candidate_id))
            .map((r: any) => ({
              candidate_id: String(r.candidate_id),
              score: Math.max(0, Math.min(100, Number(r.score) || 0)),
              reason: String(r.reason ?? "").slice(0, 400),
            }))
            .sort((a: any, b: any) => b.score - a.score)
        : [];
      return { ranking };
    } catch {
      return { ranking: [] };
    }
  });

export const suggestInterviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        job_id: z.string().uuid(),
        candidate_id: z.string().uuid().optional(),
        focus: z.enum(["technical", "behavioral", "culture", "mixed"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { context: jobCtx } = await buildJobContext(supabase, data.job_id, context.userId);

    let candBlock = "";
    if (data.candidate_id) {
      const { data: c } = await supabase
        .from("ats_candidates")
        .select("full_name, current_position, current_company, skills, cv_parsed")
        .eq("id", data.candidate_id)
        .maybeSingle();
      if (c) {
        candBlock = `\n\nCANDIDATO:\n${c.full_name} — ${c.current_position ?? "-"} @ ${c.current_company ?? "-"}\nSkills:${Array.isArray(c.skills) ? c.skills.join(", ") : "-"}\nCV:${c.cv_parsed ? JSON.stringify(c.cv_parsed).slice(0, 2500) : "-"}`;
      }
    }

    const focus = data.focus ?? "mixed";
    const sys = `Você é um recrutador sênior. Gere 8 perguntas para entrevista (foco: ${focus}) em PT-BR. Devolva JSON: {"questions":[{"category":"...","question":"...","what_to_look_for":"..."}]}. Use APENAS o contexto fornecido. Nunca invente fatos do candidato.`;
    const out = await callAi(
      [
        { role: "system", content: sys },
        { role: "user", content: `VAGA:\n${jobCtx}${candBlock}` },
      ],
      true,
    );
    try {
      const parsed = JSON.parse(out);
      const questions = Array.isArray(parsed?.questions)
        ? parsed.questions.slice(0, 12).map((q: any) => ({
            category: String(q.category ?? "").slice(0, 60),
            question: String(q.question ?? "").slice(0, 600),
            what_to_look_for: String(q.what_to_look_for ?? "").slice(0, 400),
          }))
        : [];
      return { questions };
    } catch {
      return { questions: [] };
    }
  });

export const draftOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        job_id: z.string().uuid(),
        candidate_id: z.string().uuid(),
        channel: z.enum(["email", "linkedin", "whatsapp"]).default("email"),
        tone: z.enum(["formal", "casual", "warm"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { context: jobCtx } = await buildJobContext(supabase, data.job_id, context.userId);
    const { data: c } = await supabase
      .from("ats_candidates")
      .select("full_name, current_position, current_company, skills, location")
      .eq("id", data.candidate_id)
      .maybeSingle();
    if (!c) throw new Error("Candidato não encontrado");

    const tone = data.tone ?? "warm";
    const limits =
      data.channel === "linkedin"
        ? "máx 300 caracteres (limite InMail), sem assunto."
        : data.channel === "whatsapp"
          ? "máx 600 caracteres, sem assunto, tom direto."
          : "assunto curto + corpo em até 150 palavras.";
    const sys = `Você é um recrutador sênior. Escreva um outreach em PT-BR para o canal ${data.channel} (tom ${tone}). Personalize com base nas evidências do candidato e na vaga. ${limits} Devolva JSON: {"subject":"...","body":"..."}. Sem inventar fatos. Termine convidando para conversa.`;
    const userMsg = `VAGA:\n${jobCtx}\n\nCANDIDATO:\n${c.full_name} — ${c.current_position ?? "-"} @ ${c.current_company ?? "-"}\nSkills:${Array.isArray(c.skills) ? c.skills.join(", ") : "-"}\nLocal:${c.location ?? "-"}`;
    const out = await callAi(
      [
        { role: "system", content: sys },
        { role: "user", content: userMsg },
      ],
      true,
    );
    try {
      const parsed = JSON.parse(out);
      return {
        subject: String(parsed?.subject ?? "").slice(0, 200),
        body: String(parsed?.body ?? "").slice(0, 4000),
      };
    } catch {
      return { subject: "", body: String(out).slice(0, 4000) };
    }
  });
