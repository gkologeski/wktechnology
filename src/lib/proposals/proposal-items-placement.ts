// TABELA-FINAL: a tabela de itens formatada fica sempre ao final do documento.
// Propostas antigas trazem no texto uma seção "Investimento" com a tabela
// (via {{{items_table}}}) e o Total; essa seção é retirada na exibição para
// não duplicar. O texto salvo não é alterado.
const LEGACY_INVESTMENT =
  /<h2[^>]*>\s*Investimento\s*<\/h2>\s*(?:<p>\s*<\/p>\s*)?(?:<p>\s*)?<table[\s\S]*?<\/table>\s*(?:<\/p>\s*)?(?:<p>\s*<strong>\s*Total:\s*<\/strong>[\s\S]*?<\/p>)?/i;

export function stripLegacyInvestment(body: string | null | undefined): string {
  if (!body) return "";
  return body.replace(LEGACY_INVESTMENT, "");
}
