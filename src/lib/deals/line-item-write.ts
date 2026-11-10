import { isTransientDatabaseError, withTransientRetry } from "@/lib/db/transient-retry";

/** Cliente mínimo (usuário + RLS) usado para gravar um item de linha. */
export type LineItemUpdateClient = {
  from: (table: "deal_line_items") => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        select: (
          columns: "id",
        ) => PromiseLike<{ data: { id: string }[] | null; error: { message?: string } | null }>;
      };
    };
  };
};

export type LineItemUpdateResult = { ok: true } | { ok: false; message: string };

export const LINE_ITEM_DENIED_MESSAGE = "Você não tem permissão para alterar este item.";
export const LINE_ITEM_RLS_MESSAGE = "Você não tem permissão para alterar os itens deste negócio.";
export const LINE_ITEM_BUSY_MESSAGE =
  "Não foi possível salvar o item agora (banco ocupado). Tente novamente em instantes.";

/**
 * Grava um item de linha com o cliente do usuário (RLS decide). Repete erros
 * passageiros; 0 linhas devolvidas = negado (RLS não gera erro no UPDATE).
 */
export async function updateLineItemGuarded(
  client: LineItemUpdateClient,
  id: string,
  values: Record<string, unknown>,
): Promise<LineItemUpdateResult> {
  const { data, error } = await withTransientRetry(() =>
    client.from("deal_line_items").update(values).eq("id", id).select("id"),
  );
  if (error) {
    const message = error.message ?? "";
    if (/row-level security|permission denied/i.test(message)) {
      return { ok: false, message: LINE_ITEM_RLS_MESSAGE };
    }
    if (isTransientDatabaseError(error)) return { ok: false, message: LINE_ITEM_BUSY_MESSAGE };
    return { ok: false, message: message || LINE_ITEM_BUSY_MESSAGE };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, message: LINE_ITEM_DENIED_MESSAGE };
  }
  return { ok: true };
}
