// Bloco "Condições comerciais" da proposta (TEXTO-PROPOSTA).
// Delimitado pelo título "Condições comerciais" + lista seguinte (o editor
// remove atributos desconhecidos), regenerado sempre que as
// condições mudam no assistente sem tocar no restante do texto.

export const PROPOSAL_PAYMENT_METHODS = [
  "pix",
  "ted",
  "boleto",
  "transferencia",
  "outros",
] as const;
export type ProposalPaymentMethod = (typeof PROPOSAL_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<ProposalPaymentMethod, string> = {
  pix: "PIX",
  ted: "TED",
  boleto: "Boleto bancário",
  transferencia: "Transferência bancária",
  outros: "Outro",
};

import {
  buildPaymentSchedule,
  describePaymentTerms,
  validatePaymentTerms,
  type PaymentTerms,
} from "@/lib/sales/payment-terms";

export type ProposalTerms = {
  total: number | null;
  currency: string;
  installments: number | null;
  dueDay: number | null;
  validityDays: number | null;
  paymentMethod: ProposalPaymentMethod | null;
  paymentNotes: string | null;
  /** Condições de pagamento estruturadas; quando válidas, substituem parcelas/dia. */
  schedule?: PaymentTerms | null;
};

const MARKER_RE = /<h3[^>]*>\s*Condições comerciais\s*<\/h3>\s*<ul[^>]*>[\s\S]*?<\/ul>/i;

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function money(v: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

/** Valor de cada parcela (arredondado em centavos) ou null quando não calculável. */
export function installmentValue(total: number | null, installments: number | null): number | null {
  if (total == null || !installments || installments < 1) return null;
  return Math.round((total / installments) * 100) / 100;
}

export function paymentMethodLabel(
  t: Pick<ProposalTerms, "paymentMethod" | "paymentNotes">,
): string {
  if (!t.paymentMethod) return "";
  const base = PAYMENT_METHOD_LABELS[t.paymentMethod];
  return t.paymentNotes?.trim() ? `${base} (${t.paymentNotes.trim()})` : base;
}

/** Lista das condições que ainda faltam para o contrato. */
export function missingTerms(t: ProposalTerms): string[] {
  const out: string[] = [];
  if (!t.paymentMethod) out.push("forma de pagamento");
  if (t.schedule) {
    if (validatePaymentTerms(t.schedule, t.total ?? 0).length) out.push("condições de pagamento");
  } else {
    if (!t.installments) out.push("parcelas");
    if (!t.dueDay) out.push("dia de vencimento");
  }
  if (!t.validityDays) out.push("vigência");
  return out;
}

function scheduleLines(t: ProposalTerms, s: PaymentTerms): string[] {
  const total = t.total ?? 0;
  const rows = buildPaymentSchedule(s, total, new Date());
  const when = (r: (typeof rows)[number]) =>
    r.dueEvent === "milestone"
      ? "na entrega do marco"
      : r.dueEvent === "signature"
        ? "na assinatura do contrato"
        : r.dueDate
          ? `em ${r.dueDate.split("-").reverse().join("/")}`
          : "";
  const plan = s.plan;
  const items = rows
    .filter((r) => r.label === "Entrada" || plan.kind === "milestones" || plan.kind === "fixed_date")
    .map((r) => {
      const w = when(r);
      return `<li>${esc(r.label)}: ${esc(money(r.amount, t.currency))}${w ? ` — ${esc(w)}` : ""}</li>`;
    });
  if (plan.kind === "monthly" || plan.kind === "periodic") {
    const parts = rows.filter((r) => r.label !== "Entrada");
    if (parts.length) {
      const each = parts[0]!.amount;
      const desc =
        plan.kind === "monthly"
          ? `${parts.length} mensalidades de ${money(each, t.currency)}, todo dia ${plan.dueDay}`
          : `${parts.length} parcelas de ${money(each, t.currency)} a cada ${plan.intervalMonths} ${plan.intervalMonths === 1 ? "mês" : "meses"}, dia ${plan.dueDay}`;
      items.push(`<li>Saldo: ${esc(desc)}</li>`);
    }
  }
  return items;
}

export function renderTermsBlock(t: ProposalTerms): string {
  const pending = "<em>a definir</em>";
  const s = t.schedule;
  if (s && !validatePaymentTerms(s, t.total ?? 0).length) {
    const method = paymentMethodLabel(t);
    return [
      "<h3>Condições comerciais</h3>",
      "<ul>",
      `<li><strong>Forma de pagamento:</strong> ${method ? esc(method) : pending}</li>`,
      `<li><strong>Condições:</strong> ${esc(describePaymentTerms(s))}</li>`,
      ...scheduleLines(t, s),
      `<li><strong>Vigência do contrato:</strong> ${t.validityDays ? `${t.validityDays} dias` : pending}</li>`,
      "</ul>",
    ].join("");
  }
  const per = installmentValue(t.total, t.installments);
  const parcel = t.installments
    ? `${t.installments}x${per != null ? ` de ${esc(money(per, t.currency))}` : ""}`
    : pending;
  const method = paymentMethodLabel(t);
  return [
    "<h3>Condições comerciais</h3>",
    "<ul>",
    `<li><strong>Forma de pagamento:</strong> ${method ? esc(method) : pending}</li>`,
    `<li><strong>Parcelamento:</strong> ${parcel}</li>`,
    `<li><strong>Vencimento:</strong> ${t.dueDay ? `todo dia ${t.dueDay}` : pending}</li>`,
    `<li><strong>Vigência do contrato:</strong> ${t.validityDays ? `${t.validityDays} dias` : pending}</li>`,
    "</ul>",
  ].join("");
}

export function hasTermsBlock(html: string): boolean {
  return MARKER_RE.test(html);
}

/** Substitui o bloco existente; sem bloco, devolve o HTML sem alterações. */
export function upsertTermsBlock(html: string, t: ProposalTerms): string {
  return hasTermsBlock(html) ? html.replace(MARKER_RE, renderTermsBlock(t)) : html;
}

/** Trechos "[Escreva aqui ...]" esquecidos no texto. */
export function countPlaceholders(html: string): number {
  return (html.match(/\[Escreva aqui[^\]]*\]/gi) ?? []).length;
}
