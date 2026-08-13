/**
 * Nota unificada do lead (0–85).
 *
 * A nota combina duas fontes normalizadas:
 * - Questionário de qualificação: até 50 pontos (percentual do máximo do questionário);
 * - Aderência ao ICP: até 35 pontos (percentual do máximo dos critérios de ICP).
 *
 * A soma resulta na nota final de 0 a 85, classificada em faixas de perfil.
 * Quando não há critérios de ICP configurados, a parcela de ICP é 0 e a nota
 * fica limitada a 50 — a UI sinaliza isso para o usuário.
 */

export const QUESTIONNAIRE_MAX_POINTS = 50;
export const ICP_MAX_POINTS = 35;
export const LEAD_SCORE_MAX = QUESTIONNAIRE_MAX_POINTS + ICP_MAX_POINTS; // 85

export type LeadScoreBand = "out" | "partial" | "ideal";

export const LEAD_SCORE_BANDS: { band: LeadScoreBand; min: number; max: number; label: string }[] = [
  { band: "out", min: 0, max: 39, label: "Fora do ICP" },
  { band: "partial", min: 40, max: 59, label: "Parcialmente no ICP" },
  { band: "ideal", min: 60, max: LEAD_SCORE_MAX, label: "Dentro do ICP" },
];

export function leadScoreBand(total: number): LeadScoreBand {
  if (total >= 60) return "ideal";
  if (total >= 40) return "partial";
  return "out";
}

export function leadScoreBandLabel(total: number): string {
  const band = leadScoreBand(total);
  return LEAD_SCORE_BANDS.find((b) => b.band === band)?.label ?? "Fora do ICP";
}

function normalize(points: number, max: number, cap: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  if (!Number.isFinite(max) || max <= 0) return 0;
  const value = (points / max) * cap;
  return Math.max(0, Math.min(cap, Math.round(value * 10) / 10));
}

export interface UnifiedLeadScore {
  /** Parcela normalizada do questionário (0–50). */
  questionnairePoints: number;
  /** Parcela normalizada do ICP (0–35). */
  icpPoints: number;
  /** Nota final (0–85). */
  total: number;
  /** Faixa de perfil derivada da nota. */
  band: LeadScoreBand;
  bandLabel: string;
  /** Percentual da nota em relação a 85. */
  percent: number;
  /** True quando não há critérios de ICP configurados (nota limitada a 50). */
  icpUnavailable: boolean;
}

/**
 * Compõe a nota unificada a partir dos totais brutos de cada fonte.
 *
 * `questionnaireMax` vem de `computeQualificationMaxScore`; `icpMax` vem da
 * soma dos pontos positivos dos critérios de ICP habilitados.
 */
export function computeUnifiedLeadScore(input: {
  questionnaireScore: number;
  questionnaireMax: number;
  icpScore?: number | null;
  icpMax?: number | null;
}): UnifiedLeadScore {
  const questionnairePoints = normalize(
    input.questionnaireScore,
    input.questionnaireMax,
    QUESTIONNAIRE_MAX_POINTS,
  );
  const icpMax = Number(input.icpMax ?? 0);
  const icpUnavailable = !Number.isFinite(icpMax) || icpMax <= 0;
  const icpPoints = icpUnavailable
    ? 0
    : normalize(Number(input.icpScore ?? 0), icpMax, ICP_MAX_POINTS);

  const total = Math.round((questionnairePoints + icpPoints) * 10) / 10;
  return {
    questionnairePoints,
    icpPoints,
    total,
    band: leadScoreBand(total),
    bandLabel: leadScoreBandLabel(total),
    percent: Math.round((total / LEAD_SCORE_MAX) * 100),
    icpUnavailable,
  };
}
