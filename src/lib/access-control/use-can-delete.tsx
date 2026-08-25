// TechERP Access Control — regra única de "pode excluir este registro".
// Combina as chaves granulares `<recurso>.delete.{own,team,workspace}` (e
// `<recurso>.manage.workspace`) com o responsável do registro, para que a UI
// exiba sempre a ação de exclusão, porém habilitada apenas quando permitida.
import { useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "./use-permissions";
import { useResourceScope } from "./use-resource-scope";

export const DELETE_NOT_ALLOWED_TITLE = "Você não tem permissão para excluir este registro.";

/** Campos usados para descobrir o responsável do registro. */
export type OwnableRecord =
  | {
      owner_id?: string | null;
      assigned_to?: string | null;
      assigned_user_id?: string | null;
      created_by?: string | null;
      user_id?: string | null;
    }
  | null
  | undefined;

type DeleteRule = {
  /** Campos que o banco realmente considera como responsável. */
  ownerFields: string[];
  /** Escopos existentes nas políticas do banco para este recurso. */
  scopes: { workspace: boolean; team: boolean; own: boolean };
};

/**
 * Espelha as políticas de exclusão do banco. Sem esta tabela a UI habilitava
 * a ação em casos que o banco recusa (ex.: `created_by` do usuário, mas
 * responsável de outra pessoa, ou escopo de equipe inexistente no recurso).
 */
const RESOURCE_DELETE_RULES: Record<string, DeleteRule> = {
  "techsales.companies": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: false, own: true },
  },
  "techsales.contacts": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: false, own: false },
  },
  "techsales.tickets": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: false, own: false },
  },
  "techsales.leads": {
    ownerFields: ["owner_id", "assigned_user_id"],
    scopes: { workspace: true, team: true, own: true },
  },
  "techsales.deals": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: true, own: true },
  },
  "techsales.activities": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: true, own: true },
  },
  "techcontracts.contracts": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: false, own: true },
  },
  "techservice.services": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: false, own: true },
  },
  "techsales.catalog.services": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: false, own: true },
  },

  "techfinance.entries": {
    ownerFields: ["owner_id"],
    scopes: { workspace: true, team: false, own: false },
  },
};

/** Fallback conservador: apenas escopo de workspace. */
const DEFAULT_RULE: DeleteRule = {
  ownerFields: ["owner_id"],
  scopes: { workspace: true, team: false, own: false },
};

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

function ownersOf(record: OwnableRecord, fields: string[]): string[] {
  if (!record) return [];
  const row = record as Record<string, unknown>;
  return fields
    .map((f) => row[f])
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * @param resource prefixo do recurso no RBAC, ex.: "techsales.companies".
 */
export function useCanDelete(resource: string): UseCanDeleteResult {
  const { user } = useAuth();
  const { can, isLoading } = usePermissions();
  const { ownerIds, isLoading: scopeLoading } = useResourceScope(resource, "delete");

  const rule = RESOURCE_DELETE_RULES[resource] ?? DEFAULT_RULE;

  const flags = useMemo(
    () => ({
      workspace: can(`${resource}.manage.workspace`) || can(`${resource}.delete.workspace`),
      team: rule.scopes.team && can(`${resource}.delete.team`),
      own: rule.scopes.own && can(`${resource}.delete.own`),
    }),
    [can, resource, rule],
  );

  const teamIds = useMemo(() => new Set(ownerIds ?? []), [ownerIds]);

  const canDeleteRecord = useCallback(
    (record?: OwnableRecord) => {
      if (flags.workspace) return true;
      const owners = ownersOf(record, rule.ownerFields);
      if (flags.own && user?.id && owners.includes(user.id)) return true;
      if (flags.team && owners.some((id) => teamIds.has(id))) return true;
      // Sem responsável identificado, apenas escopo de workspace autoriza.
      return false;
    },
    [flags, teamIds, user?.id, rule.ownerFields],
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
