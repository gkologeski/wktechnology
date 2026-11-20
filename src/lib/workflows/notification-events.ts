import { z } from "zod";
import type { WorkflowEntity, WorkflowTrigger } from "./types";

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
] as const satisfies readonly {
  key: WorkflowNotificationEventKey;
  label: string;
  description: string;
  entity: WorkflowEntity;
  moduleKey: "crm" | "contracts" | "projects";
  scheduling: "transition" | "overdue" | "before_due";
  deadline: boolean;
}[];

export function getWorkflowNotificationEvent(key: unknown) {
  return WORKFLOW_NOTIFICATION_EVENTS.find((event) => event.key === key) ?? null;
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
  if (event.notification_event_key == null) return trigger.notification_event === undefined;
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
