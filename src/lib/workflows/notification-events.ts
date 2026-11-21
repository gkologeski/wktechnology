import { z } from "zod";
import type { WorkflowEntity, WorkflowTrigger } from "./types";
import { isWorkflowReadonlySource } from "./types";
import { resolveWorkflowTokenPath } from "./token-aliases";

export const WORKFLOW_NOTIFICATION_EVENT_KEYS = [
  "crm.deal.won",
  "crm.deal.lost",
  "crm.deal.stage_changed",
  "crm.proposal.accepted",
  "contracts.draft.accepted",
  "contracts.signature.completed",
  "contracts.contract.expiring",
  "contracts.contract.renewal_due",
  "projects.project.started",
  "projects.project.overdue",
  "projects.task.overdue",
  "projects.milestone.due",
  "ats.application.received",
  "ats.interview.scheduled",
  "ats.offer.accepted",
  "people.employment.started",
  "people.document.expiring",
  "people.approval.pending",
  "finance.payable.due",
  "finance.receivable.due",
  "finance.payable.overdue",
  "finance.receivable.overdue",
  "finance.invoice.received",
] as const;
export type WorkflowNotificationEventKey = (typeof WORKFLOW_NOTIFICATION_EVENT_KEYS)[number];
export type WorkflowNotificationEventSelection = {
  key: WorkflowNotificationEventKey;
  days_before?: number;
};

export const WORKFLOW_NOTIFICATION_EVENTS = [
  {
    key: "crm.deal.won",
    label: "Negócio ganho",
    description: "O negócio entra em uma etapa de ganho do funil.",
    entity: "deals",
    moduleKey: "crm",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "crm.deal.lost",
    label: "Negócio perdido",
    description: "O negócio entra em uma etapa de perda do funil.",
    entity: "deals",
    moduleKey: "crm",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "crm.deal.stage_changed",
    label: "Etapa do negócio alterada",
    description:
      "Outras mudanças de etapa, incluindo reabertura; ganho e perda usam eventos próprios.",
    entity: "deals",
    moduleKey: "crm",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "crm.proposal.accepted",
    label: "Proposta aceita",
    description: "O cliente aceita uma proposta válida enviada.",
    entity: "proposals",
    moduleKey: "crm",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "contracts.draft.accepted",
    label: "Minuta aceita",
    description: "O cliente aceita a minuta vinculada ao negócio.",
    entity: "deals",
    moduleKey: "contracts",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "contracts.signature.completed",
    label: "Assinatura concluída",
    description: "O contrato recebe a confirmação de assinatura concluída.",
    entity: "contracts",
    moduleKey: "contracts",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "contracts.contract.expiring",
    label: "Contrato próximo do vencimento",
    description: "O contrato entra no período de aviso anterior à data de término.",
    entity: "contracts",
    moduleKey: "contracts",
    scheduling: "before_due",
    deadline: true,
  },
  {
    key: "contracts.contract.renewal_due",
    label: "Prazo de aviso de renovação próximo",
    description: "O contrato com renovação automática se aproxima do prazo de aviso de renovação.",
    entity: "contracts",
    moduleKey: "contracts",
    scheduling: "before_due",
    deadline: true,
  },
  {
    key: "projects.project.started",
    label: "Projeto iniciado",
    description:
      "O projeto muda de planejamento para ativo; retomadas não iniciam esta ocorrência.",
    entity: "projects",
    moduleKey: "projects",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "projects.project.overdue",
    label: "Projeto atrasado",
    description:
      "O projeto em planejamento ou ativo ultrapassa o prazo após a publicação da regra, uma vez por prazo.",
    entity: "projects",
    moduleKey: "projects",
    scheduling: "overdue",
    deadline: false,
  },
  {
    key: "projects.task.overdue",
    label: "Tarefa de projeto atrasada",
    description:
      "Uma tarefa aberta ultrapassa o prazo após a publicação da regra; exige projeto em planejamento, ativo ou em espera.",
    entity: "project_tasks",
    moduleKey: "projects",
    scheduling: "overdue",
    deadline: false,
  },
  {
    key: "projects.milestone.due",
    label: "Marco próximo do prazo",
    description:
      "Um marco pendente ou em andamento entra na antecedência configurada; exige projeto em planejamento, ativo ou em espera.",
    entity: "project_milestones",
    moduleKey: "projects",
    scheduling: "before_due",
    deadline: true,
  },
  {
    key: "ats.application.received",
    label: "Inscrição em vaga recebida",
    description:
      "Uma candidatura é recebida na origem canônica da vaga; reabertura não representa nova inscrição.",
    entity: "ats_applications",
    moduleKey: "ats",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "ats.interview.scheduled",
    label: "Entrevista marcada",
    description:
      "Uma entrevista é agendada ou remarcada para um horário futuro; canceladas e horários passados não entram.",
    entity: "ats_interviews",
    moduleKey: "ats",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "ats.offer.accepted",
    label: "Oferta aceita",
    description:
      "A oferta enviada recebe assinatura completa e verificável da revisão aprovada; não confirma contratação ou admissão.",
    entity: "ats_offers",
    moduleKey: "ats",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "people.employment.started",
    label: "Início de vínculo autorizado",
    description:
      "Uma admissão é confirmada ou um início direto governado é autorizado; não presume dia trabalhado por status ou data.",
    entity: "people",
    moduleKey: "people",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "people.document.expiring",
    label: "Documento próximo do vencimento",
    description:
      "Um documento autorizado entra na antecedência configurada; documentos já vencidos e pessoas arquivadas não entram.",
    entity: "people_documents",
    moduleKey: "people",
    scheduling: "before_due",
    deadline: true,
  },
  {
    key: "people.approval.pending",
    label: "Aprovação de solicitação profissional pendente",
    description:
      "Uma etapa de preparação profissional é liberada ao aprovador vigente; não cobre vagas, fornecedores ou todas as alçadas de RH.",
    entity: "hiring_preparation_requests",
    moduleKey: "people",
    scheduling: "transition",
    deadline: false,
  },
  {
    key: "finance.payable.due",
    label: "Conta a pagar do dia",
    description:
      "Lançamento a pagar com saldo em aberto e vencimento hoje, pelo calendário de São Paulo.",
    entity: "financial_entries",
    moduleKey: "finance",
    scheduling: "on_due",
    deadline: false,
  },
  {
    key: "finance.receivable.due",
    label: "Conta a receber do dia",
    description:
      "Lançamento a receber com saldo em aberto e vencimento hoje, pelo calendário de São Paulo.",
    entity: "financial_entries",
    moduleKey: "finance",
    scheduling: "on_due",
    deadline: false,
  },
  {
    key: "finance.payable.overdue",
    label: "Conta a pagar vencida",
    description:
      "Saldo a pagar após o vencimento. Somente atrasos iniciados depois da publicação; não cria cobrança ou baixa.",
    entity: "financial_entries",
    moduleKey: "finance",
    scheduling: "overdue",
    deadline: false,
  },
  {
    key: "finance.receivable.overdue",
    label: "Conta a receber vencida",
    description:
      "Saldo a receber após o vencimento. Somente atrasos iniciados depois da publicação; não cria cobrança ou baixa.",
    entity: "financial_entries",
    moduleKey: "finance",
    scheduling: "overdue",
    deadline: false,
  },
  {
    key: "finance.invoice.received",
    label: "NF de contratação recebida",
    description:
      "NF-e ou NFS-e de contratação registrada após confirmação do arquivo. Não cobre emissão a clientes, notas avulsas, RPA ou folha.",
    entity: "hiring_fiscal_documents",
    moduleKey: "finance",
    scheduling: "transition",
    deadline: false,
  },
] as const satisfies readonly {
  key: WorkflowNotificationEventKey;
  label: string;
  description: string;
  entity: WorkflowEntity;
  moduleKey: "crm" | "contracts" | "projects" | "ats" | "people" | "finance";
  scheduling: "transition" | "overdue" | "before_due" | "on_due";
  deadline: boolean;
}[];

export function getWorkflowNotificationEvent(key: unknown) {
  return WORKFLOW_NOTIFICATION_EVENTS.find((event) => event.key === key) ?? null;
}

/** Sensitive business occurrences expose only identifiers, state and dates to the shared queue. */
export function isMinimalNotificationEvent(key: unknown): boolean {
  const moduleKey = getWorkflowNotificationEvent(key)?.moduleKey;
  return moduleKey === "ats" || moduleKey === "people" || moduleKey === "finance";
}

/** Public queue fields; values, fiscal identifiers and files stay at their canonical read boundary. */
export const FINANCE_NOTIFICATION_ENTRY_FIELDS = [
  "id",
  "workspace_id",
  "owner_id",
  "assigned_to",
  "direction",
  "status",
  "due_date",
  "created_at",
  "updated_at",
] as const;
export const FINANCE_NOTIFICATION_FISCAL_FIELDS = [
  "id",
  "workspace_id",
  "request_id",
  "start_id",
  "kind",
  "doc_type",
  "status",
  "registered_at",
  "issued_on",
] as const;

/** null preserves the existing public field catalogue for the other events and generic workflows. */
export function workflowNotificationEventFields(key: unknown): readonly string[] | null {
  const definition = getWorkflowNotificationEvent(key);
  if (definition?.moduleKey !== "finance") return null;
  return definition.entity === "hiring_fiscal_documents"
    ? FINANCE_NOTIFICATION_FISCAL_FIELDS
    : FINANCE_NOTIFICATION_ENTRY_FIELDS;
}

export function workflowNotificationEventFieldAllowed(key: unknown, field: string): boolean {
  const fields = workflowNotificationEventFields(key);
  return fields === null || fields.includes(field);
}

const FINANCE_SOURCE_MUTATIONS = [
  "create_payable_schedule",
  "create_receivable_invoice",
  "cancel_payable_schedules",
  "set_field",
  "set_substatus",
  "clear_field",
  "increment_field",
  "copy_field_from_association",
  "associate_records",
  "disassociate_records",
  "assign_to",
  "rotate_assign",
];
const FINANCE_WRITE_TABLES = [
  "financial_entries",
  "bank_payments",
  "customer_invoices",
  "subscription_invoices",
  "recurring_plans",
  "financial_payments",
  "financial_recurrences",
  "hiring_fiscal_documents",
];

/** A minimal notice snapshot must never supply a missing financial value as zero or empty. */
export function notificationEventConfigurationProblem(
  key: unknown,
  configuration: unknown,
): string | null {
  const fields = workflowNotificationEventFields(key);
  if (fields === null) return null;
  const available = Object.fromEntries(fields.map((field) => [field, true]));
  const fieldProblem = (field: unknown) =>
    typeof field === "string" && fields.includes(field)
      ? null
      : "Campo indisponível neste aviso financeiro; use somente os identificadores, estados e datas oferecidos.";
  const visit = (value: unknown): string | null => {
    if (typeof value === "string") {
      for (const match of value.matchAll(/{{\s*([^{}]+?)\s*}}/g)) {
        const path = match[1].trim();
        if (/^(vars|variaveis|steps|passos)\./.test(path)) continue;
        const problem = fieldProblem(resolveWorkflowTokenPath(available, path));
        if (problem) return problem;
      }
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const problem = visit(item);
        if (problem) return problem;
      }
      return null;
    }
    if (!value || typeof value !== "object") return null;
    const object = value as Record<string, unknown>;
    if (
      FINANCE_SOURCE_MUTATIONS.includes(String(object.type)) ||
      (["create_record", "update_record", "delete_record"].includes(String(object.type)) &&
        FINANCE_WRITE_TABLES.includes(String(object.table)))
    )
      return "Este aviso financeiro não altera lançamentos ou documentos; use a operação financeira canônica.";
    if (typeof object.op === "string" && Object.hasOwn(object, "field")) {
      const problem = fieldProblem(object.field);
      if (problem) return problem;
    }
    if (["switch_by_value", "delay_until_date"].includes(String(object.type))) {
      const problem = fieldProblem(object.field);
      if (problem) return problem;
    }
    if (
      object.type === "format_data" &&
      object.op !== "template_string" &&
      object.source_field !== undefined
    ) {
      const problem = fieldProblem(object.source_field);
      if (problem) return problem;
    }
    for (const item of Object.values(object)) {
      const problem = visit(item);
      if (problem) return problem;
    }
    return null;
  };
  return visit(configuration);
}

export const APPROVAL_DIRECT_TRANSPORT_ACTIONS = [
  "send_email",
  "send_whatsapp",
  "send_slack",
  "send_teams",
  "webhook",
  "add_to_sequence",
  "email_sequence",
  "enroll_sequence",
  "handoff",
  "sdr_agent",
  "share_material",
  "share_booking_link",
] as const;

/** Preparation approval notices are addressed only to the live released approver. */
export function notificationEventActionProblem(
  key: unknown,
  actions: readonly unknown[],
): string | null {
  const financeProblem = notificationEventConfigurationProblem(key, actions);
  if (financeProblem) return financeProblem;
  if (key !== "people.approval.pending") return null;
  for (const value of actions) {
    if (!value || typeof value !== "object") continue;
    const action = value as Record<string, unknown>;
    if ((APPROVAL_DIRECT_TRANSPORT_ACTIONS as readonly unknown[]).includes(action.type))
      return "Esta aprovação somente envia pelo aviso ao aprovador pendente.";
    if (action.type === "send_notification") {
      const recipient =
        Array.isArray(action.recipients) && action.recipients.length === 1
          ? (action.recipients[0] as Record<string, unknown> | null)
          : null;
      if (
        !recipient ||
        recipient.kind !== "pending_approvers" ||
        Object.keys(recipient).length !== 1 ||
        action.user_id
      )
        return "Esta aprovação exige somente o aprovador pendente como destinatário.";
    }
    const children: unknown[][] = [];
    for (const name of ["then", "else", "default", "actions"])
      if (Array.isArray(action[name])) children.push(action[name] as unknown[]);
    for (const name of ["branches", "cases"])
      if (Array.isArray(action[name]))
        for (const branch of action[name] as unknown[])
          if (
            branch &&
            typeof branch === "object" &&
            Array.isArray((branch as Record<string, unknown>).actions)
          )
            children.push((branch as { actions: unknown[] }).actions);
    for (const child of children) {
      const problem = notificationEventActionProblem(key, child);
      if (problem) return problem;
    }
  }
  return null;
}

export const notificationEventSelectionSchema = z
  .object({
    key: z.enum(WORKFLOW_NOTIFICATION_EVENT_KEYS),
    days_before: z.number().int().min(1).max(365).optional(),
  })
  .strict()
  .superRefine((selection, ctx) => {
    const definition = getWorkflowNotificationEvent(selection.key)!;
    if (definition.deadline !== (selection.days_before !== undefined))
      ctx.addIssue({
        code: "custom",
        path: ["days_before"],
        message: definition.deadline
          ? "Informe a antecedência de um a 365 dias."
          : "Este evento não utiliza antecedência em dias.",
      });
  });

/** Named rows and ordinary CRUD rows are separate selectors on the same durable queue. */
export function workflowNotificationTriggerMatches(
  trigger: Pick<WorkflowTrigger, "notification_event" | "time_based">,
  event: { entity: WorkflowEntity; notification_event_key?: unknown },
) {
  if (trigger.notification_event && trigger.time_based) return false;
  if (event.notification_event_key == null)
    return !isWorkflowReadonlySource(event.entity) && trigger.notification_event === undefined;
  const selection = notificationEventSelectionSchema.safeParse(trigger.notification_event);
  if (!selection.success || selection.data.key !== event.notification_event_key) return false;
  return getWorkflowNotificationEvent(selection.data.key)?.entity === event.entity;
}

export function workflowNotificationTriggerLabel(
  trigger: Pick<WorkflowTrigger, "notification_event">,
): string | null {
  if (trigger.notification_event === undefined) return null;
  const selection = notificationEventSelectionSchema.safeParse(trigger.notification_event);
  return selection.success
    ? getWorkflowNotificationEvent(selection.data.key)!.label
    : "Evento de negócio requer revisão";
}

/** The initial 30-day value is written explicitly into an editable, disabled draft. */
export function workflowNotificationEventTrigger(
  key: WorkflowNotificationEventKey,
  daysBefore = 30,
): WorkflowTrigger {
  const definition = getWorkflowNotificationEvent(key);
  if (!definition) throw Error("Evento de notificação indisponível.");
  const selection = notificationEventSelectionSchema.parse({
    key,
    ...(definition.deadline ? { days_before: daysBefore } : {}),
  });
  return {
    event: [
      "crm.deal.won",
      "crm.deal.lost",
      "crm.deal.stage_changed",
      "crm.proposal.accepted",
    ].includes(key)
      ? "stage_changed"
      : "updated",
    filters: [],
    reenroll: { enabled: true },
    notification_event: selection,
  };
}
