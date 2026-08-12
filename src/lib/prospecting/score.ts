/**
 * Cálculo compartilhado do score de qualificação.
 *
 * Usado tanto no navegador (painel de qualificação) quanto no servidor
 * (`qualifications.functions.ts`) para que as duas notas nunca divirjam.
 */

export type ScoreOption = { label: string; points?: number | null };

export type ScoreQuestion = {
  id: string;
  type: string;
  weight?: number | null;
  options?: ScoreOption[] | null;
  /** Pontos concedidos quando uma pergunta de texto é respondida (0 = não pontua). */
  text_points?: number | null;
  /** Mínimo de caracteres para considerar a resposta de texto preenchida. */
  text_min_chars?: number | null;
};

const BOOLEAN_POINTS = 10;

function opts(q: ScoreQuestion): ScoreOption[] {
  return Array.isArray(q.options) ? q.options : [];
}

function weightOf(q: ScoreQuestion): number {
  const w = Number(q.weight ?? 1);
  return Number.isFinite(w) && w > 0 ? w : 1;
}

function textPointsOf(q: ScoreQuestion): number {
  const p = Number(q.text_points ?? 0);
  return Number.isFinite(p) ? p : 0;
}

function textMinCharsOf(q: ScoreQuestion): number {
  const n = Number(q.text_min_chars ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Considera a resposta de texto preenchida conforme o mínimo configurado. */
export function isTextAnswered(q: ScoreQuestion, raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  return raw.trim().length >= textMinCharsOf(q);
}

/** Score obtido com as respostas atuais. */
export function computeQualificationScore(
  questions: ScoreQuestion[],
  answers: Record<string, unknown>,
): number {
  let total = 0;
  for (const q of questions) {
    const raw = answers[q.id];
    const weight = weightOf(q);

    if (q.type === "text" || q.type === "textarea") {
      if (textPointsOf(q) !== 0 && isTextAnswered(q, raw)) total += textPointsOf(q) * weight;
      continue;
    }
    if (raw == null) continue;
    if (q.type === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) total += n * weight;
      continue;
    }
    if (q.type === "boolean") {
      if (raw === true || raw === "true") total += BOOLEAN_POINTS * weight;
      continue;
    }
    const list = opts(q);
    if (q.type === "single") {
      const opt = list.find((o) => o.label === raw);
      if (opt) total += (opt.points ?? 0) * weight;
      continue;
    }
    if (q.type === "multi" && Array.isArray(raw)) {
      for (const label of raw) {
        const opt = list.find((o) => o.label === label);
        if (opt) total += (opt.points ?? 0) * weight;
      }
    }
  }
  return total;
}

/**
 * Score máximo teórico do questionário.
 *
 * `single` = maior opção positiva; `multi` = soma das opções positivas;
 * `boolean` = 10; texto = pontos configurados. Perguntas `number` não têm
 * teto definido e por isso não entram no máximo (`hasOpenEnded`).
 */
export function computeQualificationMaxScore(questions: ScoreQuestion[]): {
  max: number;
  hasOpenEnded: boolean;
} {
  let max = 0;
  let hasOpenEnded = false;
  for (const q of questions) {
    const weight = weightOf(q);
    if (q.type === "number") {
      hasOpenEnded = true;
      continue;
    }
    if (q.type === "text" || q.type === "textarea") {
      const p = textPointsOf(q);
      if (p > 0) max += p * weight;
      continue;
    }
    if (q.type === "boolean") {
      max += BOOLEAN_POINTS * weight;
      continue;
    }
    const list = opts(q);
    const positives = list.map((o) => Number(o.points ?? 0)).filter((n) => n > 0);
    if (positives.length === 0) continue;
    if (q.type === "multi") {
      max += positives.reduce((a, b) => a + b, 0) * weight;
    } else {
      max += Math.max(...positives) * weight;
    }
  }
  return { max, hasOpenEnded };
}

/** Percentual de aderência (0-100) do score em relação ao máximo. */
export function scorePercent(score: number, max: number): number | null {
  if (!Number.isFinite(max) || max <= 0) return null;
  const pct = Math.round((score / max) * 100);
  return Math.max(0, Math.min(100, pct));
}
