// Aplicação da edição em massa dos grids. Roda no servidor, sob a RLS do
// usuário: a validação de campos é uma camada extra, não substitui a RLS.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BULK_EDIT_ENTITIES,
  BulkEditValidationError,
  buildBulkPayload,
  chunkIds,
  mirrorAliasColumns,
} from "./bulk-edit-fields";
import {
  PIPELINE_ENTITIES,
  isStageOfPipeline,
  legacyStageFor,
  parseStages,
  resolveStageForPipeline,
} from "@/lib/pipelines/stage-resolve";

export const bulkUpdateEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entity: z.enum(BULK_EDIT_ENTITIES),
        ids: z.array(z.string().uuid()).min(1).max(5000),
        values: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;

    const { data: rows, error: catalogError } = await client.rpc("get_entity_field_catalog", {
      p_table: data.entity,
      p_owner_id: userId,
    });
    if (catalogError) throw catalogError;

    const columnTypes = new Map<string, string>(
      ((rows ?? []) as Array<{ column_name: string; data_type: string }>).map((r) => [
        r.column_name,
        r.data_type,
      ]),
    );

    let payload: Record<string, unknown>;
    try {
      payload = mirrorAliasColumns(buildBulkPayload(data.values, columnTypes), columnTypes);
    } catch (e) {
      if (e instanceof BulkEditValidationError) {
        return { ok: false as const, message: e.message, requested: data.ids.length, updated: 0 };
      }
      throw e;
    }

    const uniqueIds = Array.from(new Set(data.ids));

    // Coerência pipeline → etapa: uma etapa de outro pipeline deixaria o
    // registro sem coluna no quadro, então validamos/ajustamos aqui.
    let groups: Array<{ ids: string[]; payload: Record<string, unknown> }> = [
      { ids: uniqueIds, payload },
    ];
    if (PIPELINE_ENTITIES.has(data.entity) && payload["pipeline_id"]) {
      const { data: pipe, error: pipeError } = await client
        .from("pipelines")
        .select("stages")
        .eq("id", payload["pipeline_id"])
        .maybeSingle();
      if (pipeError) {
        return {
          ok: false as const,
          message: pipeError.message as string,
          requested: uniqueIds.length,
          updated: 0,
        };
      }
      const stages = parseStages(pipe?.stages);
      if (!stages.length) {
        return {
          ok: false as const,
          message: "O pipeline de destino não tem etapas configuradas.",
          requested: uniqueIds.length,
          updated: 0,
        };
      }

      const chosenStage = payload["stage_id"];
      if (chosenStage && !isStageOfPipeline(stages, String(chosenStage))) {
        return {
          ok: false as const,
          message:
            "A etapa escolhida não pertence ao pipeline de destino. Selecione uma etapa dele.",
          requested: uniqueIds.length,
          updated: 0,
        };
      }

      if (chosenStage) {
        const legacy = legacyStageFor(stages, String(chosenStage));
        if (legacy && columnTypes.has("stage")) payload["stage"] = legacy;
      } else if (columnTypes.has("stage_id")) {
        // Sem etapa informada: mantém a atual quando ela existe no destino,
        // senão move para a etapa equivalente (ganho/perda) ou para a primeira.
        const byTarget = new Map<string, string[]>();
        for (const chunk of chunkIds(uniqueIds)) {
          const { data: current, error } = await client
            .from(data.entity)
            .select("id, stage_id, stage")
            .in("id", chunk);
          if (error) {
            return {
              ok: false as const,
              message: error.message as string,
              requested: uniqueIds.length,
              updated: 0,
            };
          }
          for (const row of (current ?? []) as Array<{
            id: string;
            stage_id: string | null;
            stage: string | null;
          }>) {
            const target = resolveStageForPipeline(
              stages,
              row,
              payload["stage"] == null ? null : String(payload["stage"]),
            );

            if (!target) continue;
            const list = byTarget.get(target);
            if (list) list.push(row.id);
            else byTarget.set(target, [row.id]);
          }
        }
        if (byTarget.size > 0) {
          groups = Array.from(byTarget.entries()).map(([target, ids]) => {
            const next: Record<string, unknown> = { ...payload, stage_id: target };
            const legacy = legacyStageFor(stages, target);
            if (legacy && columnTypes.has("stage")) next["stage"] = legacy;
            return { ids, payload: next };
          });
        }
      }
    }

    let updated = 0;
    for (const group of groups) {
      for (const chunk of chunkIds(group.ids)) {
        const { data: affected, error } = await client
          .from(data.entity)
          .update(group.payload)
          .in("id", chunk)
          .select("id");
        if (error) {
          return {
            ok: false as const,
            message: error.message as string,
            requested: uniqueIds.length,
            updated,
          };
        }
        updated += ((affected ?? []) as unknown[]).length;
      }
    }

    return {
      ok: true as const,
      requested: uniqueIds.length,
      updated,
      fields: Object.keys(payload).length,
    };
  });
