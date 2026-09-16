// Converte os campos extras de contrato preenchidos no workflow depois que os
// tokens já foram resolvidos: números podem chegar como texto formatado em real
// ("R$ 3.200,00") e datas como texto ISO ou "dd/MM/yyyy".

const NUMERIC_FIELDS = new Set([
  "total_value",
  "monthly_value",
  "hours_per_month",
  "late_fee_percent",
  "late_interest_monthly_percent",
  "penalty_percent",
]);

const INTEGER_FIELDS = new Set([
  "payment_day",
  "notice_days",
  "trial_period_days",
  "expense_reimbursement_days",
  "cure_period_days",
  "unilateral_termination_notice_days",
  "confidentiality_term_months",
  "amendment_number",
]);

const DATE_FIELDS = new Set(["starts_at", "ends_at", "amendment_effective_at"]);

/** "R$ 3.200,50" | "3200.5" | "1.234" → number | null */
export function parseBrNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[^\d,.-]/g, "").trim();
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Formato pt-BR: ponto é separador de milhar, vírgula é decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // Só pontos, em grupos de 3 → separador de milhar.
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Texto de data (ISO ou dd/MM/yyyy) → ISO. */
export function parseDateValue(raw: unknown): string | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type CoercedFields = {
  values: Record<string, unknown>;
  /** Campos descartados por não converterem — vão para o log da execução. */
  warnings: string[];
};

/**
 * Converte os valores já resolvidos para os tipos das colunas de contrato.
 * Valores que não convertem são descartados (o campo fica com o padrão) e
 * registrados em `warnings`, sem interromper o workflow.
 */
export function coerceContractFields(extra: Record<string, unknown> | undefined): CoercedFields {
  const values: Record<string, unknown> = {};
  const warnings: string[] = [];
  if (!extra) return { values, warnings };

  for (const [key, raw] of Object.entries(extra)) {
    if (raw === null || raw === undefined || raw === "") continue;

    if (NUMERIC_FIELDS.has(key) || INTEGER_FIELDS.has(key)) {
      const n = parseBrNumber(raw);
      if (n === null) {
        warnings.push(`${key}: valor não numérico ("${String(raw)}") — campo ignorado.`);
        continue;
      }
      values[key] = INTEGER_FIELDS.has(key) ? Math.round(n) : n;
      continue;
    }

    if (DATE_FIELDS.has(key)) {
      const iso = parseDateValue(raw);
      if (!iso) {
        warnings.push(`${key}: data inválida ("${String(raw)}") — campo ignorado.`);
        continue;
      }
      values[key] = iso;
      continue;
    }

    values[key] = raw;
  }

  return { values, warnings };
}
