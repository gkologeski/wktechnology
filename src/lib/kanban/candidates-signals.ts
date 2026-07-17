// Sinais para o kanban de candidatos.
// Sem depender de stage_entries: usa `updated_at` como proxy de tempo parado
// no status derivado atual. Limites por status foram calibrados para ATS típico.

import { classifyScore, type KanbanSignals } from "./signals";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Dias sem movimento a partir dos quais o candidato é considerado "hot" (precisa mexer)
// e "cold" (esquecido) por status derivado.
const STAGE_THRESHOLDS: Record<string, { hot: number; cold: number }> = {
  new: { hot: 3, cold: 14 },
  in_process: { hot: 7, cold: 21 },
  interview: { hot: 5, cold: 14 },
  offer: { hot: 3, cold: 10 },
  hired: { hot: Infinity, cold: Infinity },
  archived: { hot: Infinity, cold: Infinity },
};

export type CandidateLike = {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
};

export function computeCandidateSignal(
  candidate: CandidateLike,
  status: string,
  now: number = Date.now(),
): KanbanSignals {
  const t = STAGE_THRESHOLDS[status];
  if (!t || !Number.isFinite(t.hot)) {
    return { score: 0, klass: "neutral", isHot: false, isHighValue: false };
  }
  const updatedAt = candidate.updated_at ?? candidate.created_at;
  if (!updatedAt) return { score: 0, klass: "neutral", isHot: false, isHighValue: false };

  const idleDays = (now - new Date(updatedAt).getTime()) / DAY;
  let score = 0;
  let reason: string | undefined;

  if (idleDays >= t.cold) {
    score = 100;
    reason = `Parado há ${Math.round(idleDays)}d`;
  } else if (idleDays >= t.hot) {
    // Interpola entre 70 e 95 conforme se aproxima do limite "cold".
    const ratio = (idleDays - t.hot) / Math.max(1, t.cold - t.hot);
    score = Math.round(70 + Math.min(1, ratio) * 25);
    reason = `Parado há ${Math.round(idleDays)}d`;
  } else if (idleDays >= t.hot * 0.5) {
    score = 45;
  }

  // "Cold" (>= t.cold) esmaece; entre hot e cold, é "hot".
  const isColdOutlier = idleDays >= t.cold;
  const klass = classifyScore(score);
  return {
    score,
    klass: isColdOutlier ? "cold" : klass,
    isHot: score >= 70 && !isColdOutlier,
    isHighValue: false,
    reason,
  };
}

export function computeCandidateSignals<T extends CandidateLike>(
  candidates: T[],
  getStatus: (c: T) => string,
  now: number = Date.now(),
): Map<string, KanbanSignals> {
  const map = new Map<string, KanbanSignals>();
  for (const c of candidates) map.set(c.id, computeCandidateSignal(c, getStatus(c), now));
  return map;
}
