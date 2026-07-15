export type TicketStatus = "new" | "open" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketRow = {
  id: string;
  owner_id: string;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  source: string | null;
  assignee_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  pipeline_id: string | null;
  stage: string;
  due_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  external_ids?: Record<string, unknown> | null;
};

export const STATUSES = [
  { value: "new", label: "Novo" },
  { value: "open", label: "Em atendimento" },
  { value: "waiting", label: "Aguardando cliente" },
  { value: "resolved", label: "Resolvido" },
  { value: "closed", label: "Fechado" },
] as const;

export const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
] as const;

export const PRIORITY_COLOR_VAR: Record<TicketPriority, string> = {
  low: "var(--priority-low)",
  medium: "var(--priority-medium)",
  high: "var(--priority-high)",
  urgent: "var(--priority-urgent)",
};
