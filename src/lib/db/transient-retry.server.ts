/**
 * Utilitário compartilhado para lidar com erros transitórios do banco
 * (recarregamento do cache de schema da API, timeouts curtos, quedas de conexão).
 */

const TRANSIENT_DB_MESSAGES = [
  "could not query the database for the schema cache",
  "schema cache",
  "statement timeout",
  "connection",
  "timeout",
  "temporarily unavailable",
  "service unavailable",
];

export const TRANSIENT_DB_MESSAGE_PT =
  "Banco temporariamente indisponível (atualizando cache). Tente novamente em instantes.";

export type QueryResult<T> = { data: T | null; error: { message?: string } | null };

export const isTransientDatabaseError = (error: { message?: string } | null | undefined) => {
  const message = error?.message?.toLowerCase() ?? "";
  if (!message) return false;
  return TRANSIENT_DB_MESSAGES.some((needle) => message.includes(needle));
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withTransientRetry<T>(
  run: () => PromiseLike<QueryResult<T>>,
  attempts = 3,
): Promise<QueryResult<T>> {
  let last: QueryResult<T> | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      last = await run();
    } catch (error) {
      last = {
        data: null,
        error: {
          message: error instanceof Error ? error.message : TRANSIENT_DB_MESSAGE_PT,
        },
      };
    }
    if (!isTransientDatabaseError(last.error)) return last;
    if (attempt < attempts - 1) await wait(250 * (attempt + 1));
  }
  return last ?? { data: null, error: { message: TRANSIENT_DB_MESSAGE_PT } };
}

/** Converte um erro de banco em Error com mensagem amigável em português. */
export function toFriendlyDbError(
  error: { message?: string } | null | undefined,
  fallback: string,
): Error {
  if (isTransientDatabaseError(error)) return new Error(TRANSIENT_DB_MESSAGE_PT);
  return new Error(error?.message || fallback);
}
