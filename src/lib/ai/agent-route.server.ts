// Modelo do assistente conversacional respeitando o provedor de IA do workspace.
// Mantém o gateway Lovable como padrão e registra a chamada em `ai_call_logs`.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { resolveAiRoute, writeLog } from "./provider-resolver.server";
import type { AiFeature } from "./features";

const LOVABLE_DEFAULT_MODEL = "google/gemini-3.5-flash";

export type AgentModel = {
  provider: string;
  modelId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
};

/** Resolve o modelo do assistente conforme a IA escolhida no workspace. */
export async function resolveAgentModel(workspaceId: string | null): Promise<AgentModel> {
  const route = await resolveAiRoute(workspaceId);
  if (route.provider === "lovable") {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");
    const gateway = createLovableAiGatewayProvider(key);
    return {
      provider: "lovable",
      modelId: LOVABLE_DEFAULT_MODEL,
      model: gateway(LOVABLE_DEFAULT_MODEL),
    };
  }
  const baseURL = route.url.replace(/\/chat\/completions$/, "");
  const provider = createOpenAICompatible({
    name: route.provider,
    baseURL,
    headers: route.headers,
  });
  const modelId = route.model ?? LOVABLE_DEFAULT_MODEL;
  return { provider: route.provider, modelId, model: provider(modelId) };
}

/** Registra uma chamada do assistente no histórico do Painel de IA. */
export async function logAgentCall(args: {
  workspaceId: string | null;
  userId: string | null;
  provider: string;
  modelId: string;
  feature: AiFeature;
  startedAt: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  error?: string | null;
}) {
  const usageText = JSON.stringify({
    usage: {
      prompt_tokens: args.promptTokens ?? undefined,
      completion_tokens: args.completionTokens ?? undefined,
    },
  });
  await writeLog({
    workspace_id: args.workspaceId,
    provider: args.provider,
    model: args.modelId,
    feature: args.feature,
    trigger_source: "user",
    triggered_by: args.userId,
    duration_ms: Date.now() - args.startedAt,
    status: args.error ? "failed" : "success",
    error: args.error ? args.error.slice(0, 300) : null,
    text: args.error ? "" : usageText,
  }).catch(() => undefined);
}
