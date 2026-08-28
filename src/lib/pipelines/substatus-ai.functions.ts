// Server function fina: sugere substatus de uma etapa com IA.
// Só lê o pipeline sob a RLS do usuário; nada é gravado aqui.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const suggestStageSubstatusesWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        pipelineId: z.string().uuid(),
        stageValue: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = context.supabase as any;

    const { data: pipeline, error } = await client
      .from("pipelines")
      .select("id, name, entity, stages")
      .eq("id", data.pipelineId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pipeline) throw new Error("Pipeline não encontrado ou sem permissão de acesso.");

    const stages = Array.isArray(pipeline.stages)
      ? (pipeline.stages as Array<Record<string, unknown>>)
      : [];
    const stage = stages.find((s) => String(s["value"] ?? s["id"] ?? "") === data.stageValue);
    if (!stage) throw new Error("Etapa não encontrada neste pipeline.");

    const { data: existingRows } = await client
      .from("pipeline_stage_substatuses")
      .select("name, position")
      .eq("pipeline_id", data.pipelineId)
      .eq("stage_value", data.stageValue)
      .order("position", { ascending: true });

    const existing = ((existingRows ?? []) as Array<{ name: string }>).map((r) => r.name);

    const { requestSubstatusSuggestions } = await import("./substatus-ai.server");
    return requestSubstatusSuggestions({
      pipelineName: (pipeline.name as string) ?? "Pipeline",
      pipelineEntity: (pipeline.entity as string) ?? "deal",
      stageLabel: (stage["label"] as string) ?? data.stageValue,
      stageValue: data.stageValue,
      stageType: (stage["type"] as string | null) ?? null,
      existing,
    });
  });
