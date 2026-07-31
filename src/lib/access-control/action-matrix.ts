// Helper puro que traduz as chaves técnicas de permissão
// (`modulo.recurso.acao.escopo`) em uma matriz legível de ações por
// funcionalidade: Exibir, Criar, Editar, Excluir, Aprovar, Mesclar...
// Sem React, sem Supabase — testável isoladamente.

export type PermissionCatalogRow = {
  key: string;
  module: string;
  resource: string;
  action: string;
  scope: string;
  label_pt: string | null;
};

export type PermissionScope = "workspace" | "team" | "own";

/** Rótulos em PT-BR das ações do catálogo. */
export const ACTION_LABELS_PT: Record<string, string> = {
  view: "Exibir",
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
  merge: "Mesclar",
  approve: "Aprovar",
  export: "Exportar",
  assign: "Atribuir",
  manage: "Acesso total",
};

/** Ordem fixa de exibição das linhas da matriz. */
export const ACTION_ORDER = [
  "view",
  "create",
  "update",
  "delete",
  "merge",
  "approve",
  "export",
  "assign",
  "manage",
] as const;

/** Rótulos em PT-BR dos escopos de acesso. */
export const SCOPE_LABELS_PT: Record<string, string> = {
  workspace: "Todos os registros",
  team: "Registros da minha equipe",
  own: "Apenas os meus registros",
};

export const NO_ACCESS_LABEL = "Sem acesso";

/** Do mais amplo para o mais restrito. */
const SCOPE_PRIORITY: PermissionScope[] = ["workspace", "team", "own"];

export type ActionMatrixRow = {
  action: string;
  label: string;
  /** Escopos existentes no catálogo para esta ação (ordenados do mais amplo). */
  scopesAvailable: PermissionScope[];
  /** Escopo mais amplo efetivamente concedido, ou null quando não há acesso. */
  effectiveScope: PermissionScope | null;
  /** Chave concedida que originou o escopo efetivo. */
  grantedKey: string | null;
};

function sortScopes(scopes: Iterable<string>): PermissionScope[] {
  const set = new Set(Array.from(scopes));
  return SCOPE_PRIORITY.filter((s) => set.has(s));
}

/**
 * Descobre os recursos (`modulo.recurso`) referenciados por um item de menu,
 * a partir das chaves declaradas em `permissionAny`.
 * Usa o catálogo quando a chave existe nele; caso contrário faz um parse
 * tolerante (algumas chaves legadas não têm segmento de escopo).
 */
export function resolveResources(
  permissionAny: readonly string[],
  catalog: PermissionCatalogRow[],
): string[] {
  const byKey = new Map(catalog.map((r) => [r.key, r]));
  const resources = new Set<string>();

  for (const key of permissionAny) {
    const row = byKey.get(key);
    if (row) {
      resources.add(`${row.module}.${row.resource}`);
      continue;
    }
    const parts = key.split(".");
    if (parts.length < 3) continue;
    let end = parts.length;
    if (SCOPE_LABELS_PT[parts[end - 1]]) end -= 1;
    if (end > 2 && ACTION_LABELS_PT[parts[end - 1]]) end -= 1;
    if (end >= 2) resources.add(parts.slice(0, end).join("."));
  }

  return Array.from(resources).sort();
}

/**
 * Monta a matriz de ações de um conjunto de recursos, considerando as chaves
 * que o usuário efetivamente possui.
 */
export function buildActionMatrix(
  resources: readonly string[],
  catalog: PermissionCatalogRow[],
  grantedKeys: ReadonlySet<string>,
): ActionMatrixRow[] {
  const wanted = new Set(resources);
  const rowsForResource = catalog.filter((r) => wanted.has(`${r.module}.${r.resource}`));
  if (rowsForResource.length === 0) return [];

  const byAction = new Map<string, PermissionCatalogRow[]>();
  for (const row of rowsForResource) {
    if (!byAction.has(row.action)) byAction.set(row.action, []);
    byAction.get(row.action)!.push(row);
  }

  const actions = Array.from(byAction.keys()).sort((a, b) => {
    const ia = ACTION_ORDER.indexOf(a as (typeof ACTION_ORDER)[number]);
    const ib = ACTION_ORDER.indexOf(b as (typeof ACTION_ORDER)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

  return actions.map((action) => {
    const rows = byAction.get(action)!;
    const scopesAvailable = sortScopes(rows.map((r) => r.scope));
    let effectiveScope: PermissionScope | null = null;
    let grantedKey: string | null = null;
    for (const scope of SCOPE_PRIORITY) {
      const hit = rows.find((r) => r.scope === scope && grantedKeys.has(r.key));
      if (hit) {
        effectiveScope = scope;
        grantedKey = hit.key;
        break;
      }
    }
    // Escopos fora do trio padrão (ex.: chaves legadas) contam como acesso total.
    if (!effectiveScope) {
      const other = rows.find(
        (r) => !SCOPE_LABELS_PT[r.scope] && grantedKeys.has(r.key),
      );
      if (other) {
        effectiveScope = "workspace";
        grantedKey = other.key;
      }
    }
    return {
      action,
      label: ACTION_LABELS_PT[action] ?? action,
      scopesAvailable,
      effectiveScope,
      grantedKey,
    };
  });
}

/** Rótulo em PT-BR do escopo efetivo de uma linha da matriz. */
export function scopeLabel(scope: PermissionScope | null): string {
  return scope ? (SCOPE_LABELS_PT[scope] ?? scope) : NO_ACCESS_LABEL;
}
