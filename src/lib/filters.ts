// Filter expression engine — compiles to Supabase query builder calls.
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export type FilterOp =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "ilike" | "in" | "is_null" | "is_not_null" | "contains";

export type FilterCondition = {
  type: "condition";
  field: string;
  op: FilterOp;
  value?: unknown;
};

export type FilterGroup = {
  type: "group";
  op: "and" | "or";
  conditions: FilterNode[];
};

export type FilterNode = FilterCondition | FilterGroup;

export const EMPTY_FILTER: FilterGroup = { type: "group", op: "and", conditions: [] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters(query: any, node: FilterNode | null | undefined): any {
  if (!node) return query;
  if (node.type === "condition") return applyCondition(query, node);
  // group
  if (node.op === "and") {
    let q = query;
    for (const c of node.conditions) q = applyFilters(q, c);
    return q;
  }
  // OR — Supabase requires .or() with comma-separated string
  const parts: string[] = [];
  for (const c of node.conditions) {
    if (c.type === "condition") {
      const p = conditionToOrString(c);
      if (p) parts.push(p);
    }
    // nested OR groups inside OR not supported here; flatten one level
  }
  if (parts.length) return query.or(parts.join(","));
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCondition(q: any, c: FilterCondition): any {
  switch (c.op) {
    case "eq": return q.eq(c.field, c.value);
    case "neq": return q.neq(c.field, c.value);
    case "gt": return q.gt(c.field, c.value);
    case "gte": return q.gte(c.field, c.value);
    case "lt": return q.lt(c.field, c.value);
    case "lte": return q.lte(c.field, c.value);
    case "ilike": return q.ilike(c.field, `%${c.value}%`);
    case "in": return q.in(c.field, Array.isArray(c.value) ? c.value : [c.value]);
    case "is_null": return q.is(c.field, null);
    case "is_not_null": return q.not(c.field, "is", null);
    case "contains": return q.contains(c.field, c.value);
  }
}

function conditionToOrString(c: FilterCondition): string | null {
  switch (c.op) {
    case "eq": return `${c.field}.eq.${c.value}`;
    case "neq": return `${c.field}.neq.${c.value}`;
    case "ilike": return `${c.field}.ilike.%${c.value}%`;
    case "is_null": return `${c.field}.is.null`;
    case "is_not_null": return `${c.field}.not.is.null`;
    default: return null;
  }
}

export function conditionToLabel(c: FilterCondition, fieldLabel?: string): string {
  const f = fieldLabel ?? c.field;
  switch (c.op) {
    case "eq": return `${f} = ${c.value}`;
    case "neq": return `${f} ≠ ${c.value}`;
    case "gt": return `${f} > ${c.value}`;
    case "gte": return `${f} ≥ ${c.value}`;
    case "lt": return `${f} < ${c.value}`;
    case "lte": return `${f} ≤ ${c.value}`;
    case "ilike": return `${f} contém "${c.value}"`;
    case "in": return `${f} em [${(c.value as unknown[])?.join(", ")}]`;
    case "is_null": return `${f} vazio`;
    case "is_not_null": return `${f} preenchido`;
    case "contains": return `${f} ⊃ ${JSON.stringify(c.value)}`;
  }
}
