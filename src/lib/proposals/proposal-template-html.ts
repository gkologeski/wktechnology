// Ajustes do HTML dos modelos de proposta. O editor visual não preserva
// blocos {{#each}} dentro de tabelas, então a tabela de itens usa a variável
// {{{items_table}}}, montada na hora de preencher o modelo.

const EACH_TABLE = /<table>(?:(?!<\/table>)[\s\S])*?\{\{#each items\}\}[\s\S]*?<\/table>/g;

/** Troca a tabela com {{#each items}} pela variável {{{items_table}}}. */
export function normalizeProposalTemplateHtml(html: string): string {
  return html.replace(EACH_TABLE, "<p>{{{items_table}}}</p>");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Tabela HTML dos itens (Item | Cobrança) usada em {{{items_table}}}. */
export function itemsTableHtml(items: Array<{ name: string; billing: string }>): string {
  if (!items.length) return "";
  const rows = items
    .map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.billing)}</td></tr>`)
    .join("");
  return `<table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>${rows}</tbody></table>`;
}
