// Server-only helpers for AI analysis of user-submitted bug reports.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUG_CATEGORIES, BUG_KINDS } from "@/lib/bug-report-taxonomy";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

function catLabel(value: string) {
  return BUG_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
function subLabel(cat: string, value: string) {
  return (
    BUG_CATEGORIES.find((c) => c.value === cat)?.subtypes.find((s) => s.value === value)?.label ??
    value
  );
}
function kindLabel(value: string) {
  return BUG_KINDS.find((k) => k.value === value)?.label ?? value;
}

// Compact map of high-level areas → likely files. Helps the model ground
// `suspected_files` instead of inventing paths.
const PROJECT_AREAS: { area: string; hints: string[] }[] = [
  {
    area: "Autenticação / convites",
    hints: [
      "src/routes/login.tsx",
      "src/routes/signup.tsx",
      "src/routes/accept-invite.$token.tsx",
      "src/lib/auth.ts",
      "src/lib/teams.functions.ts",
    ],
  },
  {
    area: "Leads",
    hints: [
      "src/routes/_authenticated/leads.tsx",
      "src/routes/_authenticated/leads.$id.tsx",
      "src/components/leads/*",
    ],
  },
  {
    area: "Negócios / pipeline",
    hints: [
      "src/routes/_authenticated/deals.tsx",
      "src/routes/_authenticated/deals.$id.tsx",
      "src/components/deals/*",
    ],
  },
  {
    area: "Contatos / empresas",
    hints: ["src/routes/_authenticated/contacts.tsx", "src/routes/_authenticated/companies.tsx"],
  },
  {
    area: "Tarefas / filas",
    hints: [
      "src/routes/_authenticated/tasks.tsx",
      "src/routes/_authenticated/tasks.queues.$queueId.play.tsx",
    ],
  },
  {
    area: "Inbox e-mail",
    hints: ["src/routes/_authenticated/inbox.email.tsx", "src/components/email/*"],
  },
  {
    area: "Inbox / campanhas WhatsApp",
    hints: [
      "src/routes/_authenticated/inbox.whatsapp.tsx",
      "src/routes/_authenticated/campaigns.whatsapp.tsx",
      "src/components/whatsapp/*",
      "src/routes/api/public/hooks/twilio-whatsapp.ts",
    ],
  },
  {
    area: "Voz / discador",
    hints: ["src/components/voice/call-dialer.tsx", "src/routes/api/public/twilio/voice.ts"],
  },
  {
    area: "Workflows / automações",
    hints: [
      "src/components/workflows/*",
      "src/routes/_authenticated/settings.workflows.tsx",
      "src/routes/api/public/hooks/workflows-tick.ts",
    ],
  },
  {
    area: "Sequências de prospecção",
    hints: ["src/components/sequences/*", "src/routes/api/public/hooks/sequences-tick.ts"],
  },
  {
    area: "Reuniões / agendamento público",
    hints: ["src/routes/book.$slug.tsx", "src/routes/api/public/booking/*"],
  },
  {
    area: "Configurações / branding",
    hints: ["src/routes/_authenticated/settings.*", "src/components/branding/*"],
  },
  {
    area: "Integrações (HubSpot, Google, etc.)",
    hints: ["src/routes/_authenticated/integrations.*", "src/lib/integrations/*"],
  },
  {
    area: "Cobrança / planos",
    hints: [
      "src/routes/_authenticated/settings.billing.tsx",
      "src/components/billing/feature-gate.tsx",
    ],
  },
  { area: "Admin da plataforma", hints: ["src/routes/_authenticated/admin.*"] },
];

type BugReport = {
  id: string;
  kind: string;
  category: string;
  subtype: string;
  description: string;
  page_url: string | null;
  user_agent: string | null;
  recording_path: string | null;
  recording_has_audio: boolean | null;
  owner_id: string;
  created_at: string;
};

type Reporter = {
  email: string | null;
  name: string | null;
};

function buildPrompt(r: BugReport, reporter: Reporter): string {
  const areasBlock = PROJECT_AREAS.map((a) => `- ${a.area}: ${a.hints.join(", ")}`).join("\n");
  const reporterLine =
    reporter.email || reporter.name ? `${reporter.name ?? "—"} <${reporter.email ?? "—"}>` : "—";
  return `Você é um engenheiro sênior de software analisando um chamado interno
de um CRM construído em TanStack Start + Supabase (Lovable Cloud).

Sua tarefa: ler o chamado abaixo e produzir uma análise estruturada com a
provável causa, área do código suspeita e uma PROPOSTA DE CORREÇÃO clara o
suficiente para um agente de IA (o Lovable) implementar diretamente.

# Chamado
- Reportado por: ${reporterLine}
- Quando: ${r.created_at}
- Tipo: ${kindLabel(r.kind)}
- Categoria: ${catLabel(r.category)} / ${subLabel(r.category, r.subtype)}
- URL da página: ${r.page_url ?? "—"}
- User-agent: ${r.user_agent ?? "—"}
- Gravação anexada: ${r.recording_path ? `sim${r.recording_has_audio ? " (com áudio)" : ""}` : "não"}

# Descrição do usuário
"""
${r.description}
"""

# Mapa de áreas do projeto (use para grounding de "suspected_files")
${areasBlock}

# Saída
Responda APENAS com JSON válido, sem markdown, exatamente neste schema:
{
  "summary": "1-2 frases em português resumindo o problema do ponto de vista de engenharia",
  "severity": "low|medium|high|critical",
  "suspected_area": "uma das áreas acima ou outra curta em português",
  "suspected_files": ["caminhos relativos prováveis (até 6)"],
  "root_cause": "hipótese da causa raiz em português",
  "proposed_fix": "passos concretos de implementação em português, mencionando arquivos e funções específicas quando possível",
  "reproduction_steps": ["passo 1", "passo 2", "..."],
  "confidence": 0.0,
  "lovable_prompt": "prompt pronto para colar no chat do Lovable que peça a correção, em português, em uma única mensagem. DEVE incluir explicitamente: (1) quem reportou (nome/email), (2) navegador/user-agent resumido (ex.: 'Chrome no macOS'), (3) a URL onde ocorreu, (4) o problema relatado e (5) os arquivos/áreas suspeitos a investigar. Formato sugerido: 'Chamado reportado por <nome> (<email>) em <url> usando <navegador>. Problema: <descrição curta>. Por favor, corrija ... Verifique <arquivos>.'"
}

Regras:
- Se a descrição for vaga, marque confidence baixo e diga no summary o que falta.
- Não invente arquivos: use os do mapa de áreas ou padrões já visíveis nele.
- "severity": "critical" só para perda de dados, falha de auth/billing ou app inacessível.`;
}

type AiResult = {
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  suspected_area: string;
  suspected_files: string[];
  root_cause: string;
  proposed_fix: string;
  reproduction_steps: string[];
  confidence: number;
  lovable_prompt: string;
};

async function callAi(prompt: string, model: string): Promise<AiResult> {
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = j.choices?.[0]?.message?.content ?? "";
  const jsonStr = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .trim();
  const parsed = JSON.parse(jsonStr) as Partial<AiResult>;
  const sev = (parsed.severity ?? "medium") as AiResult["severity"];
  return {
    summary: String(parsed.summary ?? "").slice(0, 2000),
    severity: (["low", "medium", "high", "critical"] as const).includes(sev) ? sev : "medium",
    suspected_area: String(parsed.suspected_area ?? "").slice(0, 200),
    suspected_files: Array.isArray(parsed.suspected_files)
      ? parsed.suspected_files.slice(0, 10).map((s) => String(s).slice(0, 300))
      : [],
    root_cause: String(parsed.root_cause ?? "").slice(0, 2000),
    proposed_fix: String(parsed.proposed_fix ?? "").slice(0, 4000),
    reproduction_steps: Array.isArray(parsed.reproduction_steps)
      ? parsed.reproduction_steps.slice(0, 20).map((s) => String(s).slice(0, 400))
      : [],
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
    lovable_prompt: String(parsed.lovable_prompt ?? "").slice(0, 4000),
  };
}

export async function analyzeBugReportById(bugReportId: string) {
  const { data: r, error } = await supabaseAdmin
    .from("bug_reports")
    .select(
      "id, kind, category, subtype, description, page_url, user_agent, recording_path, recording_has_audio, owner_id, created_at",
    )
    .eq("id", bugReportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!r) throw new Error("Bug report não encontrado");

  const report = r as BugReport;

  // Lookup do usuário que reportou (auth.users via admin API).
  let reporter: Reporter = { email: null, name: null };
  try {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(report.owner_id);
    if (u?.user) {
      const meta = (u.user.user_metadata ?? {}) as Record<string, unknown>;
      reporter = {
        email: u.user.email ?? null,
        name: (meta.full_name as string) ?? (meta.name as string) ?? null,
      };
    }
  } catch {
    // segue sem dados do reporter
  }

  try {
    const ai = await callAi(buildPrompt(report, reporter), DEFAULT_MODEL);
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("bug_report_analyses")
      .insert({
        bug_report_id: report.id,
        model: DEFAULT_MODEL,
        status: "ok",
        summary: ai.summary,
        severity: ai.severity,
        suspected_area: ai.suspected_area,
        suspected_files: ai.suspected_files,
        root_cause: ai.root_cause,
        proposed_fix: ai.proposed_fix,
        reproduction_steps: ai.reproduction_steps,
        confidence: ai.confidence,
        lovable_prompt: ai.lovable_prompt,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);
    return inserted;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    await supabaseAdmin.from("bug_report_analyses").insert({
      bug_report_id: report.id,
      model: DEFAULT_MODEL,
      status: "error",
      error: msg.slice(0, 1000),
    });
    throw e;
  }
}
