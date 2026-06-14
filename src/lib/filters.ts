// Filter expression engine — compiles to Supabase query builder calls.
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export type FilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "ilike"
  | "in"
  | "is_null"
  | "is_not_null"
  | "contains"
  | "between";

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
    for (const c of node.conditions) {
      if (c.type === "condition") {
        q = applyCondition(q, c);
      } else if (c.op === "and") {
        // flatten nested AND
        q = applyFilters(q, c);
      } else {
        // nested OR group inside AND: serialize and pass to .or()
        const s = nodeToOrString(c);
        if (s) {
          const inner = s.startsWith("or(") && s.endsWith(")") ? s.slice(3, -1) : s;
          q = q.or(inner);
        }
      }
    }
    return q;
  }
  // top-level OR — supports nested AND/OR via PostgREST serialization
  const inner = node.conditions
    .map((c) => nodeToOrString(c))
    .filter((s): s is string => !!s)
    .join(",");
  if (inner) return query.or(inner);
  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCondition(q: any, c: FilterCondition): any {
  switch (c.op) {
    case "eq":
      return q.eq(c.field, c.value);
    case "neq":
      return q.neq(c.field, c.value);
    case "gt":
      return q.gt(c.field, c.value);
    case "gte":
      return q.gte(c.field, c.value);
    case "lt":
      return q.lt(c.field, c.value);
    case "lte":
      return q.lte(c.field, c.value);
    case "ilike":
      return q.ilike(c.field, `%${c.value}%`);
    case "in":
      return q.in(c.field, Array.isArray(c.value) ? c.value : [c.value]);
    case "is_null":
      return q.is(c.field, null);
    case "is_not_null":
      return q.not(c.field, "is", null);
    case "contains":
      return q.contains(c.field, c.value);
    case "between": {
      const v = (c.value ?? {}) as { start?: string; end?: string };
      let r = q;
      if (v.start) r = r.gte(c.field, v.start);
      if (v.end) r = r.lt(c.field, v.end);
      return r;
    }
  }
}

// PostgREST .or()/and() values must be escaped when they contain reserved
// chars: , ( ) . " : whitespace. We wrap in double quotes and escape internal
// quotes/backslashes. null/booleans/numbers pass through unquoted.
function escapeValue(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  if (/[,()."\s:]/.test(s)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

// Recursively serialize any FilterNode into PostgREST or()/and() expression syntax.
function nodeToOrString(n: FilterNode): string | null {
  if (n.type === "condition") return conditionToOrString(n);
  const parts = n.conditions.map((c) => nodeToOrString(c)).filter((s): s is string => !!s);
  if (!parts.length) return null;
  return `${n.op}(${parts.join(",")})`;
}

function conditionToOrString(c: FilterCondition): string | null {
  switch (c.op) {
    case "eq":
      return `${c.field}.eq.${escapeValue(c.value)}`;
    case "neq":
      return `${c.field}.neq.${escapeValue(c.value)}`;
    case "gt":
      return `${c.field}.gt.${escapeValue(c.value)}`;
    case "gte":
      return `${c.field}.gte.${escapeValue(c.value)}`;
    case "lt":
      return `${c.field}.lt.${escapeValue(c.value)}`;
    case "lte":
      return `${c.field}.lte.${escapeValue(c.value)}`;
    case "ilike":
      return `${c.field}.ilike.${escapeValue(`%${c.value}%`)}`;
    case "is_null":
      return `${c.field}.is.null`;
    case "is_not_null":
      return `${c.field}.not.is.null`;
    case "in": {
      const vals = Array.isArray(c.value) ? c.value : [c.value];
      return `${c.field}.in.(${vals.map(escapeValue).join(",")})`;
    }
    default:
      return null;
  }
}

export function conditionToLabel(c: FilterCondition, fieldLabel?: string): string {
  const f = fieldLabel ?? c.field;
  switch (c.op) {
    case "eq":
      return `${f} = ${c.value}`;
    case "neq":
      return `${f} ≠ ${c.value}`;
    case "gt":
      return `${f} > ${c.value}`;
    case "gte":
      return `${f} ≥ ${c.value}`;
    case "lt":
      return `${f} < ${c.value}`;
    case "lte":
      return `${f} ≤ ${c.value}`;
    case "ilike":
      return `${f} contém "${c.value}"`;
    case "in":
      return `${f} em [${(c.value as unknown[])?.join(", ")}]`;
    case "is_null":
      return `${f} vazio`;
    case "is_not_null":
      return `${f} preenchido`;
    case "contains":
      return `${f} ⊃ ${JSON.stringify(c.value)}`;
    case "between": {
      const v = (c.value ?? {}) as { start?: string; end?: string };
      return `${f} entre ${v.start ?? "—"} e ${v.end ?? "—"}`;
    }
  }
}
