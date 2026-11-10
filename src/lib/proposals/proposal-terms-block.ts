// Bloco "Condições comerciais" da proposta (TEXTO-PROPOSTA).
// Delimitado pelo título "Condições comerciais" + lista seguinte (o editor
// remove atributos desconhecidos), regenerado sempre que as
// condições mudam no assistente sem tocar no restante do texto.

export const PROPOSAL_PAYMENT_METHODS = ["pix", "ted", "boleto", "transferencia", "outros"] as const;
export type ProposalPaymentMethod = (typeof PROPOSAL_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<ProposalPaymentMethod, string> = {
  pix: "PIX",
  ted: "TED",
  boleto: "Boleto bancário",
  transferencia: "Transferência bancária",
  outros: "Outro",
};

export type ProposalTerms = {
  total: number | null;
  currency: string;
  installments: number | null;
  dueDay: number | null;
  validityDays: number | null;
  paymentMethod: ProposalPaymentMethod | null;
  paymentNotes: string | null;
};

const MARKER_RE = /<h3[^>]*>\s*Condições comerciais\s*<\/h3>\s*<ul[^>]*>[\s\S]*?<\/ul>/i;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function money(v: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

/** Valor de cada parcela (arredondado em centavos) ou null quando não calculável. */
export function installmentValue(total: number | null, installments: number | null): number | null {
  if (total == null || !installments || installments < 1) return null;
  return Math.round((total / installments) * 100) / 100;
}

export function paymentMethodLabel(t: Pick<ProposalTerms, "paymentMethod" | "paymentNotes">): string {
  if (!t.paymentMethod) return "";
  const base = PAYMENT_METHOD_LABELS[t.paymentMethod];
  return t.paymentNotes?.trim() ? `${base} (${t.paymentNotes.trim()})` : base;
}

/** Lista das condições que ainda faltam para o contrato. */
export function missingTerms(t: ProposalTerms): string[] {
  const out: string[] = [];
  if (!t.paymentMethod) out.push("forma de pagamento");
  if (!t.installments) out.push("parcelas");
  if (!t.dueDay) out.push("dia de vencimento");
  if (!t.validityDays) out.push("vigência");
  return out;
}

export function renderTermsBlock(t: ProposalTerms): string {
  const pending = "<em>a definir</em>";
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
