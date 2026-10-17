/**
 * Regras determinísticas para quando quem responde NÃO é o responsável:
 * robôs/URA, pessoa que saiu da empresa, número de outra pessoa e indicações.
 * Funções puras (testáveis); o worker aplica os efeitos.
 */
import { isWrongContact } from "./policy";
import { toWhatsAppE164 } from "@/lib/phone/whatsapp-e164";

export type ThirdPartyReason = "left_company" | "not_this_person";

type Msg = { direction: string; body?: string | null };

function norm(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\n ]/gu, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Marca fixa da pergunta de indicação (usada para saber que já perguntamos). */
export const REFERRAL_MARK = "conhece quem responde pela área de TI";

export const REFERRAL_QUESTION = `Peço desculpas pelo engano! Por acaso você ${REFERRAL_MARK} aí e poderia me passar o contato?`;
export const CLOSE_THANKS =
  "Entendo, sem problemas! Obrigada pela atenção e desculpe o incômodo. Tenha um ótimo dia!";
export const REFERRAL_THANKS =
  "Muito obrigada pela indicação! Vou entrar em contato com essa pessoa. Tenha um ótimo dia!";

const AUTO_PATTERNS: RegExp[] = [
  /\b(digite|escolha|selecione|informe) (uma|a|o) (opcao|fila|numero|setor|departamento)/,
  /\bescolha uma fila\b/,
  /\bmensagem automatica\b/,
  /\bresposta automatica\b/,
  /\b(seja|sejam) bem vindo/,
  /\bnosso horario de atendimento\b/,
  /\bem breve (retornaremos|responderemos|um atendente)\b/,
  /\bprotocolo (n|no|numero)?\s?\d/,
  /\bassistente virtual\b/,
  /\bfora do horario de atendimento\b/,
];

/** Menu de URA: 2+ linhas iniciadas por "N -" / "N." / "N)". */
function hasNumberedMenu(raw: string): boolean {
  const lines = String(raw ?? "")
    .split(/\n/)
    .filter((l) => /^\s*\d{1,2}\s*[-–.)]\s*\S/.test(l));
  return lines.length >= 2;
}

/**
 * Atendimento automático. Uma lista numerada sozinha NÃO basta ("1) React 2) Node"):
 * exige saudação/instrução típica de robô, ou menu numerado + instrução.
 */
export function isAutoResponder(text: string): boolean {
  const t = norm(text);
  if (!t) return false;
  const hits = AUTO_PATTERNS.filter((re) => re.test(t)).length;
  if (hits >= 2) return true;
  if (hits >= 1 && hasNumberedMenu(text)) return true;
  if (/\bmensagem automatica\b|\bresposta automatica\b/.test(t)) return true;
  return false;
}

const LEFT_RE =
  /\b(sai|saiu|desliguei|desligado|desligada) (da|do|de la|dela|dessa|desta|de lá)\b|\bnao (trabalho|estou|atuo) mais (la|ai|na|no|nessa|nesta)\b|\bja (faz|tem) .{0,15}(anos?|meses) que (sai|deixei)\b|\bnao faco mais parte\b|\bmudei de empresa\b|\bme aposentei\b|\bdeixei a empresa\b|\bsai de la\b|\bnao sou mais (da|do|funcionari)/;

const NOT_PERSON_RE =
  /\b(telefone|numero|celular|whats|whatsapp|contato) nao e (de|do|da|o|a)\b|\baqui nao e (o|a)\b|\bnao e o contato (de|do|da)\b|\bpessoa errada\b/;

/** Não é quem buscamos: saiu da empresa ou o número é de outra pessoa. */
export function detectNotTarget(text: string): ThirdPartyReason | null {
  const t = norm(text);
  if (!t) return null;
  // "não sou o X, mas cuido da TI" continua normalmente.
  if (/\b(mas|porem|so que) .*(cuido|respondo|sou responsavel|sou eu|posso ajudar)/.test(t))
    return null;
  if (LEFT_RE.test(t)) return "left_company";
  if (NOT_PERSON_RE.test(t) || isWrongContact(text)) return "not_this_person";
  return null;
}

/** Recusa/indisponibilidade de indicação. */
export function declinesReferral(text: string): boolean {
  const t = norm(text);
  return /\bnao (sei|saberia|tenho|conheco|lembro)\b|\bperdi o contato\b|\bnao faco ideia\b|\bnao posso (passar|informar)\b|\bnao tenho como\b/.test(
    t,
  );
}

/** "Vou te encaminhar" — promessa de enviar o contato depois. */
export function promisesReferral(text: string): boolean {
  return /\b(vou|irei|ja) (te |lhe )?(encaminhar|passar|mandar|enviar)\b/.test(norm(text));
}

export type Referral = { name: string | null; phoneE164: string };

/** Extrai indicação: cartão compartilhado ou texto com celular brasileiro. */
export function extractReferral(text: string): Referral | null {
  const raw = String(text ?? "");
  const card = raw.match(/Contato compartilhado\s*\n\s*([^:\n]+):\s*([+\d][\d\s().-]{7,})/);
  if (card) {
    const phone = toWhatsAppE164(card[2]);
    if (phone) return { name: card[1].trim() || null, phoneE164: phone };
  }
  const m = raw.match(/(\+?\d[\d\s().-]{8,}\d)/);
  if (!m) return null;
  const phone = toWhatsAppE164(m[1]);
  if (!phone) return null;
  const before = raw.slice(0, m.index).replace(/[:\-–,]+\s*$/, "");
  const nm = before.match(
    /(?:com (?:o|a)?\s*|e (?:o|a)\s+|^)\s*([A-ZÀ-Ú][\p{L}]+(?: [A-ZÀ-Ú][\p{L}]+){0,3})\s*$/u,
  );
  return { name: nm?.[1]?.trim() ?? null, phoneE164: phone };
}

/** Pergunta de qualificação (necessidade/projeto/desafio) — proibida com terceiros. */
export function isQualificationQuestion(reply: string): boolean {
  const t = norm(reply);
  return (
    /\b(necessidade|demanda|desafio|projeto|planejando|dor|precisam|precisando|vaga|profissional)\b/.test(
      t,
    ) && /\?/.test(reply)
  );
}

export type ThirdPartyDecision =
  | { action: "none" }
  | { action: "ask_referral"; reason: ThirdPartyReason; reply: string }
  | { action: "close"; reason: ThirdPartyReason; reply: string }
  | { action: "save_referral"; reason: ThirdPartyReason; reply: string; referral: Referral }
  | { action: "wait_referral"; reason: ThirdPartyReason; reply: string };

/**
 * Decide a resposta quando a conversa é com um terceiro. O estado vem do próprio
 * histórico: sinal "não é a pessoa" em alguma inbound e/ou nossa pergunta fixa.
 */
export function decideThirdParty(history: Msg[]): ThirdPartyDecision {
  const inbound = history.filter((m) => m.direction === "inbound");
  const last = inbound[inbound.length - 1];
  if (!last) return { action: "none" };
  const lastText = String(last.body ?? "");
  const lastIdx = history.lastIndexOf(last);
  let reason: ThirdPartyReason | null = null;
  for (const m of inbound) {
    const r = detectNotTarget(String(m.body ?? ""));
    if (r) reason = reason ?? r;
  }
  if (!reason) return { action: "none" };
  const asked = history
    .slice(0, lastIdx)
    .some((m) => m.direction !== "inbound" && String(m.body ?? "").includes(REFERRAL_MARK));
  const referral = extractReferral(lastText);
  if (referral) return { action: "save_referral", reason, reply: REFERRAL_THANKS, referral };
  if (declinesReferral(lastText)) return { action: "close", reason, reply: CLOSE_THANKS };
  if (promisesReferral(lastText))
    return { action: "wait_referral", reason, reply: "Obrigada! Fico no aguardo do contato." };
  if (asked) return { action: "close", reason, reply: CLOSE_THANKS };
  return { action: "ask_referral", reason, reply: REFERRAL_QUESTION };
}
