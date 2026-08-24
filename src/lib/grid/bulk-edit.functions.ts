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
    let updated = 0;
    for (const chunk of chunkIds(uniqueIds)) {
      const { data: affected, error } = await client
        .from(data.entity)
        .update(payload)
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

    return {
      ok: true as const,
      requested: uniqueIds.length,
      updated,
      fields: Object.keys(payload).length,
    };
  });
