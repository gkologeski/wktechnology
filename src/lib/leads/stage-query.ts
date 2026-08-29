// Tradução das etapas do funil de Leads para predicados de banco.
// Mantém filtros, contagens do quadro e seleção por coluna coerentes com a
// resolução feita no cliente por `resolveLeadStageValue`.
import { LEAD_STATUSES } from "@/lib/crm";
import { mapLegacyStatusToStage, type LeadStage } from "./stages";

const LEGACY_STATUSES = LEAD_STATUSES.map((s) => s.value as string);

/**
 * Status legados que resolvem para esta etapa quando o lead não tem `stage_id`.
 * Espelha `resolveLeadStageValue`: status igual ao valor da etapa vence, senão
 * usa o mapeamento semântico de `mapLegacyStatusToStage`.
 */
export function legacyStatusesForStage(stages: LeadStage[], value: string): string[] {
  const stageValues = new Set(stages.map((s) => s.value));
  const out = new Set<string>();
  for (const status of LEGACY_STATUSES) {
    if (stageValues.has(status)) {
      // Status que existe como etapa só cai na etapa de mesmo valor.
      if (status === value) out.add(status);
      continue;
    }
    if (mapLegacyStatusToStage(status, stages)?.value === value) out.add(status);
  }
  return Array.from(out);
}

/** True quando leads sem `status` (nulo) devem cair nesta etapa. */
export function stageAcceptsNullStatus(stages: LeadStage[], value: string): boolean {
  return mapLegacyStatusToStage(null, stages)?.value === value;
}

/** Expressão `or(...)` do PostgREST que isola exatamente uma etapa. */
export function stageOrExpr(stages: LeadStage[], value: string): string {
  return stagesOrExpr(stages, [value]);
}

/** Expressão `or(...)` do PostgREST para um conjunto de etapas. */
export function stagesOrExpr(stages: LeadStage[], values: string[]): string {
  const parts: string[] = [];
  if (values.length > 0) parts.push(`stage_id.in.(${values.join(",")})`);
  const statuses = new Set<string>();
  let acceptsNull = false;
  for (const v of values) {
    for (const s of legacyStatusesForStage(stages, v)) statuses.add(s);
    if (stageAcceptsNullStatus(stages, v)) acceptsNull = true;
  }
  if (statuses.size > 0) {
    parts.push(`and(stage_id.is.null,status.in.(${Array.from(statuses).join(",")}))`);
  }
  if (acceptsNull) parts.push("and(stage_id.is.null,status.is.null)");
  return parts.join(",");
}
