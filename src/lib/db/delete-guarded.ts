// Exclusão por id com verificação de linhas afetadas (lado servidor).
//
// Motivo: quando a política de acesso (RLS) nega uma exclusão, o PostgREST NÃO
// retorna erro — a operação apenas afeta 0 linhas. Sem esta verificação a
// server function responde "ok" e a tela exibe "Excluído" sem nada ter sido
// excluído. O equivalente para o cliente é `src/lib/delete-guard.ts`.

export const DELETE_DENIED_MESSAGE = "Você não tem permissão para excluir este registro.";

/**
 * Exclui um registro por id usando o client informado (normalmente
 * `context.supabase`, que respeita RLS como o usuário logado) e lança erro
 * quando nenhuma linha foi afetada.
 */
export async function deleteByIdGuarded(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  table: string,
  id: string,
  deniedMessage: string = DELETE_DENIED_MESSAGE,
): Promise<void> {
  const { data, error } = await client.from(table).delete().eq("id", id).select("id");
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) throw new Error(deniedMessage);
}
