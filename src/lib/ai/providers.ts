import { CANONICAL_APP_ORIGIN } from "@/lib/platform-domains";
// Catálogo de provedores de IA configuráveis por workspace (seguro para o cliente).
export type AiProviderId =
  | "lovable"
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "deepseek"
  | "openrouter";

export type AiProviderDef = {
  id: AiProviderId;
  name: string;
  description: string;
  baseURL: string;
  requiresKey: boolean;
  keyHint: string;
  keyDocsUrl?: string;
  suggestedModels: string[];
  defaultModel: string;
};

export const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1";

export const AI_PROVIDERS: AiProviderDef[] = [
  {
    id: "lovable",
    name: "Lovable AI",
    description: "Padrão do sistema. Não exige chave; o consumo sai dos créditos do workspace.",
    baseURL: LOVABLE_AI_URL,
    requiresKey: false,
    keyHint: "",
    suggestedModels: [],
    defaultModel: "",
  },
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    description: "Modelos GPT da OpenAI.",
    baseURL: "https://api.openai.com/v1",
    requiresKey: true,
    keyHint: "sk-...",
    keyDocsUrl: "https://platform.openai.com/api-keys",
    suggestedModels: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
    defaultModel: "gpt-4.1-mini",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "Modelos Claude da Anthropic.",
    baseURL: "https://api.anthropic.com/v1",
    requiresKey: true,
    keyHint: "sk-ant-...",
    keyDocsUrl: "https://console.anthropic.com/settings/keys",
    suggestedModels: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"],
    defaultModel: "claude-sonnet-4-5",
  },
  {
    id: "google",
    name: "Google (Gemini)",
    description: "Modelos Gemini do Google AI Studio.",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    requiresKey: true,
    keyHint: "AIza...",
    keyDocsUrl: "https://aistudio.google.com/app/apikey",
    suggestedModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
    defaultModel: "gemini-2.5-flash",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    description: "Modelos Grok da xAI.",
    baseURL: "https://api.x.ai/v1",
    requiresKey: true,
    keyHint: "xai-...",
    keyDocsUrl: "https://console.x.ai",
    suggestedModels: ["grok-4", "grok-3-mini"],
    defaultModel: "grok-3-mini",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Modelos DeepSeek.",
    baseURL: "https://api.deepseek.com/v1",
    requiresKey: true,
    keyHint: "sk-...",
    keyDocsUrl: "https://platform.deepseek.com/api_keys",
    suggestedModels: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Um só acesso a centenas de modelos, com roteamento automático entre provedores.",
    baseURL: "https://openrouter.ai/api/v1",
    requiresKey: true,
    keyHint: "sk-or-...",
    keyDocsUrl: "https://openrouter.ai/keys",
    suggestedModels: ["openrouter/auto", "openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5"],
    defaultModel: "openrouter/auto",
  },
];

export const EXTERNAL_PROVIDER_IDS = AI_PROVIDERS.filter((p) => p.requiresKey).map((p) => p.id) as [
  Exclude<AiProviderId, "lovable">,
  ...Exclude<AiProviderId, "lovable">[],
];

export function getAiProvider(id: string): AiProviderDef | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

export type AiRoute = {
  provider: AiProviderId;
  url: string;
  headers: Record<string, string>;
  model: string | null; // null = mantém o modelo pedido pelo recurso (Lovable)
};

/** Monta destino/cabeçalhos para um provedor externo compatível com OpenAI. */
export function buildExternalRoute(id: AiProviderId, apiKey: string, model: string): AiRoute {
  const def = getAiProvider(id);
  if (!def || !def.requiresKey) throw new Error(`Provedor de IA inválido: ${id}`);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (id === "openrouter") {
    headers["HTTP-Referer"] = CANONICAL_APP_ORIGIN;
    headers["X-Title"] = "TechERP";
  }
  return {
    provider: id,
    url: `${def.baseURL.replace(/\/$/, "")}/chat/completions`,
    headers,
    model: model || def.defaultModel,
  };
}

/** Ajusta o corpo da requisição ao destino (troca o modelo em provedores externos). */
export function adaptBody(body: Record<string, unknown>, route: AiRoute): Record<string, unknown> {
  if (route.provider === "lovable" || !route.model) return body;
  const out: Record<string, unknown> = { ...body, model: route.model };
  // Campos específicos do gateway Lovable não são aceitos por outros provedores.
  delete out.reasoning;
  delete out.reasoning_effort;
  return out;
}
