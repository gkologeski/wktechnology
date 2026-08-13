// Erro para updates/deletes que não afetaram nenhuma linha por causa do RLS.
// O Postgres não retorna erro nesse caso — o retorno simplesmente vem vazio.
export class PermissionDeniedError extends Error {
  constructor(detail?: string) {
    super(
      detail
        ? `Você não tem permissão para esta ação: ${detail}`
        : "Você não tem permissão para esta ação",
    );
    this.name = "PermissionDeniedError";
  }
}

/** Lança PermissionDeniedError quando o update/delete não afetou nenhuma linha. */
export function assertAffected(rows: unknown[] | null | undefined, detail?: string): void {
  if (!rows || rows.length === 0) throw new PermissionDeniedError(detail);
}
