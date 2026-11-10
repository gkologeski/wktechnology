// TABELA-FINAL: a tabela de itens fica ao final do documento, salvo se o texto
// da proposta já trouxer a tabela (propostas antigas com {{{items_table}}}).
export function bodyHasItemsTable(body: string | null | undefined): boolean {
  if (!body) return false;
  return /<th[^>]*>\s*Cobrança\s*<\/th>/i.test(body);
}
