import type { Deal } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Compute the percentile value (0-100) from a numeric array. */
export function percentile(values: number[], p: number): number {
  const arr = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const idx = Math.min(arr.length - 1, Math.floor((p / 100) * arr.length));
  return arr[idx] ?? 0;
}

export type HotScoreInput = {
  deal: Deal;
  pipeline: Pipeline;
  now?: number;
  nextActivityAt?: string | null;
};

/**
 * Heuristic score 0-100 estimating how close a deal is to closing.
 * Won/lost deals always return 0.
 */
export function computeHotScore({
  deal,
  pipeline,
  now = Date.now(),
  nextActivityAt,
}: HotScoreInput): number {
  const stageKey = deal.stage_id || (deal.stage as string);
  const stage = pipeline.stages.find((s) => s.value === stageKey);
  if (stage?.type === "won" || stage?.type === "lost") return 0;
  if (deal.stage === "won" || deal.stage === "lost") return 0;

  // 1. Stage probability (0..1)
  const prob = Math.max(0, Math.min(100, stage?.probability ?? 0)) / 100;

  // 2. Due-soon: expected close date proximity
  let dueSoon = 0;
  if (deal.expected_close_date) {
    const days = (new Date(deal.expected_close_date).getTime() - now) / DAY_MS;
    if (days <= 14) dueSoon = 1;
    else if (days <= 60) dueSoon = 1 - (days - 14) / 46;
    else dueSoon = 0;
    // Overdue (but still open) stays at 1
    if (days < 0) dueSoon = 1;
  }

  // 3. Recent engagement — approximated by next open activity being scheduled soon
  let engagement = 0;
  if (nextActivityAt) {
    const days = Math.abs((new Date(nextActivityAt).getTime() - now) / DAY_MS);
    if (days <= 7) engagement = 1;
    else if (days <= 30) engagement = 0.5;
  }

  // 4. Age decay: deals not updated in a long time lose score
  let ageDecay = 1;
  const updatedAt = deal.updated_at ?? deal.created_at;
  if (updatedAt) {
    const days = (now - new Date(updatedAt).getTime()) / DAY_MS;
    if (days > 90) ageDecay = 0;
    else if (days > 30) ageDecay = 1 - (days - 30) / 60;
  }

  const score = 100 * (0.4 * prob + 0.25 * dueSoon + 0.2 * engagement + 0.15 * ageDecay);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type HotClass = "hot" | "rising" | "cold" | "neutral";

export function classifyScore(score: number): HotClass {
  if (score >= 70) return "hot";
  if (score >= 50) return "rising";
  if (score < 40) return "cold";
  return "neutral";
}

export type DealSignals = {
  score: number;
  klass: HotClass;
  isHot: boolean;
  isHighValue: boolean;
};

/**
 * Compute per-deal signals (score, hotness, high-value flag) for a set of deals.
 * High-value threshold is the p80 of open-deal values in the current filtered set.
 */
export function computeDealSignals(
  deals: Deal[],
  pipeline: Pipeline,
  nextActivities?: Map<string, string>,
  now: number = Date.now(),
): Map<string, DealSignals> {
  const openValues: number[] = [];
  for (const d of deals) {
    if (d.stage === "won" || d.stage === "lost") continue;
    const v = Number(d.value ?? 0);
    if (v > 0) openValues.push(v);
  }
  const p80 = percentile(openValues, 80);

  const out = new Map<string, DealSignals>();
  for (const d of deals) {
    const score = computeHotScore({
      deal: d,
      pipeline,
      now,
      nextActivityAt: nextActivities?.get(d.id) ?? null,
    });
    const klass = classifyScore(score);
    const value = Number(d.value ?? 0);
    const isOpen = d.stage !== "won" && d.stage !== "lost";
    out.set(d.id, {
      score,
      klass,
      isHot: klass === "hot" && isOpen,
      isHighValue: isOpen && value > 0 && p80 > 0 && value >= p80,
    });
  }
  return out;
}
