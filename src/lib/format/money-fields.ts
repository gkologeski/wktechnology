// Fonte única de verdade para identificar e formatar campos monetários.
// Usada pelo painel de propriedades, pelo catálogo genérico de campos e pelas
// propriedades personalizadas, para que dinheiro apareça sempre formatado.
import { formatCurrency } from "@/lib/crm";

/** Sufixos/nomes que NÃO são dinheiro, mesmo que casem com as regras abaixo. */
const NOT_MONEY = new Set([
  "value_type",
  "amount_type",
  "currency",
  "moeda",
  "payment_day",
  "hours_per_month",
  "notice_days",
  "confidence",
  "import_confidence",
  "score",
  "quantity",
  "qty",
  "count",
  "position",
  "order",
  "sort_order",
  "probability",
  "weight",
  "duration_minutes",
  "rate_limit",
  "exchange_rate",
  "conversion_rate",
  "win_rate",
  "open_rate",
  "click_rate",
  "bounce_rate",
  "reply_rate",
  "response_rate",
  "utilization_rate",
  "churn_rate",
  // Contadores e placares que terminam em radicais monetários.
  "total_score",
  "total_cycles",
  "total_count",
  "total_sent",
  "total_items",
]);

/**
 * Radicais monetários usados quando a chave não tem separador
 * (ex.: `annualrevenue`, `dealamount`, `hs_arr` vindos do HubSpot).
 */
const MONEY_ROOTS = [
  "revenue",
  "amount",
  "value",
  "price",
  "cost",
  "fee",
  "salary",
  "budget",
  "mrr",
  "arr",
  "acv",
  "tcv",
];

/** Nomes exatos considerados monetários. */
const MONEY_EXACT = new Set([
  "value",
  "amount",
  "budget",
  "price",
  "cost",
  "fee",
  "salary",
  "revenue",
  "mrr",
  "arr",
  "total",
  "subtotal",
  "balance",
  "credit",
  "debit",
]);

/** Sufixos monetários. */
const MONEY_SUFFIXES = [
  "_value",
  "_amount",
  "_price",
  "_cost",
  "_fee",
  "_salary",
  "_revenue",
  "_budget",
  "_total",
  "_subtotal",
  "_balance",
  "_mrr",
  "_arr",
  "_rate", // hourly_rate, daily_rate… (percentuais estão em NOT_MONEY)
];

/** Prefixos monetários (ex.: salary_amount já cai no sufixo; salary_min/max não). */
const MONEY_PREFIXES = ["salary_", "price_", "cost_", "budget_", "value_", "amount_"];

/**
 * Heurística de campo monetário por convenção de nome.
 * Percentuais, dias, contagens e taxas de conversão são explicitamente excluídos.
 */
export function isMoneyField(key: string): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  if (NOT_MONEY.has(k)) return false;
  // Qualquer coisa percentual nunca é moeda.
  if (k.includes("percent") || k.endsWith("_pct") || k.endsWith("_days") || k.endsWith("_months"))
    return false;
  if (MONEY_EXACT.has(k)) return true;
  if (MONEY_SUFFIXES.some((s) => k.endsWith(s))) return true;
  if (MONEY_PREFIXES.some((p) => k.startsWith(p))) return true;
  // Chaves colapsadas (sem separador), ex.: annualrevenue, dealamount, hs_arr.
  const collapsed = k.replace(/[_-]/g, "");
  if (collapsed !== k && MONEY_ROOTS.some((r) => collapsed.endsWith(r))) return true;
  if (MONEY_ROOTS.some((r) => k.endsWith(r) && k.length > r.length && !k.includes("_")))
    return true;
  return false;
}

/** Extrai o código de moeda do próprio registro, com fallback BRL. */
export function resolveCurrency(row?: Record<string, unknown> | null, fallback = "BRL"): string {
  const c = row?.["currency"];
  return typeof c === "string" && c.trim().length === 3 ? c.toUpperCase() : fallback;
}

/** Formata um valor monetário; retorna null quando não há número válido. */
export function formatMoney(raw: unknown, currency = "BRL"): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return formatCurrency(n, currency);
}
