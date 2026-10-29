// Detecção de retomada quase igual a uma mensagem já enviada (pura, sem rede).
// Proteção técnica: não decide texto, só impede que a retomada automática
// reenvie praticamente a mesma mensagem.

const tokens = (text: string): string[] =>
  String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Semelhança de Dice entre os conjuntos de palavras (0 a 1). */
export function textSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

/** Limite padrão: acima disso a retomada é tratada como repetição. */
export const NEAR_REPEAT_THRESHOLD = 0.8;
/** Mensagens curtas demais só contam como repetição se forem idênticas. */
const MIN_TOKENS = 5;

export function isNearRepeat(
  candidate: string,
  previous: string,
  threshold = NEAR_REPEAT_THRESHOLD,
): boolean {
  const a = tokens(candidate);
  const b = tokens(previous);
  if (!a.length || !b.length) return false;
  if (a.length < MIN_TOKENS || b.length < MIN_TOKENS) return a.join(" ") === b.join(" ");
  return textSimilarity(candidate, previous) >= threshold;
}
