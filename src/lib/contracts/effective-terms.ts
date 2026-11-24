// Condições vigentes de um contrato principal considerando seus aditivos ativos.
// Regra: aditivos são lidos em ordem de vigência; cada campo informado no aditivo
// e diferente do vigente substitui o valor anterior (inclusive prazo MENOR).
// Valor e horas contratadas são acumulados (cada aditivo traz o próprio pacote).
export type TermsRow = {
  id: string;
  number?: string | null;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  total_value?: number | string | null;
  monthly_value?: number | string | null;
  hours_per_month?: number | null;
  notice_days?: number | null;
  service_scope?: string | null;
  contracted_hours?: number | null;
  amendment_effective_at?: string | null;
};

export type TermField = "starts_at" | "ends_at" | "monthly_value" | "hours_per_month" | "notice_days" | "service_scope";
export type TermChange = { field: TermField; from: string | number | null; to: string | number | null; amendmentId: string; amendmentNumber: string | null };

export const EFFECTIVE_AMENDMENT_STATUSES = ["active", "renewing", "ended"];
// O início do aditivo é a data em que ele passa a valer, não um novo início do contrato.
const REPLACED: TermField[] = ["ends_at", "monthly_value", "hours_per_month", "notice_days", "service_scope"];

const norm = (f: TermField, v: unknown): string | number | null => {
  if (v == null || v === "") return null;
  if (f === "starts_at" || f === "ends_at") return String(v).slice(0, 10);
  if (f === "service_scope") return String(v).trim() || null;
  return Number(v);
};

export function effectiveTerms(main: TermsRow, amendments: TermsRow[]) {
  const applied = amendments
    .filter((a) => EFFECTIVE_AMENDMENT_STATUSES.includes(a.status ?? ""))
    .sort((a, b) =>
      String(a.amendment_effective_at ?? a.starts_at ?? "").localeCompare(
        String(b.amendment_effective_at ?? b.starts_at ?? ""),
      ),
    );
  const current = {} as Record<TermField, string | number | null>;
  current.starts_at = norm("starts_at", main.starts_at);
  for (const f of REPLACED) current[f] = norm(f, main[f]);
  const changes: TermChange[] = [];
  let totalValue = Number(main.total_value ?? 0);
  let hours = main.contracted_hours ?? null;
  for (const a of applied) {
    for (const f of REPLACED) {
      const v = norm(f, a[f]);
      if (v != null && v !== current[f]) {
        changes.push({ field: f, from: current[f], to: v, amendmentId: a.id, amendmentNumber: a.number ?? null });
        current[f] = v;
      }
    }
    totalValue += Number(a.total_value ?? 0);
    if (a.contracted_hours != null) hours = (hours ?? 0) + a.contracted_hours;
  }
  return {
    starts_at: current.starts_at as string | null,
    ends_at: current.ends_at as string | null,
    monthly_value: current.monthly_value as number | null,
    hours_per_month: current.hours_per_month as number | null,
    notice_days: current.notice_days as number | null,
    service_scope: current.service_scope as string | null,
    total_value: totalValue,
    contracted_hours: hours,
    applied: applied.map((a) => a.id),
    changes,
  };
}
