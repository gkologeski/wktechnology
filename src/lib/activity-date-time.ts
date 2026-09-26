import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ActivityDateValueFormat = "local" | "iso" | "date";

export const ACTIVITY_TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

export function toLocalDateTimeValue(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalDateTimeValue(
  value: string,
  formatValue: ActivityDateValueFormat,
): string {
  if (!value) return "";
  if (formatValue === "local") return value;
  if (formatValue === "date") return value.slice(0, 10);
  return new Date(value).toISOString();
}

export function activityDatePart(value: string | null | undefined): string {
  return toLocalDateTimeValue(value).slice(0, 10);
}

export function activityTimePart(value: string | null | undefined, fallback = "08:00"): string {
  return toLocalDateTimeValue(value).slice(11, 16) || fallback;
}

export function combineActivityDateTime(date: string, time: string): string {
  return date ? `${date}T${time || "08:00"}` : "";
}

export function formatActivityDateLabel(value: string | null | undefined): string {
  const local = toLocalDateTimeValue(value);
  if (!local) return "Selecionar data";
  return format(new Date(`${local.slice(0, 10)}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

export function formatActivityPresetDate(date: Date): string {
  const weekday = format(date, "EEEE", { locale: ptBR });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}