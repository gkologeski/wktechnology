export type SequenceEntity = "leads" | "contacts";

export type SequenceStep =
  | { type: "task"; wait_days: number; subject: string; body?: string }
  | { type: "email"; wait_days: number; subject: string; body?: string }
  | { type: "wait"; wait_days: number };

export const ENTITY_LABELS: Record<SequenceEntity, string> = {
  leads: "Leads",
  contacts: "Contatos",
};

export const STEP_LABELS: Record<SequenceStep["type"], string> = {
  task: "Criar tarefa",
  email: "Registrar e-mail",
  wait: "Esperar",
};

export const EMPTY_STEP: SequenceStep = { type: "task", wait_days: 1, subject: "Follow-up" };
