// Helpers client-safe para condições de workflow (condições simples + grupos E/OU).
import { isFilterGroup, type WorkflowCondition, type WorkflowFilterGroup } from "./types";

export { isFilterGroup };

export function emptyGroup(logic: "and" | "or" = "and"): WorkflowFilterGroup {
  return { logic, conditions: [] };
}

/** Conta condições simples (folhas) e grupos em uma lista de condições. */
export function countConditions(nodes: WorkflowCondition[] | null | undefined): {
  leaves: number;
  groups: number;
} {
  let leaves = 0;
  let groups = 0;
  const walk = (list: WorkflowCondition[]) => {
    for (const n of list) {
      if (isFilterGroup(n)) {
        groups += 1;
        walk(n.conditions ?? []);
      } else {
        leaves += 1;
      }
    }
  };
  walk(nodes ?? []);
  return { leaves, groups };
}

/** Resumo em PT-BR do bloco de condições, ex.: "3 condição(ões) · 1 grupo(s)". */
export function conditionsSummary(nodes: WorkflowCondition[] | null | undefined): string {
  const { leaves, groups } = countConditions(nodes);
  const base = `${leaves} condição(ões)`;
  return groups > 0 ? `${base} · ${groups} grupo(s)` : base;
}

/** Avalia condições com um predicado de folha (usado em simulações client/server). */
export function evaluateConditions(
  nodes: WorkflowCondition[] | null | undefined,
  predicate: (leaf: Exclude<WorkflowCondition, WorkflowFilterGroup>) => boolean,
): boolean {
  const list = nodes ?? [];
  if (list.length === 0) return true;
  const evalNode = (node: WorkflowCondition): boolean => {
    if (isFilterGroup(node)) {
      const children = node.conditions ?? [];
      if (children.length === 0) return true;
      return node.logic === "or" ? children.some(evalNode) : children.every(evalNode);
    }
    return predicate(node);
  };
  return list.every(evalNode);
}
