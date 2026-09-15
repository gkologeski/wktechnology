// Campos virtuais dos itens de linha do negócio (`deal_line_items`) usados nas
// condições de workflow em Negócios. Os itens vivem em outra tabela, por isso
// são hidratados sob demanda no registro avaliado (chave `__line_items`) e
// referenciados por campos com o prefixo `line_items.`.
//
// Módulo puro (sem I/O) — compartilhado entre motor (server) e builder (client).

export const LINE_ITEM_PREFIX = "line_items.";
export const LINE_ITEMS_KEY = "__line_items";
export const LINE_ITEM_COUNT_FIELD = "line_items.count";

export type LineItemFieldType = "text" | "number" | "currency";

export interface LineItemFieldDef {
  /** Nome completo usado na condição (ex.: `line_items.service_catalog_id`). */
  name: string;
  label: string;
  type?: LineItemFieldType;
  /** Quando presente, o valor é um ID e a interface usa busca por nome. */
  ref?: "service_catalog";
}

/** Catálogo exibido no grupo "Itens do negócio" do seletor de campos. */
export const LINE_ITEM_FIELDS: LineItemFieldDef[] = [
  { name: "line_items.service_catalog_id", label: "Serviço", ref: "service_catalog" },
  { name: "line_items.service_name", label: "Serviço (nome)", type: "text" },
  { name: "line_items.job_profile_name", label: "Cargo/perfil (nome)", type: "text" },
  { name: "line_items.seniority", label: "Senioridade", type: "text" },
  { name: "line_items.preset_name", label: "Preset de contratação (nome)", type: "text" },
  { name: "line_items.name", label: "Nome do item", type: "text" },
  { name: "line_items.description", label: "Descrição do item", type: "text" },
  { name: "line_items.quantity", label: "Quantidade", type: "number" },
  { name: "line_items.unit_price", label: "Valor unitário", type: "currency" },
  { name: "line_items.total", label: "Valor total do item", type: "currency" },
  { name: LINE_ITEM_COUNT_FIELD, label: "Quantidade de itens do negócio", type: "number" },
];

export type LineItemRow = Record<string, unknown>;

export function isLineItemField(field: string | undefined | null): boolean {
  return typeof field === "string" && field.startsWith(LINE_ITEM_PREFIX);
}

/** Nome da propriedade do item (sem o prefixo). */
export function lineItemProp(field: string): string {
  return field.slice(LINE_ITEM_PREFIX.length);
}

/** Itens hidratados no registro avaliado (lista vazia quando não há). */
export function lineItemsOf(row: Record<string, unknown> | null | undefined): LineItemRow[] {
  const raw = row?.[LINE_ITEMS_KEY];
  return Array.isArray(raw) ? (raw as LineItemRow[]) : [];
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Valor total do item: quantidade × unitário, menos desconto (% ou valor). */
export function lineItemTotal(item: LineItemRow): number {
  const gross = num(item["quantity"]) * num(item["unit_price"]);
  const pct = num(item["discount_pct"]);
  const abs = num(item["discount_amount"]);
  const discount = item["discount_type"] === "amount" ? abs : (gross * pct) / 100;
  const total = gross - (discount || 0);
  return Math.round(total * 100) / 100;
}

/** Valor de um campo virtual dentro de um item específico. */
export function lineItemValue(item: LineItemRow, field: string): unknown {
  const prop = lineItemProp(field);
  if (prop === "total") return lineItemTotal(item);
  return item[prop];
}

/** Nomes de serviço distintos dos itens, na ordem em que aparecem. */
export function lineItemServiceNames(items: LineItemRow[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    const name = typeof it["service_name"] === "string" ? it["service_name"].trim() : "";
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** Resumo textual "Serviço — qtd x valor" por item, uma linha cada. */
export function lineItemsSummary(items: LineItemRow[]): string {
  return items
    .map((it) => {
      const label =
        (typeof it["service_name"] === "string" && it["service_name"].trim()) ||
        (typeof it["name"] === "string" && it["name"].trim()) ||
        "Item";
      const qty = num(it["quantity"]) || 1;
      const total = lineItemTotal(it).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      return `${label} — ${qty} x ${total}`;
    })
    .join("\n");
}

/** Tokens de texto disponíveis quando o gatilho é Negócios. */
export const LINE_ITEM_TOKENS = [
  { token: "{{deal.services}}", label: "Serviços do negócio" },
  { token: "{{deal.line_items_count}}", label: "Quantidade de itens do negócio" },
  { token: "{{deal.line_items_summary}}", label: "Resumo dos itens do negócio" },
] as const;

/** Bloco `deal.*` anexado ao registro avaliado para resolver os tokens acima. */
export function lineItemTokenValues(items: LineItemRow[]): Record<string, unknown> {
  return {
    services: lineItemServiceNames(items).join(", "),
    line_items_count: items.length,
    line_items_summary: lineItemsSummary(items),
  };
}

/** O JSON do workflow referencia itens de linha (campos ou tokens)? */
export function workflowUsesLineItems(workflowJson: string): boolean {
  return (
    workflowJson.includes(LINE_ITEM_PREFIX) ||
    workflowJson.includes("{{deal.services}}") ||
    workflowJson.includes("{{deal.line_items_count}}") ||
    workflowJson.includes("{{deal.line_items_summary}}")
  );
}
