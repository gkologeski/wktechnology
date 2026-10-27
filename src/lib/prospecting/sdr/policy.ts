// Regras puras do SDR de IA (sem banco, sem rede) — testáveis isoladamente.
import { parseSituation, type Situation } from "./conversation-state";
// O servidor aplica estas regras antes de qualquer envio ou escrita no CRM.

export type SdrOffer = {
  id: string;
  offer_key: string;
  parent_key: string | null;
  name: string;
  status: "active" | "inactive";
  approved_at: string | null;
  summary: string;
  fit_signals: string[];
  discovery_questions: string[];
  commercial_notes: string;
  pricing_policy: string;
};

export type SdrMaterial = {
  id: string;
  title: string;
  approved: boolean;
  active: boolean;
  url: string | null;
  /** Arquivo no bucket privado (kind=file). */
  storage_path?: string | null;
  offer_ids: string[];
};

export type ConversationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
};

export const SDR_INTENTS = [
  "continue",
  "send_material",
  "schedule_meeting",
  "handoff",
  "opt_out",
] as const;
export type SdrIntent = (typeof SDR_INTENTS)[number];

export const COMMERCIAL_STAGES = [
  "awaiting_reply",
  "discovery",
  "qualified",
  "material_sent",
  "meeting_link_sent",
  "meeting_booked",
  "handoff",
  "opted_out",
  "closed",
] as const;
export type CommercialStage = (typeof COMMERCIAL_STAGES)[number];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const COURTESY_RE =
  /^(muito )?(obrigad[oa]s?|obg|valeu|vlw|grat[oa]|agradeco|perfeito|otimo|show|beleza|blz|ok|okay|combinado|certo|ate (mais|logo|breve|sexta|segunda|terca|quarta|quinta|amanha)|tchau|abracos?|abs|bom dia|boa tarde|boa noite| |,|!|\.)+$/;

/**
 * Mensagem só de agradecimento/despedida. Validador protetor: nunca encerra
 * nem descadastra por isso, mesmo que o modelo classifique assim.
 */
export function isCourtesyOnly(text: string, names: string[] = []): boolean {
  let t = ` ${norm(text)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  // Nome configurado do agente ("Obrigado, Lia") não muda o sentido.
  for (const n of names.map((x) => norm(x)).filter(Boolean)) t = t.split(` ${n} `).join(" ");
  t = t.replace(/\s+/g, " ").trim();
  if (!t) return false;
  return COURTESY_RE.test(t);
}

// Usado só pela sugestão de cadastro da Inbox (detectNotTarget), nunca para
// decidir a resposta da Lia.
const WRONG_CONTACT_RE =
  /(\bnao conheco (ninguem|ningue|esse|essa|este|esta)\b|\bnao sou (ele|ela)\b|\bnumero errado\b|\bcontato errado\b|\bpessoa errada\b|\b(foi|e|por|deve ser|mandou|enviou|enviada|enviado) (por )?engano\b|\bnao tem ninguem com esse nome\b|\bvoce errou o numero\b|\bnao e (meu|esse) (nome|numero)\b|\bnao e (ele|ela) (aqui|nao)\b)/;

export function isWrongContact(text: string): boolean {
  const t = norm(text)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || !WRONG_CONTACT_RE.test(t)) return false;
  return !/\b(mas|porem|só que|so que) .*(cuido|respondo|sou responsavel|sou eu|trabalho|posso ajudar)/.test(
    t,
  );
}

// Descadastro explícito (determinístico e permanente). Só pedidos inequívocos
// de parar de receber contato; recusa comercial ("não quero reunião", "não
// tenho interesse agora") NÃO é descadastro — a conversa é encerrada pela
// situação estruturada, sem bloqueio permanente.
const STOP_PATTERNS: RegExp[] = [
  /\b(pare|para|parem|parar) de (me |nos )?(mandar|enviar|chamar|ligar|escrever|contatar|procurar|mandarem)\b/,
  /\bnao (me |nos )?(mande|mandem|envie|enviem|chame|chamem|ligue|liguem|escreva|escrevam|procure|procurem|contate|contatem|incomode|incomodem) mais\b/,
  /\bnao (quero|queremos|desejo|desejamos) (mais )?(receber (mais )?(mensage(m|ns)|contatos?|ligacoes|propagandas?|ofertas|nada|isso|essas)|ser (contatad|procurad)|(mais )?contato|que (voces |vc |voce )?(me |nos )?(chamem|mandem|liguem|escrevam|procurem|entrem em contato))/,
  /\bnao (entre|entrem|entrar) mais em contato\b/,
  /\b(remova|removam|remover|retire|retirem|tire|tirem|exclua|excluam|apague|apaguem) (o |a )?(meu|minha|este|esse|nosso) (numero|contato|telefone|cadastro|whats|whatsapp)\b/,
  /\bme (tire|tira|remova|remove|exclua|exclui) (da|dessa|desta|de sua|da sua) lista\b/,
  /\bdescadastr\w*/,
  /\bunsubscribe\b/,
];

/** Palavras que só valem como descadastro quando são a mensagem inteira. */
const STANDALONE_STOP = ["pare", "parar", "stop", "sair", "cancelar", "descadastrar", "remover"];

const COURTESY_FILLER = /\b(por favor|pfv|pf|obrigad[oa]|obg|ok)\b/g;

function stopNorm(s: string): string {
  return norm(s)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pedido explícito de não receber mais contato. Frases configuradas pelo
 * agente: com uma palavra só valem como mensagem inteira ("Sair"); com mais
 * de uma palavra valem dentro do texto. Determinístico e permanente.
 */
export function detectOptOut(text: string, extra: string[] = []): boolean {
  const t = stopNorm(text);
  if (!t) return false;
  const bare = t.replace(COURTESY_FILLER, " ").replace(/\s+/g, " ").trim();
  const configured = extra.map(stopNorm).filter(Boolean);
  const single = [...STANDALONE_STOP, ...configured.filter((p) => !p.includes(" "))];
  if (single.includes(bare)) return true;
  if (configured.some((p) => p.includes(" ") && ` ${t} `.includes(` ${p} `))) return true;
  return STOP_PATTERNS.some((re) => re.test(t));
}

/** Ofertas que o agente pode usar: ativas e aprovadas. */
export function selectableOffers<T extends Pick<SdrOffer, "status" | "approved_at" | "name">>(
  offers: T[],
): T[] {
  return offers.filter((o) => o.status === "active" && !!o.approved_at);
}

/** Materiais aprovados e ativos, opcionalmente ligados às ofertas escolhidas. */
export function selectableMaterials(materials: SdrMaterial[], offerIds?: string[]): SdrMaterial[] {
  return materials.filter(
    (m) =>
      m.approved &&
      m.active &&
      (!!m.url || !!m.storage_path) &&
      (!offerIds?.length || m.offer_ids.some((id) => offerIds.includes(id))),
  );
}

/** Hora local (0-23) num fuso. */
export function localHour(date: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(
    date,
  );
  return Number(h) % 24;
}

/** Fora do horário de envio. start/end em horas locais; janela pode cruzar a meia-noite. */
export function isQuietHours(date: Date, timeZone: string, start: number, end: number): boolean {
  if (start === end) return false;
  const h = localHour(date, timeZone);
  return start > end ? h >= start || h < end : h >= start && h < end;
}

/** Chave idempotente isolada por workspace e identidade do provedor. */
export function turnIdemKey(parts: {
  workspaceId: string;
  providerPhoneId: string | null | undefined;
  waMessageId: string;
}): string {
  return `wa:${parts.workspaceId}:${parts.providerPhoneId ?? "default"}:${parts.waMessageId}`;
}

export function followUpIdemKey(enrollmentId: string, count: number): string {
  return `fu:${enrollmentId}:${count}`;
}

export type SendGuardInput = {
  job: { status: string; lease_token: string | null; conversation_version: number | null };
  leaseToken: string;
  conversation: { ai_owner: string | null; ai_version: number };
  enrollment: { status: string };
};

/** Rechecagem antes de enviar: descarta trabalho obsoleto (humano assumiu, versão mudou). */
export function sendGuard(i: SendGuardInput): { ok: true } | { ok: false; reason: string } {
  if (i.job.status !== "running" || i.job.lease_token !== i.leaseToken)
    return { ok: false, reason: "lease_lost" };
  if (i.conversation.ai_owner !== "ai") return { ok: false, reason: "owner_not_ai" };
  if (i.job.conversation_version !== i.conversation.ai_version)
    return { ok: false, reason: "stale_version" };
  if (i.enrollment.status !== "active") return { ok: false, reason: "enrollment_inactive" };
  return { ok: true };
}

export type AgentOutput = {
  reply: string;
  intent: SdrIntent;
  offer_keys: string[];
  material_ids: string[];
  /** Respostas brutas ao questionário canônico; validadas em qualification.ts. */
  answers: unknown[];
  handoff_reason: string;
  /** Situação estruturada sugerida pela IA (validada em conversation-state.ts). */
  situation: Situation;
};

export type ValidatedOutput = AgentOutput & { warnings: string[] };

const PRICE_RE = /R\$\s?\d|\d+[.,]?\d*\s?(reais|mil)\b/i;

export const PRICE_WARNING = "A resposta menciona valores; revise antes de enviar.";

/** Menciona valores em dinheiro. */
export function mentionsPrice(text: string): boolean {
  return PRICE_RE.test(text);
}

/** Resposta afirma envio de material que o sistema não anexou (efeito falso). */
export const MATERIAL_CLAIM_WARNING =
  "A resposta afirma envio de material que o sistema não anexou; revise antes de enviar.";

/**
 * Avisos que exigem um humano (efeito falso ou controle comercial violado após
 * nova geração). Os demais são só registro e não travam o envio.
 */
export function blockingWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => w === PRICE_WARNING || w === MATERIAL_CLAIM_WARNING);
}

/**
 * Valida a saída do modelo contra o que o servidor autoriza.
 * Nunca confia em ids vindos do modelo: filtra pelas listas permitidas.
 * Não existe score da IA: a nota vem do questionário canônico no servidor.
 * Resposta vazia só é aceita em descadastro, transferência ou supressão
 * estruturada (robô, mensagem para outra pessoa, nada a responder após
 * encerramento) — nunca é enviada ao canal.
 */
export function validateAgentOutput(
  raw: unknown,
  ctx: {
    offers: Pick<SdrOffer, "offer_key" | "name">[];
    materials: Pick<SdrMaterial, "id">[];
    /** Controle comercial configurado no agente (guardrails.no_pricing). */
    noPricing?: boolean;
  },
): ValidatedOutput | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Saída inválida" };
  const r = raw as Record<string, unknown>;
  const warnings: string[] = [];
  const intent = SDR_INTENTS.includes(r.intent as SdrIntent) ? (r.intent as SdrIntent) : null;
  if (!intent) return { error: "Intenção inválida" };
  const situation = parseSituation(r.situation);
  const reply = typeof r.reply === "string" ? r.reply.trim() : "";
  if (!reply && intent !== "opt_out" && intent !== "handoff" && situation.suppress_reply === "none")
    return { error: "Resposta vazia" };
  if (ctx.noPricing !== false && PRICE_RE.test(reply)) warnings.push(PRICE_WARNING);

  const allowedOffers = new Set(ctx.offers.map((o) => o.offer_key));
  const offer_keys = (Array.isArray(r.offer_keys) ? r.offer_keys : [])
    .filter((k): k is string => typeof k === "string")
    .filter((k) => {
      const ok = allowedOffers.has(k);
      if (!ok) warnings.push(`Oferta descartada: ${k}`);
      return ok;
    });

  const allowedMaterials = new Set(ctx.materials.map((m) => m.id));
  const material_ids = (Array.isArray(r.material_ids) ? r.material_ids : [])
    .filter((k): k is string => typeof k === "string")
    .filter((k) => allowedMaterials.has(k));

  return {
    reply,
    intent,
    offer_keys,
    material_ids,
    answers: Array.isArray(r.answers) ? r.answers : [],
    handoff_reason: typeof r.handoff_reason === "string" ? r.handoff_reason.slice(0, 300) : "",
    situation,
    warnings,
  };
}

/** Estado comercial após a decisão do agente (independe do dono da conversa). */
export function nextStage(
  current: CommercialStage,
  intent: SdrIntent,
  qualified: boolean,
): CommercialStage {
  if (intent === "opt_out") return "opted_out";
  if (intent === "handoff") return "handoff";
  // Agendamento direto: o estágio só vira "meeting_booked" com reunião confirmada.
  if (intent === "send_material") return "material_sent";
  if (qualified) return "qualified";
  return current === "awaiting_reply" ? "discovery" : current;
}

/** Motivos que encerram follow-ups pendentes. */
export const FOLLOW_UP_CANCEL_REASONS = [
  "replied",
  "opt_out",
  "meeting",
  "handoff",
  "human",
] as const;

/** Margem antes do fim da janela de 24 h do WhatsApp para a retomada sair. */
export const FOLLOW_UP_WINDOW_MARGIN_MS = 60 * 60_000;
const WINDOW_MS = 24 * 3600_000;

/**
 * Próximo follow-up: só quando aguardando resposta e dentro do limite.
 * Com `lastInboundAt`, nunca passa do fim da janela de 24 h (menos a margem) e,
 * com `businessHours`, é antecipado para dentro do expediente.
 * Sem horário possível na janela, devolve null.
 */
export function nextFollowUpAt(o: {
  now: Date;
  hours: number;
  count: number;
  max: number;
  stage: CommercialStage;
  lastInboundAt?: string | Date | null;
  businessHours?: { startHour: number; endHour: number; utcOffsetHours: number };
}): Date | null {
  if (o.count >= o.max) return null;
  if (["opted_out", "handoff", "meeting_booked", "closed"].includes(o.stage)) return null;
  let at = o.now.getTime() + Math.max(1, o.hours) * 3600_000;
  if (o.lastInboundAt) {
    const cap = new Date(o.lastInboundAt).getTime() + WINDOW_MS - FOLLOW_UP_WINDOW_MARGIN_MS;
    at = Math.min(at, cap);
  }
  if (o.businessHours) {
    const { startHour, endHour, utcOffsetHours } = o.businessHours;
    const off = utcOffsetHours * 3600_000;
    const local = new Date(at + off);
    const h = local.getUTCHours() + local.getUTCMinutes() / 60;
    if (h < startHour || h >= endHour) {
      // Antecipa para 15 min antes do fim do expediente mais recente.
      const d = new Date(local);
      if (h < startHour) d.setUTCDate(d.getUTCDate() - 1);
      d.setUTCHours(endHour, 0, 0, 0);
      at = d.getTime() - off - 15 * 60_000;
    }
  }
  if (at <= o.now.getTime()) return null;
  return new Date(at);
}

/** Conta perguntas na resposta (regra: uma por mensagem). */
export function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

/** Status da reunião a partir da reserva e do retorno do Google. */
export function meetingStatus(
  b: {
    status: string | null;
    gcal_event_id: string | null;
    calendar_sync_error: string | null;
  } | null,
): "none" | "confirmed" | "sync_failed" | "pending_sync" | "canceled" {
  if (!b) return "none";
  if (b.status === "canceled") return "canceled";
  if (b.gcal_event_id) return "confirmed";
  if (b.calendar_sync_error) return "sync_failed";
  return "pending_sync";
}
