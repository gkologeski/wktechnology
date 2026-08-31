// Datas compactas para cards de Kanban.
// Reduz "31 de Ago de 2026 21:00 GMT-3" para "Hoje às 21h", sem diminuir a fonte.
// As demais telas continuam usando `formatDate`/`formatDateTime` de `@/lib/crm`.

const BR_TZ = "America/Sao_Paulo";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BR_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function brParts(date: Date): Parts {
  const parts = partsFormatter.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Intl com hour12:false pode devolver 24 para meia-noite em alguns runtimes.
    hour: hour === 24 ? 0 : hour,
    minute: get("minute"),
  };
}

function dayIndex(p: Pick<Parts, "year" | "month" | "day">): number {
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

const RELATIVE_DAYS: Record<number, string> = {
  0: "Hoje",
  [-1]: "Ontem",
  [-2]: "Anteontem",
  1: "Amanhã",
  2: "Depois de amanhã",
};

function formatTime(hour: number, minute: number): string {
  return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, "0")}min`;
}

function formatDayLabel(target: Parts, today: Parts): string {
  const diff = dayIndex(target) - dayIndex(today);
  const relative = RELATIVE_DAYS[diff];
  if (relative) return relative;
  const month = MONTHS[target.month - 1] ?? String(target.month);
  const day = String(target.day).padStart(2, "0");
  if (target.year === today.year) return `${day}/${month}`;
  return `${day}/${month}/${String(target.year).slice(-2)}`;
}

/** Data-only (`YYYY-MM-DD`) parseada sem shift de fuso. */
function parseDateOnly(value: string): Parts | null {
  const m = DATE_ONLY_RE.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = value.trim().split("-").map(Number);
  if (!y || !mo || !d) return null;
  return { year: y, month: mo, day: d, hour: 0, minute: 0 };
}

/**
 * Formato compacto para cards: "Hoje às 21h", "Ontem às 21h", "14/Jan às 9h15min",
 * "14/Jan/27 às 9h15min". Valores só-data omitem a hora.
 * Retorna `fallback` quando o valor é vazio ou inválido.
 */
export function formatCompactDateTime(value?: string | null, fallback = "—", now?: Date): string {
  if (!value) return fallback;
  const today = brParts(now ?? new Date());
  try {
    const dateOnly = typeof value === "string" ? parseDateOnly(value) : null;
    if (dateOnly) return formatDayLabel(dateOnly, today);

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return fallback;
    const p = brParts(d);
    return `${formatDayLabel(p, today)} às ${formatTime(p.hour, p.minute)}`;
  } catch {
    return fallback;
  }
}

/** Igual a `formatCompactDateTime`, mas sempre sem a parte de hora. */
export function formatCompactDate(value?: string | null, fallback = "—", now?: Date): string {
  if (!value) return fallback;
  const today = brParts(now ?? new Date());
  try {
    const dateOnly = typeof value === "string" ? parseDateOnly(value) : null;
    if (dateOnly) return formatDayLabel(dateOnly, today);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return fallback;
    return formatDayLabel(brParts(d), today);
  } catch {
    return fallback;
  }
}
