// Helpers de exclusão com verificação de linhas afetadas.
// Motivo: quando a política de acesso (RLS) nega uma exclusão, o cliente NÃO
// recebe erro — a operação simplesmente afeta 0 linhas. Sem esta verificação a
// tela exibe "Excluído" e navega de volta, mesmo sem nada ter sido excluído.
import { supabase } from "@/integrations/supabase/client";

export const DELETE_DENIED_MESSAGE = "Você não tem permissão para excluir este registro.";

export type GuardedDeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; deleted: number; message: string };

/** Exclui um registro por id e falha quando nenhuma linha foi afetada. */
export async function deleteRowGuarded(table: string, id: string): Promise<GuardedDeleteResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from(table).delete().eq("id", id).select("id");
  if (error) return { ok: false, deleted: 0, message: error.message };
  const deleted = Array.isArray(data) ? data.length : 0;
  if (deleted === 0) return { ok: false, deleted: 0, message: DELETE_DENIED_MESSAGE };
  return { ok: true, deleted };
}

/**
 * Exclui vários registros e informa quantos foram realmente excluídos.
 * Retorna ok=false quando nenhum registro pôde ser excluído.
 */
export async function deleteRowsGuarded(
  table: string,
  ids: string[],
): Promise<GuardedDeleteResult & { requested: number }> {
  if (ids.length === 0)
    return { ok: false, deleted: 0, requested: 0, message: "Nenhum registro selecionado." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from(table).delete().in("id", ids).select("id");
  if (error) return { ok: false, deleted: 0, requested: ids.length, message: error.message };
  const deleted = Array.isArray(data) ? data.length : 0;
  if (deleted === 0)
    return {
      ok: false,
      deleted: 0,
      requested: ids.length,
      message: "Nenhum registro foi excluído: você não tem permissão sobre eles.",
    };
  return { ok: true, deleted, requested: ids.length };
}

/** Mensagem para exclusões parciais (alguns registros bloqueados pela permissão). */
export function partialDeleteMessage(deleted: number, requested: number) {
  const blocked = requested - deleted;
  return `${deleted} excluído(s) · ${blocked} sem permissão`;
}
