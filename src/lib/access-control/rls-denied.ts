// Erro e helpers para updates/deletes que não afetaram nenhuma linha por causa do RLS.
// O Postgres não retorna erro nesse caso — o retorno simplesmente vem vazio,
// então sem `.select()` a UI mostraria "salvo" mesmo quando a ação foi bloqueada.
import { handlePermissionError } from "./handle-permission-error";

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

/**
 * Mostra o toast de permissão negada e retorna `true` quando nenhuma linha foi
 * afetada. Uso: `if (deniedIfUnaffected(rows)) return;`
 */
export function deniedIfUnaffected(rows: unknown[] | null | undefined, detail?: string): boolean {
  if (rows && rows.length > 0) return false;
  handlePermissionError(new PermissionDeniedError(detail));
  return true;
}
