// Coerência entre pipeline e etapa. Puro (sem UI e sem Supabase): usado pela
// edição em massa no servidor e por telas que precisam validar a etapa contra
// as etapas do pipeline de destino.

export type StageDef = {
  value: string;
  label?: string;
  type?: "open" | "won" | "lost" | string;
};

/** Entidades cuja etapa (`stage_id`) pertence a um pipeline. */
export const PIPELINE_ENTITIES = new Set<string>(["deals", "leads", "tickets"]);

/** Enum legado da coluna `stage` (mantida em sincronia com `stage_id`). */
const LEGACY_STAGE_ENUM = new Set([
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "contacted",
  "disqualified",
  "nurturing",
]);

/** Lê as etapas de um pipeline vindas do jsonb `pipelines.stages`. */
export function parseStages(raw: unknown): StageDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      value: String(s["value"] ?? ""),
      label: s["label"] == null ? undefined : String(s["label"]),
      type: s["type"] == null ? undefined : String(s["type"]),
    }))
    .filter((s) => s.value.length > 0);
}

export function isStageOfPipeline(stages: StageDef[], stageValue: string | null): boolean {
  if (!stageValue) return false;
  return stages.some((s) => s.value === stageValue);
}

/**
 * Etapa de destino para um registro que muda de pipeline.
 * - mantém a etapa atual quando ela existe no pipeline de destino;
 * - senão, procura uma etapa do mesmo tipo (ganho/perda);
 * - senão, usa a primeira etapa do pipeline.
 * Retorna `null` quando o pipeline de destino não tem etapas.
 */
export function resolveStageForPipeline(
  stages: StageDef[],
  current: { stage_id?: string | null; stage?: string | null },
  desiredStage?: string | null,
): string | null {
  if (!stages.length) return null;

  // Etapa desejada no próprio update (ex.: `stage = 'lost'` na edição em massa)
  // tem precedência sobre a etapa atual do registro.
  if (desiredStage) {
    if (isStageOfPipeline(stages, desiredStage)) return desiredStage;
    const sameType = stages.find((s) => s.type === desiredStage);
    if (sameType) return sameType.value;
  }

  const currentKey = current.stage_id || current.stage || null;
  if (isStageOfPipeline(stages, currentKey)) return currentKey;
  const wanted =
    current.stage === "won" || current.stage === "lost" ? (current.stage as string) : null;
  if (wanted) {
    const sameType = stages.find((s) => s.type === wanted);
    if (sameType) return sameType.value;
  }
  return stages[0].value;
}

/**
 * Valor da coluna legada `stage` para uma etapa, quando aplicável.
 * Retorna `undefined` quando a coluna não deve ser tocada.
 */
export function legacyStageFor(stages: StageDef[], stageValue: string): string | undefined {
  if (LEGACY_STAGE_ENUM.has(stageValue)) return stageValue;
  const type = stages.find((s) => s.value === stageValue)?.type;
  if (type === "won" || type === "lost") return type;
  return undefined;
}

/** Tipo (`open` | `won` | `lost`) de uma etapa do pipeline. */
export function stageTypeOf(stages: StageDef[], stageValue: string | null): string | undefined {
  if (!stageValue) return undefined;
  const found = stages.find((s) => s.value === stageValue);
  if (found?.type) return found.type;
  if (stageValue === "won" || stageValue === "lost") return stageValue;
  return undefined;
}

/** Etapa do pipeline com o tipo pedido (`won`/`lost`), quando existir. */
export function stageOfType(stages: StageDef[], type: string): string | undefined {
  return stages.find((s) => s.type === type)?.value;
}

/**
 * Verifica se `stage` (enum legado) e `stage_id` (etapa do pipeline) descrevem
 * o mesmo desfecho. Retorna uma mensagem de erro quando são contraditórios,
 * ou `null` quando o par é coerente (ou não há informação suficiente).
 */
export function checkStageCoherence(
  stages: StageDef[],
  pair: { stage?: unknown; stage_id?: unknown },
): string | null {
  const stage = pair.stage == null ? null : String(pair.stage);
  const stageId = pair.stage_id == null ? null : String(pair.stage_id);
  if (!stage || !stageId) return null;

  const stageIdType = stageTypeOf(stages, stageId) ?? "open";
  const stageType = stage === "won" || stage === "lost" ? stage : "open";
  if (stageIdType === stageType) return null;

  const label = stages.find((s) => s.value === stageId)?.label ?? stageId;
  return `A etapa "${label}" é do tipo "${stageIdType}" e não combina com o estágio "${stage}". Ajuste um dos dois campos.`;
}
