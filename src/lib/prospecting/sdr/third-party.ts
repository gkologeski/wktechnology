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
  /\b(prefere|deseja|quer) que (eu )?(te |o |a )?transfira\b/,
  /\btransfir\w* para um dos nossos (especialistas|atendentes|consultores)\b/,
  /\bvoce ainda esta ai\b/,
  /\b(sou o|sou a|sou um|sou uma) (bot|robo|assistente virtual)\b/,
  /\batendimento (automatizado|automatico|virtual)\b/,
];

/** Menu de URA: 2+ linhas iniciadas por "N -" / "N." / "N)". */
function hasNumberedMenu(raw: string): boolean {
  const lines = String(raw ?? "")
    .split(/\n/)
    .filter((l) => /^\s*(\d{1,2}|\d\uFE0F?\u20E3)\s*[-–.)]?\s*[-–]?\s*\S/u.test(l) && /\d/.test(l));
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

/**
 * Saída da empresa. "sai/saiu da X" sozinho é ambíguo ("o sistema saiu do ar",
 * "saí da reunião"), então exige contexto de vínculo: a palavra empresa, um
 * tempo decorrido, um nome próprio (no texto original) ou frase inequívoca.
 */
const COMPANY_NOUN = "(empresa|companhia|firma|organizacao|instituicao)";
const LEFT_RE = new RegExp(
  [
    `\\b(sai|saiu|desliguei|deixei|deixou) (da|dessa|desta|daquela) ${COMPANY_NOUN}\\b`,
    `\\b(faz|tem|ha) .{0,20}(anos?|meses) que (eu )?(sai|deixei|nao trabalho)\\b`,
    `\\b(fui|foi) (desligado|desligada|demitido|demitida)\\b`,
    `\\bnao (trabalho|atuo) mais (la|ai|nessa|nesta|naquela|na ${COMPANY_NOUN}|com voces)\\b`,
    `\\bnao faco mais parte (da|dessa|desta) (${COMPANY_NOUN}|equipe|quadro)\\b`,
    `\\bnao sou mais (funcionari|colaborador)`,
    `\\bnao sou mais (da|dessa|desta) ${COMPANY_NOUN}\\b`,
    `\\bmudei de (empresa|emprego)\\b`,
    `\\bme aposentei\\b`,
    // Casos 20–21/10: "já não faço parte do X há 2 anos", "Não sou mais", "não sei que empresa é essa".
    `\\bnao faco mais parte\\b`,
    `\\bnao faco parte (da|do|dessa|desta|desse|deste) .{1,50}\\b(ha|a|faz) \\d+ (anos?|mes|meses)\\b`,
    `\\bnao faco parte (da|dessa|desta) ${COMPANY_NOUN}\\b`,
    `^nao sou mais( nao)?$`,
    `\\bnao (sei|conheco) (que|qual) empresa (e|eh) (essa|esta)\\b`,
    `\\bnao conheco (essa|esta) empresa\\b`,
    `\\bnunca (trabalhei|trabalhou|atuei) (la|ai|nessa|nesta|na|no)\\b`,
  ].join("|"),
);

/** Palavras capitalizadas que não são empresas ("saí do Teams"). */
const NOT_COMPANY = /^(teams|zoom|meet|google|whatsapp|grupo|reuniao|sistema|ar|ti|area|empresa)$/i;

/** "saí da Opentech": 1ª pessoa + nome próprio no texto original. */
function leftNamedCompany(raw: string): boolean {
  const re =
    /\b(?:[Ss]a[ií]|[Dd]eixei|[Nn][aã]o (?:trabalho|atuo|estou)(?: mais)? (?:na|no|em|pela|pelo)) (?:(?:da|do|de) )?([A-ZÀ-Ú][\p{L}\d&.-]+)/gu;
  for (const m of String(raw ?? "").matchAll(re)) {
    const name = m[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!NOT_COMPANY.test(name)) return true;
  }
  return false;
}

const NOT_PERSON_RE =
  /\b(telefone|numero|celular|whats|whatsapp|contato) nao (pertence|e mais)\b|\b(telefone|numero|celular|whats|whatsapp|contato) nao e (de|do|da|o|a)\b|\baqui nao e (o|a)\b|\bnao e o contato (de|do|da)\b|\bpessoa errada\b/;

/** Não é quem buscamos: saiu da empresa ou o número é de outra pessoa. */
export function detectNotTarget(text: string): ThirdPartyReason | null {
  const t = norm(text);
  if (!t) return null;
  // "não sou o X, mas cuido da TI" continua normalmente.
  if (/\b(mas|porem|so que) .*(cuido|respondo|sou responsavel|sou eu|posso ajudar)/.test(t))
    return null;
  if (LEFT_RE.test(t) || leftNamedCompany(text)) return "left_company";
  if (NOT_PERSON_RE.test(t) || isWrongContact(text) || isPrivateNumber(text))
    return "not_this_person";
  return null;
}

/** "Este número é particular/pessoal" (caso Ricardo Silveira, 21/10). */
export function isPrivateNumber(text: string): boolean {
  return /\b(numero|telefone|celular|whats|whatsapp|contato) (e |eh )?(particular|pessoal)\b/.test(
    norm(text),
  );
}

export const PRIVATE_NUMBER_CLOSE =
  "Peço desculpas por ter entrado em contato pelo seu número particular! Não vamos mais chamar por aqui. Tenha um ótimo dia!";

/** Encerramentos fixos nossos: depois deles, só respondemos uma pergunta direta. */
export const CLOSING_MARKS = [
  "Obrigada pelo retorno! Peço desculpas pelo contato.",
  "Obrigada pela atenção e desculpe o incômodo.",
  "Muito obrigada pela indicação!",
  "Não vamos mais chamar por aqui.",
];

export const POST_CLOSE_REPLY =
  "Não, obrigada! Não precisamos de nada no momento. Agradeço a atenção e tenha um ótimo dia!";

/** Pergunta do cliente logo após nosso encerramento ("precisa de algo em infra?"). */
export function isPostCloseQuestion(history: Msg[]): boolean {
  const lastIdx = history.length - 1;
  const last = history[lastIdx];
  if (!last || last.direction !== "inbound" || !/\?/.test(String(last.body ?? ""))) return false;
  const lastOut = [...history].reverse().find((m) => m.direction !== "inbound");
  const body = String(lastOut?.body ?? "");
  return CLOSING_MARKS.some((m) => body.includes(m));
}

/** Nossas mensagens que mantêm o estado "falando com terceiro". */
const WAIT_REFERRAL_REPLY = "Obrigada! Fico no aguardo do contato.";

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
  const before = history.slice(0, lastIdx);
  // O estado "terceiro" só vale se o sinal está na mensagem atual ou se a nossa
  // última mensagem foi a pergunta/aguardo fixos — um sinal antigo não "gruda".
  let reason: ThirdPartyReason | null = detectNotTarget(lastText);
  const lastOut = [...before].reverse().find((m) => m.direction !== "inbound");
  const lastOutBody = String(lastOut?.body ?? "");
  const inThirdPartyState =
    lastOutBody.includes(REFERRAL_MARK) || lastOutBody.includes(WAIT_REFERRAL_REPLY);
  if (!reason && inThirdPartyState) {
    for (const m of before) {
      if (m.direction !== "inbound") continue;
      reason = detectNotTarget(String(m.body ?? "")) ?? reason;
    }
  }
  // Cartão de contato compartilhado = indicação do responsável, mesmo sem "não sou eu"
  // (caso Thiago Debs, 19/10): agradece e encerra, sem qualificar quem indicou.
  if (!reason && /Contato compartilhado/.test(lastText)) {
    const shared = extractReferral(lastText);
    if (shared)
      return {
        action: "save_referral",
        reason: "not_this_person",
        reply: REFERRAL_THANKS,
        referral: shared,
      };
  }
  if (!reason) return { action: "none" };
  // Número particular: desculpa e encerra, sem pedir indicação.
  const recentInbound = history.slice(history.lastIndexOf(lastOut as Msg) + 1);
  if (recentInbound.some((m) => m.direction === "inbound" && isPrivateNumber(String(m.body ?? ""))))
    return { action: "close", reason, reply: PRIVATE_NUMBER_CLOSE };
  const asked = lastOutBody.includes(REFERRAL_MARK);
  const referral = extractReferral(lastText);
  if (referral) return { action: "save_referral", reason, reply: REFERRAL_THANKS, referral };
  if (declinesReferral(lastText)) return { action: "close", reason, reply: CLOSE_THANKS };
  if (promisesReferral(lastText))
    return { action: "wait_referral", reason, reply: WAIT_REFERRAL_REPLY };
  if (asked) return { action: "close", reason, reply: CLOSE_THANKS };
  return { action: "ask_referral", reason, reply: REFERRAL_QUESTION };
}

/**
 * Nome da nova empresa citada ("agora estou na Xpto", "fui para a Xpto").
 * Devolve só o nome (até 5 palavras), sem pontuação final; null se não houver.
 */
export function extractNewCompany(text: string): string | null {
  const raw = String(text ?? "");
  const re =
    /\b(?:agora|hoje|atualmente)?\s*(?:estou|trabalho|atuo)(?: agora| hoje| atualmente)? (?:na|no|em|pela|pelo) ([^\n.,;!?]{2,60})|\b(?:fui|mudei|entrei) (?:para|pra|na|no) (?:a |o )?([^\n.,;!?]{2,60})/giu;
  for (const m of raw.matchAll(re)) {
    const prefix = raw.slice(0, m.index ?? 0).toLowerCase();
    if (/n[aã]o\s*$/.test(prefix) || /\bmais\b/.test(m[0].toLowerCase())) continue;
    const name = (m[1] ?? m[2] ?? "")
      .split(/\s+(?:e|mas|como|onde|desde|há|faz|agora)\s+/i)[0]
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(" ");
    if (!name || !/^[\p{Lu}\d]/u.test(name)) continue;
    return name;
  }
  return null;
}

/** "Saiu da empresa" (+ nova empresa, se citada) para sugerir troca de cadastro. */
export function detectCompanyLeft(text: string): { newCompany: string | null } | null {
  if (detectNotTarget(text) !== "left_company") return null;
  return { newCompany: extractNewCompany(text) };
}
