// Regras puras do PDF público da proposta (link por token).
export function isValidProposalToken(token: unknown): token is string {
  return typeof token === "string" && token.length >= 16 && token.length <= 128;
}

/** Ordem do PDF: texto, depois a tabela de itens (salvo se o texto já trouxer). */
export function proposalPdfSections(
  body: string,
  itemsHtml: string,
  totalHtml: string,
  bodyHasTable: boolean,
): string {
  const tail = bodyHasTable
    ? ""
    : `${itemsHtml || totalHtml ? "<h2>Investimento</h2>" : ""}${itemsHtml}${totalHtml}`;
  return `<div>${body}</div>${tail}`;
}
