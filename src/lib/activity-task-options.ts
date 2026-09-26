// Opções de tarefas/atividades no padrão HubSpot (rótulos PT-BR, valores estáveis).
export const TASK_TYPES = [
  { value: "todo", label: "Tarefas" },
  { value: "call", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meeting", label: "Reunião" },
] as const;

export const TASK_PRIORITIES = [
  { value: "none", label: "Nenhuma" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
] as const;

export const TASK_STATUSES = [
  { value: "not_started", label: "Não iniciada" },
  { value: "in_progress", label: "Em andamento" },
  { value: "waiting", label: "Aguardando" },
  { value: "deferred", label: "Adiada" },
  { value: "completed", label: "Concluída" },
] as const;

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  ends: "never" | "on_date" | "after";
  end_date?: string | null;
  count?: number | null;
  occurrence?: number;
};

export const RECURRENCE_FREQUENCIES: { value: RecurrenceFrequency; label: string; unit: string }[] =
  [
    { value: "daily", label: "Diariamente", unit: "dia(s)" },
    { value: "weekly", label: "Semanalmente", unit: "semana(s)" },
    { value: "monthly", label: "Mensalmente", unit: "mês(es)" },
    { value: "quarterly", label: "Trimestralmente", unit: "trimestre(s)" },
    { value: "yearly", label: "Anualmente", unit: "ano(s)" },
  ];

export function labelOf(list: readonly { value: string; label: string }[], v: string | null | undefined) {
  return list.find((o) => o.value === v)?.label ?? null;
}

/** Próxima ocorrência — espelha a função de banco `activities_spawn_recurrence`. */
export function nextOccurrence(rule: RecurrenceRule, from: Date): Date | null {
  const n = Math.max(1, Math.floor(rule.interval || 1));
  const d = new Date(from);
  switch (rule.frequency) {
    case "daily":
      d.setDate(d.getDate() + n);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * n);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + n);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3 * n);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + n);
      break;
  }
  if (rule.ends === "on_date" && rule.end_date && d > new Date(`${rule.end_date}T23:59:59`)) return null;
  if (rule.ends === "after" && (rule.occurrence ?? 1) >= (rule.count ?? 1)) return null;
  return d;
}

export function describeRecurrence(rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null;
  const f = RECURRENCE_FREQUENCIES.find((x) => x.value === rule.frequency);
  if (!f) return null;
  const base = rule.interval > 1 ? `A cada ${rule.interval} ${f.unit}` : f.label;
  if (rule.ends === "on_date" && rule.end_date)
    return `${base}, até ${rule.end_date.split("-").reverse().join("/")}`;
  if (rule.ends === "after" && rule.count) return `${base}, ${rule.count} vezes`;
  return base;
}

function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export const FOLLOW_UP_PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "bd2", label: "Em 2 dias úteis" },
  { value: "bd3", label: "Em 3 dias úteis" },
  { value: "w1", label: "Em 1 semana" },
  { value: "w2", label: "Em 2 semanas" },
  { value: "m1", label: "Em 1 mês" },
  { value: "custom", label: "Data personalizada" },
] as const;
export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number]["value"];

/** Data de vencimento (08:00 local) para o atalho escolhido. */
export function followUpDate(preset: FollowUpPreset, now = new Date(), custom?: string): Date | null {
  let d: Date;
  switch (preset) {
    case "today":
      d = new Date(now);
      break;
    case "tomorrow":
      d = new Date(now);
      d.setDate(d.getDate() + 1);
      break;
    case "bd2":
      d = addBusinessDays(now, 2);
      break;
    case "bd3":
      d = addBusinessDays(now, 3);
      break;
    case "w1":
      d = new Date(now);
      d.setDate(d.getDate() + 7);
      break;
    case "w2":
      d = new Date(now);
      d.setDate(d.getDate() + 14);
      break;
    case "m1":
      d = new Date(now);
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      if (!custom) return null;
      return new Date(custom);
  }
  d.setHours(8, 0, 0, 0);
  return d;
}

export function followUpLabel(preset: FollowUpPreset, now = new Date()): string {
  const base = FOLLOW_UP_PRESETS.find((p) => p.value === preset)?.label ?? "";
  const d = followUpDate(preset, now);
  if (!d || preset === "custom") return base;
  const wd = d.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${base} (${wd.charAt(0).toUpperCase()}${wd.slice(1)})`;
}
