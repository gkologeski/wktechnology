// TechERP Access Control — regra única de "pode excluir este registro".
// Combina as chaves granulares `<recurso>.delete.{own,team,workspace}` (e
// `<recurso>.manage.workspace`) com o responsável do registro, para que a UI
// exiba sempre a ação de exclusão, porém habilitada apenas quando permitida.
import { useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "./use-permissions";
import { useResourceScope } from "./use-resource-scope";

export const DELETE_NOT_ALLOWED_TITLE =
  "Você não tem permissão para excluir este registro.";

/** Campos usados para descobrir o responsável do registro. */
export type OwnableRecord = {
  owner_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  user_id?: string | null;
} | null | undefined;

export type UseCanDeleteResult = {
  /** true enquanto as permissões carregam (mantenha a ação desabilitada). */
  isLoading: boolean;
  /** true quando o usuário pode excluir qualquer registro do recurso. */
  canDeleteAny: boolean;
  /** Decide por registro, considerando o responsável. */
  canDeleteRecord: (record?: OwnableRecord) => boolean;
  /** Texto para tooltip/`title` do botão. */
  reason: (record?: OwnableRecord) => string | undefined;
};

function ownersOf(record: OwnableRecord): string[] {
  if (!record) return [];
  return [record.owner_id, record.assigned_to, record.created_by, record.user_id].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

/**
 * @param resource prefixo do recurso no RBAC, ex.: "techsales.companies".
 */
export function useCanDelete(resource: string): UseCanDeleteResult {
  const { user } = useAuth();
  const { can, isLoading } = usePermissions();
  const { ownerIds, isLoading: scopeLoading } = useResourceScope(resource, "delete");

  const flags = useMemo(
    () => ({
      workspace: can(`${resource}.manage.workspace`) || can(`${resource}.delete.workspace`),
      team: can(`${resource}.delete.team`),
      own: can(`${resource}.delete.own`),
    }),
    [can, resource],
  );

  const teamIds = useMemo(() => new Set(ownerIds ?? []), [ownerIds]);

  const canDeleteRecord = useCallback(
    (record?: OwnableRecord) => {
      if (flags.workspace) return true;
      const owners = ownersOf(record);
      if (flags.own && user?.id && owners.includes(user.id)) return true;
      if (flags.team && owners.some((id) => teamIds.has(id))) return true;
      // Sem responsável identificado, apenas escopo de workspace autoriza.
      return false;
    },
    [flags, teamIds, user?.id],
  );

  const reason = useCallback(
    (record?: OwnableRecord) => (canDeleteRecord(record) ? undefined : DELETE_NOT_ALLOWED_TITLE),
    [canDeleteRecord],
  );

  return {
    isLoading: isLoading || scopeLoading,
    canDeleteAny: flags.workspace,
    canDeleteRecord,
    reason,
  };
}
