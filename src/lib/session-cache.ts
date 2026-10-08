// Política de cache por identidade (usuário + workspace).
// Várias chaves de consulta não carregam usuário/workspace (ex.: ["my-permissions"],
// ["grid-pref", key]). Em vez de mudar centenas de chaves, a troca de identidade
// zera o cache uma única vez — nunca a cada navegação.
//  - SIGNED_OUT: limpa sem recarregar (evita rajada de 401).
//  - Outro usuário (inclui "Ver como", que usa a sessão real do alvo): reset.
//  - Mesmo usuário: só invalida (comportamento anterior).
export type CacheAction = "clear" | "reset" | "invalidate" | "none";

export function cacheActionForAuthEvent(
  event: string,
  previousUserId: string | null,
  nextUserId: string | null,
): CacheAction {
  if (event === "SIGNED_OUT") return "clear";
  if (event !== "SIGNED_IN" && event !== "USER_UPDATED") return "none";
  if (previousUserId && nextUserId && previousUserId !== nextUserId) return "reset";
  return "invalidate";
}
