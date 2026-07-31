// Helper puro da matriz de permissões por escopo (/settings/permissions).
// Agrupa o catálogo `permissions` por (módulo, recurso, ação) e resolve, para
// cada célula (cargo × funcionalidade), qual escopo está concedido e quais
// chaves precisam ser concedidas/removidas ao trocar o escopo.
// Sem React, sem Supabase — testável isoladamente.

import { ACTION_LABELS_PT, ACTION_ORDER } from "./action-matrix";
import { RESOURCE_LABELS_PT } from "./resource-labels";


export type ScopeValue = "own" | "team" | "workspace";
export const NONE_VALUE = "__none__";

export type ScopePermissionRow = {
  key: string;
  module: string;
  resource: string;
  action: string;
  scope: string;
  label_pt: string | null;
};

/** Rótulos curtos exibidos no combo de cada célula. */
export const SCOPE_SELECT_LABELS: Record<ScopeValue, string> = {
  own: "Meu(s)/Minha(s)",
  team: "Da minha equipe",
  workspace: "Todos",
};

export const NONE_LABEL = "Nenhuma";

/** Do mais amplo para o mais restrito. */
const SCOPE_PRIORITY: ScopeValue[] = ["workspace", "team", "own"];

/**
 * Ações cujo escopo não faz sentido ser escolhido:
 * - criar: o registro nasce do próprio usuário;
 * - exportar: exporta o que o usuário já consegue ver;
 * - acesso total / atribuir: existem apenas no escopo amplo.
 */
export const FIXED_SCOPE_BY_ACTION: Record<string, ScopeValue> = {
  create: "own",
  export: "workspace",
  manage: "workspace",
  assign: "workspace",
};

export type ScopeMatrixRow = {
  /** Identificador estável da linha: `modulo.recurso.acao`. */
  id: string;
  module: string;
  resource: string;
  /** Rótulo legível do recurso (último segmento do slug). */
  resourceLabel: string;
  action: string;
  actionLabel: string;
  /** Descrição vinda do catálogo (label_pt da chave mais ampla). */
  description: string;
  /** Escopos disponíveis para escolha, do mais amplo ao mais restrito. */
  options: ScopeValue[];
  /** Quando definido, o combo mostra este escopo e não permite trocá-lo. */
  lockedScope: ScopeValue | null;
  /** Escopo → chave de permissão. Inclui escopos legados fora do trio padrão. */
  keysByScope: Record<string, string>;
  /** Todas as chaves da ação/recurso (usado para revogar). */
  allKeys: string[];
};

function isScopeValue(scope: string): scope is ScopeValue {
  return scope === "own" || scope === "team" || scope === "workspace";
}

/** "task_queues" → "Task queues"; "marketing.landing_pages" → "Landing pages". */
export function prettyResource(resource: string): string {
  const mapped = RESOURCE_LABELS_PT[resource];
  if (mapped) return mapped;
  const last = resource.split(".").pop() ?? resource;
  const words = last.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}


function actionRank(action: string): number {
  const i = ACTION_ORDER.indexOf(action as (typeof ACTION_ORDER)[number]);
  return i === -1 ? 99 : i;
}

/**
 * Constrói as linhas da matriz (uma por módulo/recurso/funcionalidade).
 * A ordenação é: recurso (alfabética) → ação (ordem canônica).
 */
export function buildScopeMatrixRows(catalog: ScopePermissionRow[]): ScopeMatrixRow[] {
  const byId = new Map<string, ScopePermissionRow[]>();
  for (const p of catalog) {
    const id = `${p.module}.${p.resource}.${p.action}`;
    const arr = byId.get(id) ?? [];
    arr.push(p);
    byId.set(id, arr);
  }

  const rows: ScopeMatrixRow[] = [];
  for (const [id, perms] of byId) {
    const first = perms[0];
    const keysByScope: Record<string, string> = {};
    for (const p of perms) keysByScope[p.scope] = p.key;

    const available = SCOPE_PRIORITY.filter((s) => keysByScope[s] !== undefined);
    // Escopos legados (ex.: "org") entram como equivalentes a "Todos".
    const legacy = perms.find((p) => !isScopeValue(p.scope));
    if (legacy && !available.includes("workspace")) {
      available.unshift("workspace");
      keysByScope["workspace"] = legacy.key;
    }

    const fixed = FIXED_SCOPE_BY_ACTION[first.action];
    let options = available;
    let lockedScope: ScopeValue | null = null;
    if (fixed && available.includes(fixed)) {
      options = [fixed];
      lockedScope = fixed;
    } else if (available.length === 1) {
      options = available;
      lockedScope = available[0];
    }

    const widest = available[0];
    const description =
      perms.find((p) => p.scope === widest)?.label_pt ?? first.label_pt ?? first.action;

    rows.push({
      id,
      module: first.module,
      resource: first.resource,
      resourceLabel: prettyResource(first.resource),
      action: first.action,
      actionLabel: ACTION_LABELS_PT[first.action] ?? first.action,
      description,
      options,
      lockedScope,
      keysByScope,
      allKeys: perms.map((p) => p.key),
    });
  }

  rows.sort(
    (a, b) =>
      a.resource.localeCompare(b.resource) ||
      actionRank(a.action) - actionRank(b.action) ||
      a.action.localeCompare(b.action),
  );
  return rows;
}

/** Escopo mais amplo efetivamente concedido nesta linha, ou null. */
export function effectiveScope(
  row: ScopeMatrixRow,
  grantedKeys: ReadonlySet<string>,
): ScopeValue | null {
  for (const scope of SCOPE_PRIORITY) {
    const key = row.keysByScope[scope];
    if (key && grantedKeys.has(key)) return scope;
  }
  // Chave legada concedida conta como acesso total.
  const legacy = row.allKeys.find((k) => grantedKeys.has(k));
  return legacy ? "workspace" : null;
}

/** Valor atual do combo (escopo ou "sem acesso"). */
export function selectValue(row: ScopeMatrixRow, grantedKeys: ReadonlySet<string>): string {
  return effectiveScope(row, grantedKeys) ?? NONE_VALUE;
}

/**
 * Chaves a conceder/remover para deixar a linha exatamente no escopo pedido.
 * `scope === null` remove todo o acesso da ação/recurso.
 */
export function keysForSelection(
  row: ScopeMatrixRow,
  scope: ScopeValue | null,
): { grant: string[]; revoke: string[] } {
  const target = scope ? row.keysByScope[scope] : undefined;
  return {
    grant: target ? [target] : [],
    revoke: row.allKeys.filter((k) => k !== target),
  };
}

export function scopeSelectLabel(value: string): string {
  return value === NONE_VALUE ? NONE_LABEL : (SCOPE_SELECT_LABELS[value as ScopeValue] ?? value);
}
