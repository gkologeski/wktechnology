/**
 * Sinais determinísticos sobre quem responde (puros): padrão de atendimento
 * automático (usado como FATO para a IA, não como resposta), saída da empresa
 * e número de outra pessoa (usados pela sugestão de cadastro da Inbox).
 * Nenhuma função aqui escreve resposta ao cliente.
 */
import { isWrongContact } from "./policy";
import { parseSharedPhone, type Referral as SharedReferral } from "./conversation-state";

export type ThirdPartyReason = "left_company" | "not_this_person";
export type Referral = SharedReferral;

function norm(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\n ]/gu, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

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

/** Indicação em texto ou cartão compartilhado (dado, não decisão). */
export function extractReferral(text: string): Referral | null {
  return parseSharedPhone(text);
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
