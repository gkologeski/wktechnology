// Modelo de cobrança compartilhado entre catálogo de serviços, itens de linha do
// negócio, itens da cotação e serviços do contrato. Módulo puro (sem I/O) para
// que negócio, cotação e contrato calculem e exibam a cobrança do mesmo jeito.

export type BillingModel =
  | "per_unit"
  | "per_hour"
  | "per_headcount_month"
  | "percent_of_base"
  | "fixed";

export const BILLING_MODELS: BillingModel[] = [
  "per_unit",
  "per_hour",
  "per_headcount_month",
  "percent_of_base",
  "fixed",
];

export const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  per_unit: "Por unidade contratada",
  per_hour: "Por hora prestada",
  per_headcount_month: "Por headcount/mês",
  percent_of_base: "Percentual de uma base",
  fixed: "Valor fixo",
};

/** Unidade padrão sugerida para cada forma de cobrança. */
export const BILLING_MODEL_DEFAULT_UNIT: Record<BillingModel, string> = {
  per_unit: "unit",
  per_hour: "hour",
  per_headcount_month: "headcount",
  percent_of_base: "unit",
  fixed: "month",
};

export const UNIT_LABEL: Record<string, string> = {
  hour: "hora",
  hora: "hora",
  unit: "unidade",
  unidade: "unidade",
  vacancy: "vaga",
  vaga: "vaga",
  headcount: "headcount",
  month: "mês",
  mes: "mês",
  day: "dia",
  project: "projeto",
};

export const CADENCE_LABEL: Record<string, string> = {
  one_time: "Único",
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
  on_delivery: "Na entrega",
};

export const CADENCE_OPTIONS = Object.keys(CADENCE_LABEL);

export function unitLabel(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase();
  return UNIT_LABEL[key] ?? unit;
}

export function cadenceLabel(cadence: string | null | undefined): string | null {
  if (!cadence) return null;
  return CADENCE_LABEL[cadence] ?? cadence;
}

export function isBillingModel(v: unknown): v is BillingModel {
  return typeof v === "string" && (BILLING_MODELS as string[]).includes(v);
}

/** A forma de cobrança exige base de cálculo + percentual? */
export function usesPercent(model: BillingModel | null | undefined): boolean {
  return model === "percent_of_base";
}

/** A forma de cobrança exige quantidade editável? */
export function usesQuantity(model: BillingModel | null | undefined): boolean {
  return model !== "fixed";
}

export type BillingInput = {
  billing_model?: BillingModel | string | null;
  quantity?: number | null;
  unit_price?: number | null;
  percent?: number | null;
  percent_base_amount?: number | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Valor bruto da linha antes de desconto e imposto.
 * - `percent_of_base`: quantidade × (base × percentual)
 * - `fixed`: apenas o valor unitário
 * - demais: quantidade × valor unitário
 */
export function computeBillingAmount(input: BillingInput): number {
  const model = isBillingModel(input.billing_model) ? input.billing_model : "per_unit";
  const price = num(input.unit_price);
  if (model === "fixed") return round2(price);
  const qty = num(input.quantity) || 0;
  if (model === "percent_of_base") {
    const base = num(input.percent_base_amount);
    const pct = num(input.percent);
    return round2(qty * base * (pct / 100));
  }
  return round2(qty * price);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Descrição legível da cobrança: "R$ 250,00/hora × 160", "100% do salário alvo
 * por vaga", "R$ 8.000,00 fixo/mês".
 */
export function describeBilling(
  input: BillingInput & {
    unit?: string | null;
    cadence?: string | null;
    percent_base_label?: string | null;
  },
  formatMoney: (v: number) => string,
): string {
  const model = isBillingModel(input.billing_model) ? input.billing_model : "per_unit";
  const unit = unitLabel(input.unit);
  const cadence = cadenceLabel(input.cadence);
  const qty = num(input.quantity);
  const parts: string[] = [];

  if (model === "percent_of_base") {
    const base = input.percent_base_label?.trim() || "base";
    parts.push(`${num(input.percent)}% de ${base}`);
    if (unit) parts.push(`por ${unit}`);
    if (qty) parts.push(`× ${qty}`);
  } else if (model === "fixed") {
    parts.push(`${formatMoney(num(input.unit_price))} fixo`);
  } else {
    const price = formatMoney(num(input.unit_price));
    parts.push(unit ? `${price}/${unit}` : price);
    if (qty) parts.push(`× ${qty}`);
  }
  if (cadence) parts.push(`(${cadence.toLowerCase()})`);
  return parts.join(" ");
}
