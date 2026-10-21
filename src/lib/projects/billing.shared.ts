// TechProjects Ciclo 4 — rótulos e utilitários puros de tarifas, medições e rentabilidade.
// Nada aqui calcula valores cobrados: o banco é a fonte (numeric, segundos exatos, arredondamento definido).
// Estas funções só apresentam, validam entrada da tela e montam exportações a partir do que o servidor autorizou.

export const BILLING_MODELS = [
  "per_hour",
  "fixed_recurring",
  "package",
  "milestone",
  "percent",
] as const;
export type BillingModel = (typeof BILLING_MODELS)[number];

export const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  per_hour: "Por hora (tempo aprovado)",
  fixed_recurring: "Mensalidade / preço fixo",
  package: "Pacote / franquia com excedente",
  milestone: "Marcos / entregáveis",
  percent: "Percentual / sucesso (Hunting)",
};

export type MeasurementStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "ready"
  | "generated"
  | "failed"
  | "reversed"
  | "cancelled";

export const MEASUREMENT_STATUS_LABEL: Record<MeasurementStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada (com pendência para o Financeiro)",
  ready: "Pronta para o Financeiro",
  generated: "Gerada no Financeiro",
  failed: "Falha ao gerar",
  reversed: "Estornada",
  cancelled: "Cancelada",
};

/** Situação → variante do Badge (sem cores avulsas). */
export function measurementStatusVariant(
  s: MeasurementStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (s === "generated" || s === "ready") return "default";
  if (s === "failed") return "destructive";
  if (s === "reversed" || s === "cancelled") return "outline";
  return "secondary";
}

/** Códigos de pendência/aviso devolvidos pelo banco → texto em PT-BR. */
export const ISSUE_LABEL: Record<string, string> = {
  rate_missing: "Sem tarifa vigente (valor desconhecido)",
  rate_ambiguous: "Mais de uma tarifa no mesmo nível (ambígua)",
  amount_missing: "Valor não definido",
  start_unknown: "Início do serviço/contrato não informado",
  cadence_unsupported: "Periodicidade do serviço não é mensal",
  service_inactive: "Serviço pausado ou cancelado",
  previous_period_unmeasured: "Mês anterior do pacote sem medição aprovada",
  contract_not_provider: "Contrato não é de prestação",
  no_included_lines: "Nada elegível na competência",
  legacy_entry_exists: "Já existe título legado do serviço na competência",
  client_acceptance_missing: "Horas sem aceite do cliente (exigido no contrato)",
  zero_total: "Valor total zero ou negativo",
  rejected: "Devolvidas",
  imported_locked: "Importadas bloqueadas (histórico, não cobradas)",
  not_billable: "Não faturáveis",
  not_approved: "Ainda não aprovadas",
  not_closed: "Aprovadas sem competência fechada",
  already_billed: "Já cobradas por outro mecanismo",
  already_measured: "Já em outra medição",
  zero_duration: "Duração zero",
  inactive_in_period: "Fora da vigência no mês",
  legacy_project_entries: "Títulos legados de projetos do contrato no mês",
};

export function issueLabel(code: string): string {
  const key = code.startsWith("excluded:") ? code.slice(9) : code;
  return ISSUE_LABEL[key] ?? key;
}

export const RATE_SCOPE_LABEL: Record<string, string> = {
  exception: "Exceção (projeto + pessoa)",
  allocation: "Alocação",
  service: "Serviço contratado",
  person: "Pessoa",
  catalog: "Padrão do catálogo",
};

/** Precedência declarada no banco (`project_rate_pick`), exibida na tela. */
export const RATE_PRECEDENCE = [
  "Custo mensal da alocação/pessoa (não convertido em hora)",
  "Exceção confirmada (projeto + pessoa)",
  "Alocação",
  "Serviço contratado",
  "Pessoa",
  "Padrão do catálogo",
] as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-08" → { from: "2026-08-01", to: "2026-08-31" } (competência em mês civil). */
export function monthBounds(month: string): { from: string; to: string } {
  if (!MONTH_RE.test(month)) throw new Error("Competência inválida (use AAAA-MM).");
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Intervalo de meses completos para a rentabilidade (até 12). */
export function monthRangeBounds(fromMonth: string, toMonth: string): { from: string; to: string } {
  const a = monthBounds(fromMonth);
  const b = monthBounds(toMonth);
  if (b.to < a.from) throw new Error("O mês final é anterior ao inicial.");
  const [ya, ma] = fromMonth.split("-").map(Number);
  const [yb, mb] = toMonth.split("-").map(Number);
  if ((yb - ya) * 12 + (mb - ma) > 11) throw new Error("Período de até 12 meses.");
  return { from: a.from, to: b.to };
}

/** Valor monetário vindo do banco: null = desconhecido (nunca vira 0). */
export function formatMoney(v: number | string | null | undefined, currency = "BRL"): string {
  if (v === null || v === undefined || v === "") return "desconhecido";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "desconhecido";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Percentual do banco: null = não aplicável/desconhecido. */
export function formatPct(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "n/a";
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "n/a";
}

/** Parse de valor digitado (pt-BR ou ponto) sem perder casas; "" → null (ausente ≠ zero). */
export function parseMoneyInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^-?\d+(\.\d{1,6})?$/.test(normalized)) throw new Error("Valor inválido.");
  return Number(normalized);
}

/** Horas digitadas (ex.: 40 ou 1:30) → segundos inteiros. */
export function hoursToSeconds(raw: string): number {
  const s = raw.trim();
  const hm = /^(\d+):([0-5]\d)$/.exec(s);
  if (hm) return Number(hm[1]) * 3600 + Number(hm[2]) * 60;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new Error("Informe as horas (ex.: 40 ou 1:30).");
  return Math.round(n * 3600);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (separador ;) apenas com os campos que o servidor devolveu ao usuário. */
export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: Array<[string, string]>,
): string {
  const head = columns.map(([, label]) => csvCell(label)).join(";");
  const body = rows.map((r) => columns.map(([k]) => csvCell(r[k])).join(";"));
  return [head, ...body].join("\n");
}
