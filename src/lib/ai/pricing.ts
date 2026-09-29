// Preços de referência (USD por 1M de tokens). Estimativa: o valor final é o da fatura do provedor.
export const AI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-4-1": { input: 15, output: 75 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "grok-4": { input: 3, output: 15 },
  "grok-3-mini": { input: 0.3, output: 0.5 },
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "anthropic/claude-sonnet-4.5": { input: 3, output: 15 },
};

export type AiUsage = { prompt_tokens?: number; completion_tokens?: number };

/** Custo estimado em USD; null quando não há preço (inclui Lovable AI). */
export function estimateCostUsd(
  provider: string,
  model: string | null | undefined,
  usage: AiUsage | null,
): number | null {
  if (provider === "lovable" || !model || !usage) return null;
  const p = AI_PRICING[model];
  if (!p) return null;
  const cost =
    ((usage.prompt_tokens ?? 0) * p.input + (usage.completion_tokens ?? 0) * p.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Extrai `usage` de JSON ou do texto de um stream SSE (último evento com usage). */
export function parseUsage(text: string): AiUsage | null {
  try {
    const j = JSON.parse(text) as { usage?: AiUsage };
    if (j.usage) return j.usage;
  } catch {
    /* pode ser SSE */
  }
  let found: AiUsage | null = null;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload) as { usage?: AiUsage | null };
      if (j.usage) found = j.usage;
    } catch {
      /* ignora quadro parcial */
    }
  }
  return found;
}
