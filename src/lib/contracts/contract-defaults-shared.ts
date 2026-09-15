// Mescla de padrões de contrato. Módulo puro, compartilhado pelo formulário de
// criação, pela criação a partir do negócio e pela ação de workflow.
// Precedência: padrão geral < padrão do tipo < dados do negócio < entrada do usuário.
import { DEFAULTABLE_CONTRACT_FIELDS } from "./contract-field-catalog";
import type { ContractKind } from "./contract-kinds";

/** Valores suportados em padrões e campos de contrato (serializáveis). */
export type ContractFieldValue = string | number | boolean | null;

export type ContractDefaultsMap = Record<string, ContractFieldValue>;

export type ContractDefaultsBundle = {
  /** Padrão aplicado a qualquer tipo de contrato. */
  general: ContractDefaultsMap;
  /** Padrões por tipo de documento (prestação, compra, aditivo). */
  byKind: Partial<Record<ContractKind, ContractDefaultsMap>>;
};

export const EMPTY_DEFAULTS: ContractDefaultsBundle = { general: {}, byKind: {} };

const ALLOWED = new Set(DEFAULTABLE_CONTRACT_FIELDS.map((f) => f.name));

function isEmpty(v: ContractFieldValue | undefined): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/** Remove chaves não permitidas e valores vazios. */
export function sanitizeDefaults(input: unknown): ContractDefaultsMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: ContractDefaultsMap = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED.has(k)) continue;
    if (v !== null && typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
      continue;
    }
    if (isEmpty(v)) continue;
    out[k] = v;
  }
  return out;
}

/** Padrões efetivos para um tipo de contrato (geral sobrescrito pelo do tipo). */
export function effectiveDefaults(
  bundle: ContractDefaultsBundle | null | undefined,
  kind: ContractKind,
): ContractDefaultsMap {
  const general = sanitizeDefaults(bundle?.general);
  const perKind = sanitizeDefaults(bundle?.byKind?.[kind]);
  return { ...general, ...perKind };
}

/**
 * Aplica os padrões sobre os valores já conhecidos, sem sobrescrever nada que
 * já tenha valor (negócio ou digitado pelo usuário).
 */
export function applyDefaults(
  values: ContractDefaultsMap,
  defaults: ContractDefaultsMap,
): ContractDefaultsMap {
  const out: ContractDefaultsMap = { ...values };
  for (const [k, v] of Object.entries(defaults)) {
    if (isEmpty(out[k])) out[k] = v;
  }
  return out;
}
