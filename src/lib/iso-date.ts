/**
 * Datas de calendário ("YYYY-MM-DD") ⇄ `Date` LOCAL, sem fuso.
 *
 * Regras (ver docs/architecture/date-fields.md):
 * - Nunca `new Date("YYYY-MM-DD")` (é UTC e volta um dia em UTC-3) nem
 *   `toISOString().slice(0, 10)` (avança um dia à noite em UTC-3).
 * - Datas impossíveis (31/02, 29/02 fora de bissexto, mês 13) são recusadas,
 *   nunca normalizadas em silêncio para outro dia.
 * - Só a forma exata "YYYY-MM-DD" é aceita; carimbo de data-hora não é
 *   reinterpretado como dia (seria trocar o dia conforme o fuso).
 */
import { startOfDay } from "date-fns";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `Date` local (meia-noite) ou `null` quando vazio, mal formado ou impossível. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = ISO_DAY.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  // Ano 0–99 é tratado como 1900+ pelo construtor: corrige.
  if (y < 100) date.setFullYear(y);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** "YYYY-MM-DD" com os componentes LOCAIS da data. */
export function formatIsoDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidIsoDate(value: string | null | undefined): boolean {
  return parseIsoDate(value) !== null;
}

/** Hoje em "YYYY-MM-DD" local. */
export function todayIsoDate(now: Date = new Date()): string {
  return formatIsoDate(now);
}

export type DayBounds = { min?: Date | null; max?: Date | null };

/** O dia está dentro dos limites (inclusivos, comparando só o dia)? */
export function isDayWithin(date: Date, { min, max }: DayBounds): boolean {
  const t = startOfDay(date).getTime();
  if (min && t < startOfDay(min).getTime()) return false;
  if (max && t > startOfDay(max).getTime()) return false;
  return true;
}
