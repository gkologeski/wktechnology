export const DEAL_STAGES = [
  { value: "new", label: "Novo" },
  { value: "qualified", label: "Qualificado" },
  { value: "proposal", label: "Proposta" },
  { value: "negotiation", label: "Negociação" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["value"];

export const LEAD_STATUSES = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contatado" },
  { value: "qualified", label: "Qualificado" },
  { value: "disqualified", label: "Desqualificado" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export const ACTIVITY_TYPES = [
  { value: "note", label: "Nota" },
  { value: "task", label: "Tarefa" },
  { value: "call", label: "Ligação" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Reunião" },
  { value: "sms", label: "SMS" },
  { value: "postal_mail", label: "Correio Postal" },
  { value: "linkedin_message", label: "LinkedIn" },
  { value: "whatsapp", label: "WhatsApp" },
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number]["value"];

// HubSpot task statuses (used in tasks kanban board)
export const TASK_STATUSES = [
  { value: "NOT_STARTED", label: "Não iniciada" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "WAITING", label: "Aguardando" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "DEFERRED", label: "Adiada" },
] as const;

export const TASK_PRIORITIES = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
] as const;

export function formatCurrency(v: number, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v ?? 0);
  } catch {
    return `${currency} ${(v ?? 0).toFixed(2)}`;
  }
}

export function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(d));
  } catch {
    return "—";
  }
}

export function formatDateTime(d?: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
  } catch {
    return "—";
  }
}
