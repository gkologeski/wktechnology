/**
 * Regra única de "Criador" x "Responsável" (padrão HubSpot) para todo o sistema.
 *
 * - Criador (imutável, "Criado por"): `created_by ?? owner_id`.
 * - Responsável (editável, "Responsável"/Proprietário): `assigned_to`, com
 *   fallback para `assigned_user_id` (coluna legada, mantida como espelho) e,
 *   por último, `owner_id` — enquanto existirem registros antigos sem
 *   responsável definido.
 *
 * Nenhuma coluna é renomeada ou removida: `owner_id` continua sendo a coluna
 * lida pelas políticas RLS. Aqui apenas padronizamos a *leitura* na interface.
 */

export type ResponsibleRow = {
  assigned_to?: string | null;
  assigned_user_id?: string | null;
  owner_id?: string | null;
  created_by?: string | null;
};

/** Responsável efetivo do registro (`assigned_to ?? assigned_user_id ?? owner_id`). */
export function responsibleId(row: ResponsibleRow | null | undefined): string | null {
  if (!row) return null;
  return row.assigned_to ?? row.assigned_user_id ?? row.owner_id ?? null;
}

/** Criador do registro (`created_by ?? owner_id`). Nunca muda depois da criação. */
export function creatorId(row: ResponsibleRow | null | undefined): string | null {
  if (!row) return null;
  return row.created_by ?? row.owner_id ?? null;
}

/** `true` quando o responsável efetivo do registro é o usuário informado. */
export function isResponsible(
  row: ResponsibleRow | null | undefined,
  userId: string | null | undefined,
): boolean {
  return userId != null && responsibleId(row) === userId;
}

/** Colunas de responsável disponíveis na tabela consultada, em ordem de prioridade. */
export type ResponsibleColumns = readonly string[];

export const RESPONSIBLE_COLUMNS_FULL: ResponsibleColumns = [
  "assigned_to",
  "assigned_user_id",
  "owner_id",
];
export const RESPONSIBLE_COLUMNS_BASIC: ResponsibleColumns = ["assigned_to", "owner_id"];

/**
 * Monta a cláusula `or(...)` do PostgREST para filtrar pelo responsável efetivo,
 * respeitando a mesma cascata de fallback usada na leitura.
 *
 * Ex.: `assigned_to.in.(a,b),and(assigned_to.is.null,owner_id.in.(a,b))`
 */
export function responsibleOrExpr(
  userIds: string[],
  options?: { columns?: ResponsibleColumns; includeUnassigned?: boolean },
): string {
  const columns = options?.columns ?? RESPONSIBLE_COLUMNS_FULL;
  const parts: string[] = [];
  if (userIds.length > 0) {
    const list = userIds.join(",");
    columns.forEach((col, index) => {
      const nulls = columns.slice(0, index).map((c) => `${c}.is.null`);
      const clause = `${col}.in.(${list})`;
      parts.push(nulls.length === 0 ? clause : `and(${[...nulls, clause].join(",")})`);
    });
  }
  if (options?.includeUnassigned) {
    parts.push(`and(${columns.map((c) => `${c}.is.null`).join(",")})`);
  }
  return parts.join(",");
}
