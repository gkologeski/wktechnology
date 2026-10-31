/**
 * Lotes de gravação de destinatários de campanha WhatsApp.
 *
 * Cada linha passa pelo gatilho de estrutura e pelas políticas de acesso
 * (~0,4 ms/linha com o workspace informado). Lotes de 1.000 mantêm cada
 * comando bem abaixo do tempo limite do banco e reduzem 1.240 destinatários
 * de 13 chamadas para 2.
 */
export const RECIPIENT_INSERT_BATCH = 1000;

export function recipientBatches<T>(rows: readonly T[], size = RECIPIENT_INSERT_BATCH): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("Tamanho de lote inválido.");
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
