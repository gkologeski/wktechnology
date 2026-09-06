// Tipos e avaliação de condições/filtros do motor de workflows.
// Extraído de engine.server.ts sem mudança de comportamento.
import type { WorkflowCondition, WorkflowEntity, WorkflowFilter } from "./types";
import { isFilterGroup } from "./types";
import { getPath } from "@/lib/message-tokens";
import { renderWorkflowTokens, toStr } from "./render-tokens";

export type AnyRow = Record<string, unknown>;
export type LogStep = {
  at: string;
  ok: boolean;
  action: string;
  action_label?: string;
  step_path?: string;
  detail?: unknown;
  error?: string;
};

export function assignFieldFor(entity: WorkflowEntity): string {
  switch (entity) {
    case "tickets":
      return "assignee_id";
    case "ats_jobs":
      return "recruiter_id";
    case "ats_interviews":
      return "interviewer_id";
    case "ats_applications":
    case "ats_candidates":
    default:
      return "owner_id";
  }
}

export function notificationLinkFor(entity: WorkflowEntity, entityId: string): string | null {
  switch (entity) {
    case "deals":
      return `/deals?id=${entityId}`;
    case "leads":
      return `/leads?id=${entityId}`;
    case "contacts":
      return `/contacts?id=${entityId}`;
    case "companies":
      return `/companies?id=${entityId}`;
    case "tickets":
      return `/tickets?id=${entityId}`;
    case "ats_jobs":
      return `/ats/jobs?id=${entityId}`;
    case "ats_candidates":
      return `/ats/candidates?id=${entityId}`;
    case "ats_applications":
      return `/ats/applications/${entityId}`;
    case "ats_interviews":
      return `/ats/interviews?id=${entityId}`;
    default:
      return null;
  }
}

export function getField(obj: AnyRow | null | undefined, path: string): unknown {
  return getPath(obj ?? null, path);
}

/** Alias local: a implementação canônica vive em `./render-tokens`. */
export const renderTokens = renderWorkflowTokens;

/**
 * Resolve tokens em valores de `extra_fields` de ações create_*.
 * Strings passam por renderTokens; objetos são percorridos recursivamente
 * (para casos como `custom_fields: { key: "{{campo}}" }`). Demais tipos
 * (number/boolean/null) são preservados.
 */
export function resolveExtraFields(
  extra: Record<string, unknown> | undefined,
  after: AnyRow | null,
  vars?: AnyRow,
): Record<string, unknown> {
  if (!extra || typeof extra !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) {
      out[k] = null;
      continue;
    }
    if (typeof v === "string") {
      const resolved = renderTokens(v, after, vars);
      out[k] = resolved === "" ? null : resolved;
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) => (typeof item === "string" ? renderTokens(item, after, vars) : item));
    } else if (typeof v === "object") {
      out[k] = resolveExtraFields(v as Record<string, unknown>, after, vars);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Mescla payload principal com extra_fields, dando precedência ao principal.
 * Se ambos tiverem `custom_fields` (objeto), faz merge em vez de sobrescrever.
 */
export function mergeExtra(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...extra };
  for (const [k, v] of Object.entries(base)) {
    if (v === null || v === undefined) continue;
    merged[k] = v;
  }
  const baseCf = base.custom_fields;
  const extraCf = extra.custom_fields;
  if (
    baseCf &&
    extraCf &&
    typeof baseCf === "object" &&
    !Array.isArray(baseCf) &&
    typeof extraCf === "object" &&
    !Array.isArray(extraCf)
  ) {
    merged.custom_fields = {
      ...(extraCf as Record<string, unknown>),
      ...(baseCf as Record<string, unknown>),
    };
  }
  return merged;
}

export function evalFilter(
  f: WorkflowFilter,
  after: AnyRow | null,
  before: AnyRow | null,
  vars?: AnyRow,
): boolean {
  const v = getField(after, f.field);
  // O valor comparado pode referenciar variáveis ou a saída de passos
  // anteriores via token ({{vars.X}} / {{steps.N.campo}}).
  const target =
    typeof f.value === "string" && f.value.includes("{{")
      ? renderTokens(f.value, after, vars)
      : f.value;
  switch (f.op) {
    case "eq":
      return v === target;
    case "neq":
      return v !== target;

    case "in": {
      const list = Array.isArray(target)
        ? target
        : String(target ?? "")
            .split(",")
            .map((s) => s.trim());
      return list.includes(v as never);
    }
    case "contains":
      return typeof v === "string" && v.toLowerCase().includes(String(target ?? "").toLowerCase());
    case "gt":
      return typeof v === "number" && typeof target === "number" && v > target;
    case "lt":
      return typeof v === "number" && typeof target === "number" && v < target;
    case "changed_to": {
      const prev = getField(before, f.field);
      return v === target && prev !== target;
    }

    case "is_empty":
      return v == null || v === "";
    case "is_not_empty":
      return v != null && v !== "";
    default:
      return false;
  }
}

/** Avalia um nó de condição (condição simples ou grupo E/OU aninhado). */
export function evalCondition(
  node: WorkflowCondition,
  after: AnyRow | null,
  before: AnyRow | null,
  vars?: AnyRow,
): boolean {
  if (isFilterGroup(node)) {
    const children = node.conditions ?? [];
    // Grupo vazio é neutro (não bloqueia a avaliação).
    if (children.length === 0) return true;
    return node.logic === "or"
      ? children.some((c) => evalCondition(c, after, before, vars))
      : children.every((c) => evalCondition(c, after, before, vars));
  }
  return evalFilter(node, after, before, vars);
}

/** Avalia uma lista de condições no topo, combinando com E (comportamento histórico). */
export function evalConditions(
  nodes: WorkflowCondition[] | null | undefined,
  after: AnyRow | null,
  before: AnyRow | null,
  vars?: AnyRow,
): boolean {
  const list = nodes ?? [];
  if (list.length === 0) return true;
  return list.every((c) => evalCondition(c, after, before, vars));
}
