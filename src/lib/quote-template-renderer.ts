/**
 * Renderizador simples de modelos HTML para cotações.
 *
 * Sintaxe suportada:
 *  - {{path.to.value}}          — interpolação escapada
 *  - {{{path.to.value}}}        — interpolação sem escape (HTML cru)
 *  - {{#if path}} ... {{/if}}   — bloco condicional (truthy)
 *  - {{#each items}} ... {{/each}} — itera array; dentro usar {{campo}}
 *  - {{#actions/}}              — marcador especial substituído na página pública
 */

export type QuoteRenderContext = Record<string, unknown>;

function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPath(ctx: QuoteRenderContext, path: string): unknown {
  if (path === "." || path === "this") return ctx;
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function isTruthy(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

/** Render template HTML against ctx. Replaces blocks and placeholders. */
export function renderQuoteTemplate(html: string, ctx: QuoteRenderContext): string {
  let out = html;

  // {{#each items}}...{{/each}}
  out = out.replace(
    /\{\{#each\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_m, path: string, body: string) => {
      const arr = getPath(ctx, path);
      if (!Array.isArray(arr)) return "";
      return arr
        .map((item) => {
          const childCtx = {
            ...ctx,
            ...(typeof item === "object" && item ? (item as object) : {}),
          };
          return renderInterpolations(body, childCtx);
        })
        .join("");
    },
  );

  // {{#if path}}...{{/if}}
  out = out.replace(
    /\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_m, path: string, body: string) => {
      return isTruthy(getPath(ctx, path)) ? body : "";
    },
  );

  out = renderInterpolations(out, ctx);
  return out;
}

/**
 * Campos rich-text que sempre são emitidos como HTML cru, mesmo quando o
 * template usa `{{campo}}` (double-brace). Necessário porque templates
 * antigos foram criados antes do editor rich-text e do suporte a snippets.
 */
const RAW_HTML_PATHS = new Set<string>([
  "quote.notes",
  "quote.terms",
  "quote.description",
  "company.description",
  "contact.notes",
]);

function renderInterpolations(src: string, ctx: QuoteRenderContext): string {
  // Preserve the special {{#actions/}} marker for downstream replacement.
  let out = src;
  // {{{ raw }}}
  out = out.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_m, path: string) => {
    const v = getPath(ctx, path);
    return v == null ? "" : String(v);
  });
  // {{ value }} — leaves {{#...}} blocks alone (they should have been processed)
  out = out.replace(/\{\{\s*([^#/{}][\w.]*)\s*\}\}/g, (_m, path: string) => {
    const v = getPath(ctx, path);
    if (RAW_HTML_PATHS.has(path)) return v == null ? "" : String(v);
    return escapeHtml(v);
  });
  return out;
}

/** Sample data used to preview templates inside the editor. */
export function sampleQuoteContext(): QuoteRenderContext {
  return {
    quote: {
      number: "Q-202606-1234",
      title: "Proposta Comercial — Acme",
      created_at: "09/06/2026 11:30",
      valid_until: "30/06/2026",
      subtotal: "R$ 12.000,00",
      discount_total: "R$ 1.200,00",
      tax_total: "R$ 1.080,00",
      total: "R$ 11.880,00",
      currency: "BRL",
      notes: "Pagamento 30% na assinatura, saldo em 30 dias.",
      terms: "Validade da proposta: 30 dias. Reajustes anuais pelo IPCA.",
    },
    company: { name: "Acme S/A", domain: "acme.com" },
    contact: { name: "Maria Souza", email: "maria@acme.com" },
    agent: { name: "João Vendedor", email: "joao@suaempresa.com" },
    items: [
      {
        name: "Licença Plano Pro",
        description: "Anual, 25 usuários",
        quantity: 1,
        unit_price: "R$ 9.000,00",
        discount_pct: 10,
        tax_rate: 9,
        line_total: "R$ 8.829,00",
      },
      {
        name: "Onboarding",
        description: "8h de implantação",
        quantity: 1,
        unit_price: "R$ 3.000,00",
        discount_pct: 0,
        tax_rate: 9,
        line_total: "R$ 3.270,00",
      },
    ],
  };
}

/** Field catalog rendered in the editor toolbar. */
export const QUOTE_TEMPLATE_TOKENS: Array<{
  group: string;
  items: Array<{ token: string; label: string }>;
}> = [
  {
    group: "Cotação",
    items: [
      { token: "{{quote.number}}", label: "Número" },
      { token: "{{quote.title}}", label: "Título" },
      { token: "{{quote.created_at}}", label: "Data de emissão" },
      { token: "{{quote.valid_until}}", label: "Validade" },
      { token: "{{quote.subtotal}}", label: "Subtotal" },
      { token: "{{quote.discount_total}}", label: "Descontos" },
      { token: "{{quote.tax_total}}", label: "Impostos" },
      { token: "{{quote.total}}", label: "Total" },
      { token: "{{quote.notes}}", label: "Observações" },
      { token: "{{quote.terms}}", label: "Termos" },
    ],
  },
  {
    group: "Empresa / Contato",
    items: [
      { token: "{{company.name}}", label: "Nome da empresa" },
      { token: "{{company.domain}}", label: "Domínio" },
      { token: "{{contact.name}}", label: "Nome do contato" },
      { token: "{{contact.email}}", label: "Email do contato" },
      { token: "{{agent.name}}", label: "Vendedor" },
      { token: "{{agent.email}}", label: "Email do vendedor" },
    ],
  },
  {
    group: "Itens (dentro do bloco itens)",
    items: [
      { token: "{{#each items}}\n  ...\n{{/each}}", label: "Iterar itens" },
      { token: "{{name}}", label: "Nome do item" },
      { token: "{{description}}", label: "Descrição" },
      { token: "{{quantity}}", label: "Quantidade" },
      { token: "{{unit_price}}", label: "Preço unitário" },
      { token: "{{discount_pct}}", label: "Desconto %" },
      { token: "{{tax_rate}}", label: "Imposto %" },
      { token: "{{line_total}}", label: "Total da linha" },
    ],
  },
  {
    group: "Blocos especiais",
    items: [
      { token: "{{#if quote.valid_until}}\n  ...\n{{/if}}", label: "Condicional" },
      { token: "{{#actions/}}", label: "Botões Aceitar/Recusar/Pagar" },
    ],
  },
];
