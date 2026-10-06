// Qualificação do SDR sobre o questionário canônico da Prospecção.
// Puro (sem banco): valida respostas da IA por id de pergunta e tipo, exige
// trecho literal de mensagem do cliente, preserva respostas humanas e calcula a
// nota com as mesmas funções da tela de qualificação (questionário + ICP).
import {
  computeQualificationMaxScore,
  computeQualificationScore,
  isTextAnswered,
  type ScoreQuestion,
} from "@/lib/prospecting/score";
import { computeUnifiedLeadScore, type UnifiedLeadScore } from "@/lib/prospecting/lead-score";
import type { ConversationMessage } from "./policy";

export type CanonicalQuestion = ScoreQuestion & {
  label: string;
  required?: boolean | null;
  position?: number | null;
};

export type RawAnswer = { question_id: string; value: string; message_id: string; excerpt: string };

export type AcceptedAnswer = {
  question_id: string;
  label: string;
  value: unknown;
  message_id: string;
  excerpt: string;
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Converte o texto da IA para o tipo da pergunta; null quando não cabe. */
export function coerceAnswer(q: CanonicalQuestion, raw: string): unknown {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const options = Array.isArray(q.options) ? q.options : [];
  const byLabel = (s: string) => options.find((o) => norm(o.label) === norm(s))?.label ?? null;
  switch (q.type) {
    case "single":
      return byLabel(v);
    case "multi": {
      const labels = v
        .split("|")
        .map((s) => byLabel(s))
        .filter((s): s is string => !!s);
      return labels.length ? Array.from(new Set(labels)) : null;
    }
    case "boolean": {
      const n = norm(v);
      if (["true", "sim", "yes"].includes(n)) return true;
      if (["false", "nao", "no"].includes(n)) return false;
      return null;
    }
    case "number": {
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
    case "text":
    case "textarea":
      return isTextAnswered(q, v) ? v.slice(0, 2000) : null;
    default:
      return null;
  }
}

/**
 * Aceita somente respostas a perguntas do questionário, com valor válido para o
 * tipo e trecho literal de uma mensagem inbound existente.
 */
export function acceptAnswers(
  questions: CanonicalQuestion[],
  raw: unknown,
  inbound: ConversationMessage[],
): { accepted: AcceptedAnswer[]; rejected: string[] } {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const msgs = new Map(inbound.filter((m) => m.direction === "inbound").map((m) => [m.id, m]));
  const accepted: AcceptedAnswer[] = [];
  const rejected: string[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const r = (item ?? {}) as Partial<RawAnswer>;
    const q = byId.get(String(r.question_id ?? ""));
    if (!q) {
      rejected.push(`Pergunta desconhecida: ${String(r.question_id ?? "")}`);
      continue;
    }
    const msg = msgs.get(String(r.message_id ?? ""));
    const excerpt = String(r.excerpt ?? "").trim();
    if (!msg || excerpt.length < 2 || !norm(msg.body).includes(norm(excerpt))) {
      rejected.push(`Sem trecho do cliente: ${q.label}`);
      continue;
    }
    const value = coerceAnswer(q, String(r.value ?? ""));
    if (value == null) {
      rejected.push(`Resposta fora das opções: ${q.label}`);
      continue;
    }
    // Uma resposta por pergunta: a mais recente na lista prevalece.
    const i = accepted.findIndex((a) => a.question_id === q.id);
    const row = {
      question_id: q.id,
      label: q.label,
      value,
      message_id: msg.id,
      excerpt: excerpt.slice(0, 500),
    };
    if (i >= 0) accepted[i] = row;
    else accepted.push(row);
  }
  return { accepted, rejected };
}

/** Respostas já gravadas (por humano ou turno anterior) prevalecem sobre as novas. */
export function mergeAnswers(
  existing: Record<string, unknown> | null | undefined,
  accepted: AcceptedAnswer[],
): { answers: Record<string, unknown>; added: AcceptedAnswer[] } {
  const answers: Record<string, unknown> = { ...(existing ?? {}) };
  const added: AcceptedAnswer[] = [];
  for (const a of accepted) {
    const cur = answers[a.question_id];
    const empty = cur == null || cur === "" || (Array.isArray(cur) && cur.length === 0);
    if (!empty) continue;
    answers[a.question_id] = a.value;
    added.push(a);
  }
  return { answers, added };
}

export type CanonicalScore = {
  score: number;
  unified: UnifiedLeadScore;
  requiredAnswered: boolean;
  answeredCount: number;
};

export function scoreCanonical(
  questions: CanonicalQuestion[],
  answers: Record<string, unknown>,
  icp: { points: number; max: number } | null,
): CanonicalScore {
  const score = computeQualificationScore(questions, answers);
  const { max } = computeQualificationMaxScore(questions);
  const unified = computeUnifiedLeadScore({
    questionnaireScore: score,
    questionnaireMax: max,
    icpScore: icp?.points ?? 0,
    icpMax: icp?.max ?? 0,
  });
  const has = (q: CanonicalQuestion) => {
    const v = answers[q.id];
    return !(v == null || v === "" || (Array.isArray(v) && v.length === 0));
  };
  return {
    score,
    unified,
    requiredAnswered: questions.filter((q) => q.required).every(has),
    answeredCount: questions.filter(has).length,
  };
}

/**
 * Critério de oportunidade calculado no servidor: nota unificada (0-85) mínima,
 * perguntas obrigatórias respondidas, oferta identificada. Nunca usa score da IA.
 */
export function qualifiesForOpportunity(o: {
  canonical: CanonicalScore | null;
  minTotal: number;
  offerKeys: string[];
  intent: string;
}): boolean {
  if (o.intent === "opt_out" || !o.canonical) return false;
  return (
    o.canonical.requiredAnswered &&
    o.canonical.answeredCount > 0 &&
    o.canonical.unified.total >= o.minTotal &&
    o.offerKeys.length > 0
  );
}
