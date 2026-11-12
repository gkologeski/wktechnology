// Regra pura do agendamento da importação contínua (Clockify, Jibble, ClickUp).
export type ImportFrequency = "hourly" | "every_6h" | "every_12h" | "daily" | "weekly";
export type ImportProvider = "clockify" | "jibble" | "clickup";
export type ScheduleInput = {
  frequency: ImportFrequency;
  runHour: number; // 0..23 no fuso indicado
  runWeekday: number; // 0 = domingo
  timeZone: string;
};

export const FREQUENCY_LABELS: Record<ImportFrequency, string> = {
  hourly: "A cada 1 hora",
  every_6h: "A cada 6 horas",
  every_12h: "A cada 12 horas",
  daily: "Diariamente",
  weekly: "Semanalmente",
};
export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
/** Provedores cuja execução automática já existe no servidor. */
export const AUTO_PROVIDERS: ImportProvider[] = ["clockify", "jibble", "clickup"];

function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** Próxima execução estritamente depois de `from`. */
export function nextRunAt(s: ScheduleInput, from: Date): Date {
  const stepH = { hourly: 1, every_6h: 6, every_12h: 12 } as const;
  if (s.frequency in stepH) {
    const step = stepH[s.frequency as keyof typeof stepH] * 3600_000;
    return new Date((Math.floor(from.getTime() / step) + 1) * step);
  }
  const hour = Math.min(23, Math.max(0, Math.trunc(s.runHour)));
  const off = offsetMinutes(from, s.timeZone);
  const local = new Date(from.getTime() + off * 60000); // relógio local em campos UTC
  for (let d = 0; d <= 8; d++) {
    const cand = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + d, hour, 0),
    );
    if (s.frequency === "weekly" && cand.getUTCDay() !== s.runWeekday) continue;
    const utc = new Date(cand.getTime() - offsetMinutes(cand, s.timeZone) * 60000);
    if (utc.getTime() > from.getTime()) return utc;
  }
  throw new Error("Agenda inválida.");
}
