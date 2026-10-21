// Assistente de análise do TechProjects (servidor). Ferramentas = leituras do painel por perfil com o
// cliente do PRÓPRIO usuário (RLS, negações, workspace ativo). Modelo via `aiChatFetch` (provedor do
// workspace; Lovable AI por padrão; sem troca automática de provedor). Nada é gravado em dados de origem.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  PROJECTS_ASSISTANT_MAX_PER_HOUR,
  PROJECTS_ASSISTANT_MAX_ROWS_PER_TOOL,
  PROJECTS_ASSISTANT_MAX_TOOL_CALLS,
  PROJECTS_ASSISTANT_TIMEOUT_MS,
} from "@/lib/limits";
import { loadDashDrill, loadDashScope, loadDashSummary } from "./dashboard-views.server";
import {
  DASH_VIEW_LABEL,
  DASH_VIEWS,
  type DashDataset,
  type DashFilters,
  type DashView,
} from "./dashboard-views.shared";
import { METRIC_DEFS } from "./dashboard-metric-defs.shared";
import {
  runAssistant,
  type AssistantAnswer,
  type CallModel,
  type Citation,
  type ModelMessage,
  type ToolResult,
} from "./assistant.core";

type Sb = SupabaseClient<Database>;
const MODEL = "google/gemini-2.5-flash";

function dashHref(view: DashView, f: DashFilters, extra = "") {
  const q = new URLSearchParams({ view, from: f.from, to: f.to });
  return `/projects/dashboard?${q.toString()}${extra}`;
}

export function makeToolRunner(sb: Sb, filters: DashFilters) {
  return async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    const view = args.visao as DashView;
    if (name === "resumo_painel") {
      const s = await loadDashSummary(sb, view, filters);
      const { scope: _scope, ...rest } = s;
      void _scope;
      return {
        ok: true,
        data: rest,
        generated_at: s.generated_at,
        citations: [
          {
            label: `Painel — ${DASH_VIEW_LABEL[view]}`,
            href: dashHref(view, filters),
            source: "Painel por perfil (mesmas regras dos cartões)",
            generated_at: s.generated_at,
          },
        ],
      };
    }
    const [dataset, metric] = String(args.indicador).split(".") as [DashDataset, string];
    const limit = Math.min(Number(args.limite ?? 10), PROJECTS_ASSISTANT_MAX_ROWS_PER_TOOL);
    const page = await loadDashDrill(sb, view, dataset, metric, filters, limit, 0);
    const def = METRIC_DEFS[`${dataset}.${metric}`];
    const cites: Citation[] = [
      {
        label: `${def?.title ?? args.indicador} — ${page.total} registro(s)`,
        href: dashHref(view, filters),
        source: def?.source ?? "Painel por perfil",
        generated_at: page.generated_at,
      },
    ];
    for (const r of page.rows) {
      const pid = r.project_id;
      const pname = r.project ?? r.project_name;
      if (typeof pid === "string" && typeof pname === "string")
        cites.push({
          label: pname,
          href: `/projects/${pid}`,
          source: "Projeto",
          generated_at: page.generated_at,
        });
    }
    return {
      ok: true,
      data: {
        indicador: args.indicador,
        definicao: def?.definition ?? null,
        total: page.total,
        segundos: page.seconds,
        linhas: page.rows,
      },
      generated_at: page.generated_at,
      citations: cites,
    };
  };
}

export function aiModelCaller(ctx: { workspaceId: string; userId: string }): CallModel {
  return async (messages: ModelMessage[], tools: unknown[]) => {
    const { aiChatFetch } = await import("@/lib/ai/provider-resolver.server");
    const res = await aiChatFetch(
      {
        method: "POST",
        signal: AbortSignal.timeout(PROJECTS_ASSISTANT_TIMEOUT_MS),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools,
          tool_choice: "auto",
          temperature: 0,
        }),
      },
      {
        feature: "assistente_projetos",
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        triggerSource: "user",
      },
    );
    if (res.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (!res.ok) throw new Error(`O provedor de IA recusou a chamada (${res.status}).`);
    const j = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };
    const m = j.choices?.[0]?.message;
    return {
      content: m?.content ?? null,
      tool_calls: (m?.tool_calls ?? []).map((t) => ({
        id: t.id,
        name: t.function?.name ?? "",
        arguments: t.function?.arguments ?? "{}",
      })),
    };
  };
}

/** Proteção de custo: perguntas por usuário na última hora (registro de uso de IA, sem conteúdo). */
export async function assertAssistantQuota(userId: string, workspaceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabaseAdmin
    .from("ai_call_logs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("triggered_by", userId)
    .eq("feature", "assistente_projetos")
    .gte("created_at", since);
  // Cada pergunta usa até 4 chamadas ao modelo.
  if ((count ?? 0) >= PROJECTS_ASSISTANT_MAX_PER_HOUR * 4)
    throw new Error("Limite de perguntas por hora atingido para o assistente. Tente mais tarde.");
}

export async function askAssistant(
  sb: Sb,
  input: { question: string; filters: DashFilters },
  deps: { callModel: CallModel; userId: string },
): Promise<AssistantAnswer & { generated_at: string; period: string; method: string }> {
  const scope = await loadDashScope(sb);
  const allowed = DASH_VIEWS.filter((v) => scope.views[v]);
  if (allowed.length === 0)
    throw new Error("Você não tem acesso a nenhuma visão do painel do TechProjects.");
  const period = `${input.filters.from} a ${input.filters.to}`;
  const out = await runAssistant({
    question: input.question,
    allowedViews: allowed,
    canCost: scope.can_cost,
    period,
    tz: input.filters.tz,
    callModel: deps.callModel,
    runTool: makeToolRunner(sb, input.filters) as Parameters<typeof runAssistant>[0]["runTool"],
    maxToolCalls: PROJECTS_ASSISTANT_MAX_TOOL_CALLS,
  });
  return {
    ...out,
    generated_at: new Date().toISOString(),
    period,
    method:
      "Consultas somente leitura ao painel por perfil com as suas permissões; o modelo resume os números devolvidos e não acessa o banco.",
  };
}
