// DADOS-CONTRATO: padrões das condições contratuais e regras puras de preenchimento.
// Client-safe (sem I/O).

export const DEFAULT_VALIDITY_DAYS = 90;
export const DEFAULT_PENALTY_PERCENT = 2;
export const DEFAULT_JURISDICTION = "Florianópolis-SC";
export const DEFAULT_GOVERNING_LAW = "Legislação da República Federativa do Brasil";

/** Converte texto em inteiro dentro do intervalo; vazio/ inválido vira null. */
export function clampInt(raw: string, min: number, max: number): number | null {
  if (raw.trim() === "") return null;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Fim da vigência (YYYY-MM-DD) a partir do início e dos dias de vigência. */
export function endFromValidity(startIso: string, days: number): string {
  const d = new Date(`${startIso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Valor manual prevalece; senão o do modelo; senão o padrão. */
export function pickTerm<T>(
  manual: T | null | undefined,
  template: T | null | undefined,
  fallback: T,
): T {
  if (manual != null && manual !== "") return manual;
  if (template != null && template !== "") return template;
  return fallback;
}

/** Endereço vazio é completado pela consulta do CNPJ; endereço manual nunca é sobrescrito. */
export function shouldAutofillAddress(current: unknown): boolean {
  if (current == null) return true;
  if (typeof current === "string") return current.trim() === "";
  if (typeof current === "object") return Object.keys(current as object).length === 0;
  return false;
}
