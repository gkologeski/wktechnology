// Decide quais listagens pesadas valem pré-carregar no ocioso.
// Puro (sem React) para ser testado: só listas do módulo ativo, com permissão
// de leitura, fora da tela atual e sem economia de dados/rede lenta.
import type { CatalogEntity } from "@/hooks/use-auto-grid-columns";

export type HeavyList = {
  to: string;
  gridKey: string;
  entity: CatalogEntity;
  module: string;
  /** Prefixo da permissão de leitura (`<base>.view[.own|.team|.workspace]`). */
  permissionBase: string;
};

export const HEAVY_LISTS: HeavyList[] = [
  {
    to: "/deals",
    gridKey: "deals",
    entity: "deals",
    module: "crm",
    permissionBase: "techsales.deals",
  },
  {
    to: "/contacts",
    gridKey: "contacts",
    entity: "contacts",
    module: "crm",
    permissionBase: "techsales.contacts",
  },
  {
    to: "/companies",
    gridKey: "companies",
    entity: "companies",
    module: "crm",
    permissionBase: "techsales.companies",
  },
  {
    to: "/tasks",
    gridKey: "tasks",
    entity: "activities",
    module: "crm",
    permissionBase: "techsales.activities",
  },
];

export type ConnectionHint = { saveData?: boolean; effectiveType?: string } | null | undefined;

export function isConstrainedConnection(c: ConnectionHint): boolean {
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

export function viewPermissionKeys(base: string): string[] {
  return [`${base}.view`, `${base}.view.own`, `${base}.view.team`, `${base}.view.workspace`];
}

export function planIdlePreload(input: {
  activeModule: string | null;
  canAccessModule: (m: string) => boolean;
  canAny: (keys: string[]) => boolean;
  permissionsReady: boolean;
  currentPath: string;
  connection?: ConnectionHint;
  max?: number;
}): HeavyList[] {
  if (!input.permissionsReady) return [];
  if (isConstrainedConnection(input.connection)) return [];
  const max = input.max ?? 2;
  return HEAVY_LISTS.filter(
    (l) =>
      l.module === input.activeModule &&
      input.canAccessModule(l.module) &&
      input.canAny(viewPermissionKeys(l.permissionBase)) &&
      input.currentPath !== l.to &&
      !input.currentPath.startsWith(`${l.to}/`),
  ).slice(0, max);
}
