import { useMemo } from "react";
import { usePipelines, type PipelineStage } from "@/lib/pipelines";
import { LEAD_STATUSES } from "@/lib/crm";

export type LeadStage = PipelineStage;

/** Fallback técnico: usado apenas quando o workspace não possui funil de leads. */
export const DEFAULT_LEAD_STAGES: LeadStage[] = [
  { value: "new", label: "Novo", color: "var(--hs-stage-1)", type: "open" },
  { value: "contacted", label: "Contatado", color: "var(--hs-stage-2)", type: "open" },
  { value: "qualified", label: "Qualificado", color: "var(--hs-stage-won)", type: "won" },
  { value: "disqualified", label: "Desqualificado", color: "var(--hs-stage-lost)", type: "lost" },
];

export type LeadLegacyStatus = "new" | "contacted" | "qualified" | "disqualified";

const LEGACY_VALUES = new Set<string>(LEAD_STATUSES.map((s) => s.value));

/**
 * Etapas do funil de Leads configurado em Configurações → Pipelines.
 * Mantém as etapas padrão como fallback quando não há funil cadastrado.
 */
export function useLeadStages() {
  const { selected, pipelines, isLoading } = usePipelines("lead");
  const pipeline = selected ?? pipelines.find((p) => p.is_default) ?? pipelines[0] ?? null;

  const stages = useMemo<LeadStage[]>(() => {
    const fromPipeline = pipeline?.stages ?? [];
    return fromPipeline.length > 0 ? fromPipeline : DEFAULT_LEAD_STAGES;
  }, [pipeline]);

  return { stages, pipelineId: pipeline?.id ?? null, isLoading };
}

/** Etapa atual do lead: `stage_id` quando existir, com fallback no `status` legado. */
export function resolveLeadStageValue(
  lead: { stage_id?: string | null; status?: string | null },
  stages: LeadStage[],
): string {
  const byStageId = lead.stage_id
    ? stages.find((s) => s.value === lead.stage_id)?.value
    : undefined;
  if (byStageId) return byStageId;
  const byStatus = lead.status ? stages.find((s) => s.value === lead.status)?.value : undefined;
  if (byStatus) return byStatus;
  return lead.stage_id ?? lead.status ?? stages[0]?.value ?? "new";
}

/**
 * Status legado derivado da etapa — mantém filtros e relatórios existentes
 * funcionando quando a etapa é customizada.
 */
export function deriveLeadStatus(stage: LeadStage | undefined | null): LeadLegacyStatus {
  if (!stage) return "new";
  if (LEGACY_VALUES.has(stage.value)) return stage.value as LeadLegacyStatus;
  if (stage.type === "won") return "qualified";
  if (stage.type === "lost") return "disqualified";
  return "contacted";
}

export function findLeadStage(stages: LeadStage[], value: string): LeadStage | undefined {
  return stages.find((s) => s.value === value);
}
