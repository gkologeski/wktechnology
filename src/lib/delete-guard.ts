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

/** Tamanho de lote: mantém a URL curta (ids vão no endereço) e cada chamada rápida. */
export const DELETE_CHUNK_SIZE = 100;

type ChunkRunner = (ids: string[]) => Promise<{ data: unknown; error: { message: string } | null }>;

/** Núcleo puro: exclui em lotes, soma linhas afetadas e para no primeiro erro. */
export async function deleteInChunks(
  ids: string[],
  run: ChunkRunner,
  onProgress?: (done: number, total: number) => void,
  size = DELETE_CHUNK_SIZE,
): Promise<GuardedDeleteResult & { requested: number }> {
  if (ids.length === 0)
    return { ok: false, deleted: 0, requested: 0, message: "Nenhum registro selecionado." };
  let deleted = 0;
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await run(ids.slice(i, i + size));
    if (error)
      return {
        ok: false,
        deleted,
        requested: ids.length,
        message: `${deleted} de ${ids.length} excluído(s); a exclusão parou por uma falha (${error.message}). Tente novamente para os restantes.`,
      };
    deleted += Array.isArray(data) ? data.length : 0;
    onProgress?.(Math.min(i + size, ids.length), ids.length);
  }
  if (deleted === 0)
    return {
      ok: false,
      deleted: 0,
      requested: ids.length,
      message: "Nenhum registro foi excluído: você não tem permissão sobre eles.",
    };
  return { ok: true, deleted, requested: ids.length };
}

/**
 * Exclui vários registros em lotes e informa quantos foram realmente excluídos.
 * Retorna ok=false quando nenhum registro pôde ser excluído.
 */
export function deleteRowsGuarded(
  table: string,
  ids: string[],
  opts?: { onProgress?: (done: number, total: number) => void },
): Promise<GuardedDeleteResult & { requested: number }> {
  return deleteInChunks(
    ids,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chunk) => (supabase as any).from(table).delete().in("id", chunk).select("id"),
    opts?.onProgress,
  );
}

/** Mensagem para exclusões parciais (alguns registros bloqueados pela permissão). */
export function partialDeleteMessage(deleted: number, requested: number) {
  const blocked = requested - deleted;
  return `${deleted} excluído(s) · ${blocked} sem permissão`;
}
