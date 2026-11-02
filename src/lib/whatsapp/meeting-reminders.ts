// Regras puras dos lembretes de reunião por WhatsApp (sem acesso a banco).

export const REMINDER_OFFSETS = [
  { minutes: 1440, label: "24 horas antes" },
  { minutes: 180, label: "3 horas antes" },
  { minutes: 60, label: "1 hora antes" },
  { minutes: 5, label: "5 minutos antes" },
] as const;

export type ReminderOffset = (typeof REMINDER_OFFSETS)[number]["minutes"];
export const REMINDER_OFFSET_VALUES = REMINDER_OFFSETS.map((o) => o.minutes) as number[];

export const REMINDER_VARIABLES = [
  { key: "first_name", label: "Primeiro nome do cliente" },
  { key: "meeting_date", label: "Data da reunião (dd/mm/aaaa)" },
  { key: "meeting_time", label: "Hora da reunião (hh:mm)" },
  { key: "meeting_link", label: "Local ou link da reunião" },
  { key: "owner_name", label: "Nome do responsável" },
  { key: "subject", label: "Assunto da reunião" },
] as const;
export type ReminderVariableKey = (typeof REMINDER_VARIABLES)[number]["key"];
export const REMINDER_VARIABLE_KEYS = REMINDER_VARIABLES.map((v) => v.key) as string[];

/** Atraso máximo aceito após o horário previsto do lembrete. */
export const LATE_TOLERANCE_MS = 10 * 60_000;

export type OffsetUnit = "minutes" | "hours" | "days";
export const OFFSET_UNITS: { value: OffsetUnit; label: string; minutes: number }[] = [
  { value: "minutes", label: "minutos", minutes: 1 },
  { value: "hours", label: "horas", minutes: 60 },
  { value: "days", label: "dias", minutes: 1440 },
];
export const MIN_OFFSET_MINUTES = 1;
export const MAX_OFFSET_MINUTES = 30 * 1440;
export const MAX_REMINDER_RULES = 10;

export function toMinutes(amount: number, unit: OffsetUnit): number {
  return Math.round(amount) * (OFFSET_UNITS.find((u) => u.value === unit)?.minutes ?? 1);
}

/** Melhor unidade para reexibir um tempo salvo em minutos. */
export function fromMinutes(minutes: number, unit?: OffsetUnit): { amount: number; unit: OffsetUnit } {
  const u =
    unit && minutes % (OFFSET_UNITS.find((x) => x.value === unit)?.minutes ?? 1) === 0
      ? unit
      : minutes % 1440 === 0
        ? "days"
        : minutes % 60 === 0
          ? "hours"
          : "minutes";
  return { amount: minutes / (OFFSET_UNITS.find((x) => x.value === u)?.minutes ?? 1), unit: u };
}

/** Erro de validação da lista de lembretes, ou null quando válida. */
export function validateOffsets(offsets: number[]): string | null {
  if (offsets.length > MAX_REMINDER_RULES) return `Use no máximo ${MAX_REMINDER_RULES} lembretes.`;
  for (const m of offsets)
    if (!Number.isInteger(m) || m < MIN_OFFSET_MINUTES || m > MAX_OFFSET_MINUTES)
      return "Cada lembrete deve ficar entre 1 minuto e 30 dias antes.";
  if (new Set(offsets).size !== offsets.length) return "Há dois lembretes com o mesmo tempo.";
  return null;
}

export function offsetLabel(minutes: number, unit?: OffsetUnit): string {
  const { amount, unit: u } = fromMinutes(minutes, unit);
  const names = { minutes: ["minuto", "minutos"], hours: ["hora", "horas"], days: ["dia", "dias"] };
  return `${amount} ${names[u][amount === 1 ? 0 : 1]} antes`;
}

/**
 * Lembretes que devem sair agora: horário previsto já chegou, ainda dentro da
 * tolerância de atraso e antes do início da reunião. Lembretes vencidos há mais
 * que a tolerância (reunião marcada em cima da hora) nunca saem.
 */
export function dueOffsets(meetingAtMs: number, nowMs: number, offsets: number[]): number[] {
  if (meetingAtMs <= nowMs) return [];
  return offsets.filter((m) => {
    const at = meetingAtMs - m * 60_000;
    return at <= nowMs && nowMs - at <= LATE_TOLERANCE_MS;
  });
}

export type ReminderContext = {
  firstName: string | null;
  meetingAt: Date;
  location: string | null;
  ownerName: string | null;
  subject: string | null;
  timeZone?: string;
};

export function resolveReminderValues(ctx: ReminderContext): Record<ReminderVariableKey, string> {
  const tz = ctx.timeZone ?? "America/Sao_Paulo";
  return {
    first_name: (ctx.firstName ?? "").trim().split(/\s+/)[0] ?? "",
    meeting_date: new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(ctx.meetingAt),
    meeting_time: new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(ctx.meetingAt),
    meeting_link: (ctx.location ?? "").trim(),
    owner_name: (ctx.ownerName ?? "").trim(),
    subject: (ctx.subject ?? "").trim(),
  };
}

/** Monta as variáveis posicionais; null quando alguma fica vazia (Meta rejeitaria). */
export function buildTemplateVariables(
  variableMap: string[],
  values: Record<string, string>,
): string[] | null {
  const out = variableMap.map((k) => (values[k] ?? "").trim());
  return out.some((v) => !v) ? null : out;
}

/** Quantidade de variáveis {{n}} no corpo do modelo. */
export function countTemplateVariables(components: unknown[]): number {
  const body = (components as { type?: string; text?: string }[]).find(
    (c) => String(c?.type).toUpperCase() === "BODY",
  );
  const nums = [...String(body?.text ?? "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

export function templateBodyText(components: unknown[]): string {
  const body = (components as { type?: string; text?: string }[]).find(
    (c) => String(c?.type).toUpperCase() === "BODY",
  );
  return String(body?.text ?? "");
}

/** Uma opção específica deve sair agora? (atalho de `dueOffsets`). */
export function isReminderDue(meetingAtMs: number, nowMs: number, offset: number): boolean {
  return dueOffsets(meetingAtMs, nowMs, [offset]).length > 0;
}
