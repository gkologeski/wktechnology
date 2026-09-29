import type { PipelineOption } from "@/lib/deals/sales-dashboard.types";

export const DEFAULT_PIPELINE_VALUE = "__default__";

export interface DashboardPipelineSelectOption {
  value: string;
  label: string;
  pipelineId: string;
}

export function buildDashboardPipelineOptions(
  pipelines: PipelineOption[],
): DashboardPipelineSelectOption[] {
  const defaultPipeline = pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0];
  if (!defaultPipeline) return [];

  return [
    defaultPipeline,
    ...pipelines.filter((pipeline) => pipeline.id !== defaultPipeline.id),
  ].map((pipeline) => ({
    value: pipeline.id === defaultPipeline.id ? DEFAULT_PIPELINE_VALUE : pipeline.id,
    label: `${pipeline.name}${pipeline.isDefault ? " (Padrão)" : ""}`,
    pipelineId: pipeline.id,
  }));
}

export function resolveDashboardPipelineValue(
  pipelineId: string | null,
  options: DashboardPipelineSelectOption[],
): string | undefined {
  if (options.length === 0) return undefined;
  if (!pipelineId) return DEFAULT_PIPELINE_VALUE;

  return (
    options.find((option) => option.pipelineId === pipelineId)?.value ?? DEFAULT_PIPELINE_VALUE
  );
}
