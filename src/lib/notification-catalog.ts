import { INBOX_CHANNEL_EVENT_DEFINITIONS } from "./workflows/inbox-channel-events";

// Shared metadata only. Registration never emits an event, grants access or enables a channel.
export const NOTIFICATION_CATEGORIES = [
  {
    key: "mention",
    label: "Menções",
    help: "Menções e avisos de revisão que usam o tipo legado de menção.",
  },
  { key: "assignment", label: "Atribuições", help: "Avisos de atribuição de responsabilidade." },
  { key: "deal_stage", label: "Mudança de fase", help: "Mudanças de fase em negócios." },
  { key: "ticket", label: "Tickets", help: "Avisos de tickets." },
  {
    key: "task",
    label: "Tarefas e encaminhamentos",
    help: "Lembretes, tarefas e encaminhamentos para atendimento humano.",
  },
  { key: "sla", label: "SLA", help: "Prazos de primeira resposta, resolução e risco de atraso." },
  {
    key: "message",
    label: "Mensagens e comentários",
    help: "Mensagens de conversas e comentários de atividades.",
  },
  {
    key: "workflow",
    label: "Workflows",
    help: "Avisos gerais emitidos por automações existentes.",
  },
  {
    key: "approval",
    label: "Aprovações",
    help: "Avisos de revisão, aceite e alçadas dos fluxos existentes.",
  },
  {
    key: "hiring",
    label: "Contratação e perfis de vaga",
    help: "Perfis de vaga e formalização de profissionais ou fornecedores.",
  },
  { key: "form", label: "Formulários", help: "Avisos de recebimento de formulários públicos." },
  { key: "portfolio", label: "Carteira", help: "Conflitos de carteira encaminhados para revisão." },
  {
    key: "platform",
    label: "Plataforma e segurança",
    help: "Avisos de plataforma e verificações de segurança.",
  },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];
export type NotificationModule = "crm" | "ats" | "people" | "contracts" | "finance" | "projects";

type EventDefinition = {
  eventKey: string;
  label: string;
  category: NotificationCategory;
  // null is intentional for overloaded/shared legacy types; never guess from title or link.
  moduleKey: NotificationModule | null;
  availability: "legacy" | "active" | "planned";
  legacyTypes: readonly string[];
};

function legacy<const T extends string>(type: T, label: string, category: NotificationCategory) {
  return {
    eventKey: `legacy.${type}`,
    label,
    category,
    moduleKey: null,
    availability: "legacy",
    legacyTypes: [type],
  } as const;
}

function planned<const T extends string>(
  eventKey: T,
  label: string,
  category: NotificationCategory,
  moduleKey: NotificationModule | null,
) {
  return {
    eventKey,
    label,
    category,
    moduleKey,
    availability: "planned",
    legacyTypes: [],
  } as const;
}

function active<const T extends string>(
  eventKey: T,
  label: string,
  category: NotificationCategory,
  moduleKey: NotificationModule,
) {
  return { eventKey, label, category, moduleKey, availability: "active", legacyTypes: [] } as const;
}

export const NOTIFICATION_EVENT_CATALOG = [
  // Legacy types are overloaded. These keys describe compatibility, not a more specific event.
  legacy("mention", "Menção ou revisão legada", "mention"),
  legacy("assignment", "Atribuição legada", "assignment"),
  legacy("deal_stage", "Mudança de fase legada", "deal_stage"),
  legacy("ticket", "Aviso de ticket legado", "ticket"),
  legacy("task", "Tarefa ou encaminhamento legado", "task"),
  legacy("sla", "Aviso de SLA legado", "sla"),
  legacy("message", "Mensagem ou comentário legado", "message"),
  legacy("workflow", "Aviso geral de Workflow", "workflow"),
  legacy("approval", "Aviso de aprovação legado", "approval"),
  legacy("role_profile", "Aviso de perfil de vaga", "hiring"),
  legacy("role_profile_approval", "Aprovação de perfil de vaga", "approval"),
  legacy("hiring_approval", "Aprovação de demanda ou vínculo", "approval"),
  legacy("hiring_preparation_approval", "Aprovação de contratação", "approval"),
  legacy("hiring_formalization", "Formalização de contratação", "hiring"),
  legacy("form_submission", "Recebimento de formulário", "form"),
  legacy("portfolio_conflict", "Conflito de carteira", "portfolio"),
  legacy("sequence_handoff", "Encaminhamento de sequência", "task"),
  legacy("security_scan", "Verificação de segurança", "platform"),
  legacy("platform_alert", "Alerta de plataforma", "platform"),
  legacy("sla.first_response_breach", "SLA de primeira resposta excedido", "sla"),
  legacy("sla.resolution_breach", "SLA de resolução excedido", "sla"),
  legacy("sla.at_risk", "SLA em risco", "sla"),
  // Available for explicitly configured Workflows; catalog registration never creates a rule.
  active("crm.deal.won", "Negócio ganho", "deal_stage", "crm"),
  active("crm.deal.lost", "Negócio perdido", "deal_stage", "crm"),
  active("crm.deal.stage_changed", "Etapa do negócio alterada", "deal_stage", "crm"),
  active("crm.proposal.accepted", "Proposta aceita", "workflow", "crm"),
  active("ats.application.received", "Inscrição em vaga recebida", "hiring", "ats"),
  active("ats.interview.scheduled", "Entrevista marcada", "hiring", "ats"),
  active("ats.offer.accepted", "Oferta aceita", "hiring", "ats"),
  active("people.employment.started", "Início de vínculo autorizado", "hiring", "people"),
  active("people.document.expiring", "Documento próximo do vencimento", "task", "people"),
  active(
    "people.approval.pending",
    "Aprovação de solicitação profissional pendente",
    "approval",
    "people",
  ),
  active("contracts.draft.accepted", "Minuta aceita", "approval", "contracts"),
  active("contracts.signature.completed", "Assinatura concluída", "workflow", "contracts"),
  active("contracts.contract.expiring", "Contrato próximo do vencimento", "task", "contracts"),
  active(
    "contracts.contract.renewal_due",
    "Prazo de aviso de renovação próximo",
    "task",
    "contracts",
  ),
  active("finance.payable.due", "Conta a pagar do dia", "task", "finance"),
  active("finance.receivable.due", "Conta a receber do dia", "task", "finance"),
  active("finance.payable.overdue", "Conta a pagar vencida", "task", "finance"),
  active("finance.receivable.overdue", "Conta a receber vencida", "task", "finance"),
  active("finance.invoice.received", "NF de contratação recebida", "workflow", "finance"),
  active("projects.project.started", "Projeto iniciado", "workflow", "projects"),
  active("projects.project.overdue", "Projeto atrasado", "task", "projects"),
  active("projects.task.overdue", "Tarefa de projeto atrasada", "task", "projects"),
  active("projects.milestone.due", "Marco próximo do prazo", "task", "projects"),
  planned("shared.approval.pending", "Aprovação pendente", "approval", null),
  planned("shared.sla.breached", "SLA excedido", "sla", null),
  active("shared.message.received", "Mensagem de WhatsApp recebida", "message", "crm"),
  ...INBOX_CHANNEL_EVENT_DEFINITIONS.map(({ key, label, moduleKey }) =>
    active(key, label, "message", moduleKey),
  ),
  planned("shared.mention.created", "Menção recebida", "mention", null),
] as const satisfies readonly EventDefinition[];

export type NotificationEventKey = (typeof NOTIFICATION_EVENT_CATALOG)[number]["eventKey"];
export type AvailableNotificationEventKey = Extract<
  (typeof NOTIFICATION_EVENT_CATALOG)[number],
  { availability: "legacy" | "active" }
>["eventKey"];
const eventByKey = new Map<string, EventDefinition>(
  NOTIFICATION_EVENT_CATALOG.map((event) => [event.eventKey, event]),
);
const eventByLegacyType = new Map<string, EventDefinition>();
for (const event of NOTIFICATION_EVENT_CATALOG) {
  for (const type of event.legacyTypes) eventByLegacyType.set(type, event);
}

export function getNotificationEvent(eventKey: unknown): EventDefinition | null {
  return typeof eventKey === "string" ? (eventByKey.get(eventKey) ?? null) : null;
}

export function resolveLegacyNotificationEvent(type: unknown): EventDefinition | null {
  // Exact aliases only. An unrecognized future type must not inherit a noisy family default.
  return typeof type === "string" ? (eventByLegacyType.get(type) ?? null) : null;
}

/** Exact operational keys or legacy aliases only; planned entries remain inert. */
export function resolveAvailableNotificationEvent(value: unknown): EventDefinition | null {
  const event = getNotificationEvent(value) ?? resolveLegacyNotificationEvent(value);
  return event && event.availability !== "planned" ? event : null;
}

/** Explicit RPC provenance takes precedence. Invalid provenance never inherits a noisy alias. */
export function resolveNotificationRecordEvent(row: {
  type?: string | null;
  eventKey?: string | null;
}): EventDefinition | null {
  if (!Object.hasOwn(row, "eventKey")) return resolveLegacyNotificationEvent(row.type);
  const event = getNotificationEvent(row.eventKey);
  return event && event.availability !== "planned" ? event : null;
}

export function withNotificationEvent<T extends { type: string | null; eventKey?: string | null }>(
  row: T,
) {
  const event = resolveNotificationRecordEvent(row);
  return {
    ...row,
    event: event
      ? { eventKey: event.eventKey, category: event.category, moduleKey: event.moduleKey }
      : null,
  };
}
