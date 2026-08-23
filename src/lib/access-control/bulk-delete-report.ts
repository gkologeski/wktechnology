// Relatório padronizado de exclusão em massa.
// Motivo: quando a RLS bloqueia a exclusão, o Postgres NÃO retorna erro — a
// operação apenas afeta 0 linhas. Sem este relatório a UI mostraria "excluído"
// mesmo sem nada ter sido removido (sucesso falso).
import { toast } from "sonner";
import { deniedIfUnaffected } from "./rls-denied";

type MaybeLabeled = Record<string, unknown> & { id: string };

const LABEL_KEYS = ["name", "full_name", "title", "subject", "email", "code", "number"] as const;

/** Melhor rótulo legível disponível na linha; cai no id encurtado. */
export function rowLabel(row: MaybeLabeled | undefined, id: string): string {
  if (row) {
    for (const key of LABEL_KEYS) {
      const value = row[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return `#${id.slice(0, 8)}`;
}

export type BulkDeleteReport = {
  removed: number;
  blocked: number;
  /** true quando nada foi excluído (bloqueio total pela permissão). */
  denied: boolean;
};

/**
 * Emite o aviso correto após uma exclusão em massa e informa quais registros
 * foram efetivamente afetados.
 *
 * Uso:
 * ```ts
 * const { data: affected, error } = await q.delete().in("id", ids).select("id");
 * if (error) return toast.error(error.message);
 * const { denied } = reportBulkDelete({ ids, affected, rows, entityLabel: "contato" });
 * if (denied) return;
 * ```
 */
export function reportBulkDelete<T extends { id: string }>({
  ids,
  affected,
  rows,
  entityLabel,
}: {
  ids: string[];
  affected: { id: string }[] | null | undefined;
  rows?: T[];
  entityLabel?: string;
}): BulkDeleteReport {
  if (deniedIfUnaffected(affected, entityLabel ? `exclusão de ${entityLabel}` : undefined)) {
    return { removed: 0, blocked: ids.length, denied: true };
  }
  const removedIds = new Set((affected ?? []).map((r) => r.id));
  const removed = removedIds.size;
  const blockedIds = ids.filter((id) => !removedIds.has(id));

  if (blockedIds.length > 0) {
    const byId = new Map((rows ?? []).map((r) => [r.id, r as unknown as MaybeLabeled]));
    const names = blockedIds.slice(0, 3).map((id) => rowLabel(byId.get(id), id));
    const extra = blockedIds.length - names.length;
    toast.warning(
      `${removed} de ${ids.length} excluído(s). Bloqueado(s) por permissão: ${names.join(", ")}${
        extra > 0 ? ` e mais ${extra}` : ""
      }.`,
      { duration: 8000 },
    );
  } else {
    toast.success(`${removed.toLocaleString("pt-BR")} excluído(s)`);
  }

  return { removed, blocked: blockedIds.length, denied: false };
}
