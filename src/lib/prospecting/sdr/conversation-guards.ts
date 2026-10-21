/**
 * Garantias determinísticas sobre a resposta da Lia (casos reais de 16–19/10).
 * Funções puras; o worker aplica os efeitos.
 */
import { toWhatsAppE164 } from "@/lib/phone/whatsapp-e164";

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

const inbound = (h: Msg[]) => h.filter((m) => m.direction === "inbound");

/** "senioridade e senioridade", "o o": remove a repetição imediata. */
export function dedupeRepeatedWords(text: string): string {
  let out = String(text ?? "");
  // "X e X" / "X ou X" (1 a 3 palavras)
  out = out.replace(
    /\b([\p{L}\d-]+(?:\s+[\p{L}\d-]+){0,2})\s+(e|ou)\s+\1\b/giu,
    (_m, a: string) => a,
  );
  // "palavra palavra"
  out = out.replace(/\b([\p{L}]{2,})\s+\1\b/giu, (_m, a: string) => a);
  return out;
}

/** Cliente recusou reunião em alguma mensagem. */
const REFUSE_MEETING_RE =
  /\b(nao (e|eh|vejo|ha) (necessari[oa]|preciso|precisa|necessidade)( de)? (uma |a |de )?(reuniao|call|chamada|conversa)|nao (quero|preciso de|precisamos de|gostaria de) (uma |a )?(reuniao|call|chamada)|sem (necessidade de )?(reuniao|call)|dispenso a reuniao)\b/;
export function refusedMeeting(history: Msg[]): boolean {
  return inbound(history).some((m) => REFUSE_MEETING_RE.test(norm(String(m.body ?? ""))));
}

export function mentionsMeeting(text: string): boolean {
  return /\b(reuniao|call|chamada de video|agendar|agendamento|bate papo|conversa rapida|horario)\b/.test(
    norm(text),
  );
}

/** Pedido de informação/interesse real (orçamento, proposta, valores, perfis). */
export function showsBusinessInterest(history: Msg[]): boolean {
  return inbound(history).some((m) =>
    /\b(orcamento|proposta|valores?|custo|preco|quanto custa|perfil|profissional|alocad|contratar|cases?|conhecer (um pouco )?mais)\b/.test(
      norm(String(m.body ?? "")),
    ),
  );
}

/** Cliente já disse que é o responsável/decisor. */
const SELF_RESPONSIBLE_RE =
  /\b(sou (eu )?(o |a )?(um dos |uma das )?(responsave(l|is)|decisor|gestor|gerente|diretor|cto|cio|head)|eu (sou|que) (o |a )?responsavel|sou eu mesmo|sou eu quem (cuida|responde|decide)|eu (cuido|respondo) (da|pela) (area|ti|tecnologia)|fica comigo|sim sou eu|sou (um|uma) (dos|das)( responsaveis| que cuidam| que respondem)?)\b/;
export function selfIdentifiedResponsible(history: Msg[]): boolean {
  const msgs = inbound(history);
  if (msgs.some((m) => SELF_RESPONSIBLE_RE.test(norm(String(m.body ?? ""))))) return true;
  // "Sim" logo após a abertura "Essa área fica com você?"
  for (let i = 1; i < history.length; i++) {
    const cur = history[i];
    if (cur.direction !== "inbound") continue;
    // Pergunta nossa mais recente antes desta resposta (pula "Bom dia" etc.).
    let j = i - 1;
    while (j >= 0 && history[j].direction === "inbound") j--;
    if (j < 0) continue;
    const prev = history[j];
    if (
      /essa area fica com voce|voce (e|esta a frente|responde)/.test(
        norm(String(prev.body ?? "")),
      ) &&
      /^(sim|isso|correto|exato|sou|eu mesmo|sim sou|sou (um|uma) (dos|das))\b/.test(
        norm(String(cur.body ?? "")),
      )
    )
      return true;
  }
  return false;
}

export function asksDecisionMaker(text: string): boolean {
  return /\b(decisor(a|es)?|quem (decide|sera o decisor|aprova)|qual (e )?(o )?seu cargo|voce (e|esta a frente|responde)( pela| da)? (area|ti)|responsavel pela (area|ti|decisao))\b/.test(
    norm(text),
  );
}

/** "Você é uma IA/robô/bot?" */
export function isAiIdentityQuestion(text: string): boolean {
  return /\b(voce|vc|e|eh|tu) (e |eh |esta )?(uma |um )?(ia|i a|inteligencia artificial|robo|bot|chatbot|maquina|gpt|chatgpt|automatic[oa])\b|\b(falando com|conversando com) (uma |um )?(ia|robo|bot|maquina|pessoa de verdade)\b|\b(e|eh) (uma )?pessoa (real|de verdade)\b/.test(
    norm(text),
  );
}

/** "Não é o momento", "nem nos próximos 2 anos". */
export function notTheMoment(text: string): boolean {
  return /\b(nao (e|eh) o momento|agora nao|no momento nao|nao no momento|nao temos (demanda|necessidade|nenhuma)|nem (para|pros?) (os )?proximos|sem demanda|sem previsao)\b/.test(
    norm(text),
  );
}

/** Oferta de passar o contato a especialista/"manter contato". */
export function offersToKeepContact(text: string): boolean {
  return /\b(posso (passar|enviar|encaminhar|compartilhar) (o )?seu contato|(passar|encaminhar) seu contato|manter (o )?contato|posso anotar|prefere receber (novidades|materiais)|enviar novidades)\b/.test(
    norm(text),
  );
}

export const NOT_NOW_CLOSE =
  "Entendo, obrigada pela atenção e pela sinceridade! Fico à disposição se algo mudar. Tenha um ótimo dia!";

/** Lia afirma que enviou/vai enviar material. */
export function claimsMaterialSent(text: string): boolean {
  return /\b(material (enviado|segue|em anexo)|(estou|ja estou|vou|vou te|irei) (enviar|reenviar|encaminhar|mandar)( o| um)? (material|apresentacao|documento|portfolio)|segue (o |a )?(material|apresentacao)|enviando o material|enviei (o )?material)\b/.test(
    norm(text),
  );
}

export const MATERIAL_HANDOFF_REPLY =
  "Vou pedir para um especialista da WK te enviar o material por aqui em instantes. Obrigada pela paciência!";

/**
 * Vocativo inicial com nome diferente do cliente ("José, entendo…").
 * Retorna o texto com o nome correto (ou sem vocativo).
 */
export function fixVocative(text: string, allowedNames: string[]): string {
  const m = /^([A-ZÀ-Ú][\p{L}]{1,20})([,!.])\s*/u.exec(String(text ?? ""));
  if (!m) return text;
  const name = m[1];
  const allowed = allowedNames.filter(Boolean).map((n) => norm(n));
  if (!allowed.length) return text;
  if (allowed.includes(norm(name))) return text;
  // Só trata como vocativo se parece nome (não "Claro", "Perfeito", "Entendo"...).
  if (
    /^(claro|perfeito|entendo|entendi|otimo|certo|obrigad[oa]|ola|oi|bom|boa|sim|nao|legal|combinado|show|beleza|excelente|pronto|tudo)$/i.test(
      norm(name),
    )
  )
    return text;
  const first = allowedNames.find(Boolean) ?? "";
  return `${first}${m[2]} ${text.slice(m[0].length)}`;
}

/** "Me chamo Pedro" / "meu nome é Pedro". */
export function correctedName(history: Msg[]): string | null {
  let found: string | null = null;
  for (const m of inbound(history)) {
    const r = /\b(?:[Mm]e chamo|[Mm]eu nome (?:é|e))\s+([A-ZÀ-Ú][\p{L}]{1,20})/u.exec(
      String(m.body ?? ""),
    );
    if (r) found = r[1];
  }
  return found;
}

/** Número corporativo/alternativo informado pelo próprio cliente. */
export function extractCorporatePhone(text: string): string | null {
  const raw = String(text ?? "");
  if (
    !/corporativ|comercial|outro n[uú]mero|novo n[uú]mero|meu n[uú]mero|whats(app)?|celular|contato/i.test(
      raw,
    )
  )
    return null;
  const m = /(\+?55\s*)?\(?\d{2}\)?[\s.-]*9?\s?\d{4}[\s.-]?\d{4}/.exec(raw);
  if (!m) return null;
  return toWhatsAppE164(m[0]);
}

/** Nome usado na abertura do modelo ("Olá, Luiz, tudo bem?"). */
export function greetingName(history: Msg[]): string | null {
  const first = history.find((m) => m.direction !== "inbound");
  const r =
    /^\s*(?:[Oo]l[aá]|[Oo]i|[Bb]om dia|[Bb]oa tarde|[Bb]oa noite)[,!]?\s+([A-ZÀ-Ú][\p{L}]{1,20})\b/u.exec(
      String(first?.body ?? ""),
    );
  return r ? r[1] : null;
}

/** Mesma mensagem recebida 2+ vezes: típico de robô repetindo o menu. */
export function repeatsIdenticalInbound(history: Msg[]): boolean {
  const seen = new Map<string, number>();
  for (const m of inbound(history)) {
    const k = norm(String(m.body ?? ""));
    if (k.length < 25) continue;
    const n = (seen.get(k) ?? 0) + 1;
    if (n >= 2) return true;
    seen.set(k, n);
  }
  return false;
}

/**
 * Mensagem claramente destinada a outra pessoa (caso Otávio Chaves, 19/10):
 * vocativo afetivo no início ("Amor, ...", "Meu bem", "Mãe"). Ambíguo segue normal.
 */
export function isOffTopic(text: string): boolean {
  const t = norm(text);
  if (!t) return false;
  return /^(amor|meu amor|amorzinho|mozao|mor|meu bem|bebe|vida|minha vida|querida|querido|gata|gato|mae|mamae|pai|papai|filha|filho|mana|mano)\b/.test(
    t,
  );
}

/**
 * Função fora do público da prospecção (caso Jhoni Conzatti): desenvolvedor,
 * programador, estagiário, suporte, sem cargo de gestão/decisão na mesma mensagem.
 */
export function outOfIcpRole(text: string): boolean {
  const t = norm(text);
  if (
    !/\bsou (o |a |um |uma )?(desenvolvedor|desenvolvedora|dev|programador|programadora|estagiari[oa]|analista de suporte|tecnico de suporte|suporte tecnico|atendente)\b/.test(
      t,
    )
  )
    return false;
  return !/\b(gestor|gestora|gerente|coordenador|coordenadora|diretor|diretora|cto|head|lider|socio|socia|dono|dona|fundador|fundadora|responsavel|decido|cuido da (ti|area))\b/.test(
    t,
  );
}

export const OUT_OF_ICP_CLOSE =
  "Obrigada pelo retorno! Peço desculpas pelo contato. Tenha um ótimo dia!";

/** "Como conseguiu meu contato?", "quem me indicou?" (caso Luiz Cezar). */
export function asksContactSource(text: string): boolean {
  return /\b(quem (te |lhe )?(indicou|passou|deu)|quem foi a indicacao|como (voce |vc )?(conseguiu|chegou|achou|obteve) (o |a )?(meu|minha|esse|este) (contato|numero|telefone)|onde (voce |vc )?(conseguiu|pegou|achou) (o |a )?(meu|esse) (contato|numero)|nao sei como (voce |vc )?chegou)/.test(
    norm(text),
  );
}

export const CONTACT_SOURCE_REPLY =
  "Seu contato veio de uma pesquisa em bases comerciais e perfis profissionais públicos, sem indicação de uma pessoa específica. Se preferir não receber mensagens, é só me avisar e não volto a escrever. Obrigada!";
