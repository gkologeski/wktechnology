// Tipos e utilitários compartilhados para sinais de urgência/valor em kanbans.
// Cada domínio (deals, tickets, candidates, etc.) tem seu próprio módulo que
// implementa a heurística e produz um `KanbanSignals` por item.

export type HotClass = "hot" | "rising" | "cold" | "neutral";

export type KanbanSignals = {
  /** 0..100 — quanto maior, mais próximo do fechamento/urgente. */
  score: number;
  klass: HotClass;
  /** Merece destaque forte (borda + ícone flame). */
  isHot: boolean;
  /** Merece destaque de "prioridade/valor" (borda + ícone gem). */
  isHighValue: boolean;
  /** Texto curto (pt-BR) usado no tooltip. */
  reason?: string;
};

export function classifyScore(score: number): HotClass {
  if (score >= 70) return "hot";
  if (score >= 50) return "rising";
  if (score < 40) return "cold";
  return "neutral";
}

export function percentile(values: number[], p: number): number {
  const arr = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const idx = Math.min(arr.length - 1, Math.floor((p / 100) * arr.length));
  return arr[idx] ?? 0;
}
