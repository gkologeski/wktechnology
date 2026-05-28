import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deletes leads by ids and verifies rows were actually removed.
 *
 * Supabase + RLS quirk: when the policy blocks the DELETE, the call returns
 * `error = null` and `data = []`. Without `.select()` we can't tell if the
 * delete succeeded or was silently blocked. This helper throws when no rows
 * are returned so the UI can show the correct message.
 */
export async function deleteLeadsByIds(
  supabase: Pick<SupabaseClient, "from">,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  const query = supabase.from("leads").delete();
  const { data, error } =
    ids.length === 1
      ? await query.eq("id", ids[0]).select("id")
      : await query.in("id", ids).select("id");

  if (error) throw new Error(error.message);

  const removed = data?.length ?? 0;
  if (removed === 0) {
    throw new Error(
      ids.length === 1
        ? "Você não tem permissão para excluir este lead."
        : "Você não tem permissão para excluir os leads selecionados.",
    );
  }
  if (removed < ids.length) {
    throw new Error(
      `Apenas ${removed} de ${ids.length} leads foram excluídos. Verifique suas permissões.`,
    );
  }
  return removed;
}
