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
  { value: "survey", label: "Pesquisa" },
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

const BR_TZ = "America/Sao_Paulo";

function capitalizeMonth(s: string) {
  // Remove trailing dot from abbreviated month and capitalize first letter
  return s.replace(/\.$/, "").replace(/^\p{L}/u, (c) => c.toUpperCase());
}

function formatBrParts(date: Date, withTime: boolean) {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: BR_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  if (withTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
    opts.hour12 = false;
    opts.timeZoneName = "shortOffset";
  }
  const parts = new Intl.DateTimeFormat("pt-BR", opts).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("day");
  const month = capitalizeMonth(get("month"));
  const year = get("year");
  let out = `${day} de ${month} de ${year}`;
  if (withTime) {
    const hour = get("hour");
    const minute = get("minute");
    // shortOffset returns e.g. "GMT-3" — normalize "GMT-03" → "GMT-3"
    const tz = get("timeZoneName").replace(/GMT([+-])0?(\d+)/, "GMT$1$2");
    out += ` ${hour}:${minute} ${tz}`;
  }
  return out;
}

export function formatDate(d?: string | null) {
  return formatDateTime(d);
}

export function formatDateOnly(d?: string | null) {
  if (!d) return "—";
  try {
    // Para datas no formato YYYY-MM-DD evita shift de timezone
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d).trim());
    const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: m ? undefined : BR_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
}

export function formatDateTime(d?: string | null) {
  if (!d) return "—";
  try {
    return formatBrParts(new Date(d), true);
  } catch {
    return "—";
  }
}
