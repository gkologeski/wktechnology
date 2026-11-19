import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPreparation, preparationPicker } from "./boundary.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import {
  requestKind,
  preparationWriteData,
  pickerKind,
  type PreparationRow,
  type PreparationEvent,
} from "./types";
export const listPreparation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      search: z.string().max(200).default(""),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, data }) => {
    const ws = await assertPreparation(context.supabase, context.userId, data.kind, "view");
    return workRpc<PreparationRow[]>(context.supabase, "hiring_preparation_page", {
      p_ws: ws,
      p_kind: data.kind,
      p_search: data.search,
      p_offset: data.offset,
    });
  });
export const savePreparation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        kind: requestKind,
        id: z.string().uuid().nullable(),
        revision: z.number().int().min(0),
        operation: z.string().uuid(),
        form: preparationWriteData,
      })
      .strict(),
  )
  .handler(async ({ context, data }) => {
    const action =
      data.id === null ? "create" : data.form.status === "cancelled" ? "cancel" : "update";
    const ws = await assertPreparation(context.supabase, context.userId, data.kind, action);
    return workRpc<PreparationRow>(context.supabase, "hiring_preparation_save", {
      p_ws: ws,
      p_kind: data.kind,
      p_id: data.id,
      p_revision: data.revision,
      p_operation: data.operation,
      p_data: data.form,
    });
  });
export const preparationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id: z.string().uuid(),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, data }) => {
    const ws = await assertPreparation(context.supabase, context.userId, data.kind, "view");
    return workRpc<PreparationEvent[]>(context.supabase, "hiring_preparation_history", {
      p_ws: ws,
      p_kind: data.kind,
      p_id: data.id,
      p_offset: data.offset,
    });
  });
export const searchPreparationPicker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      picker: pickerKind,
      search: z.string().max(100),
      selected: z.string().uuid().nullable(),
      company: z.string().uuid().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const ws = await assertPreparation(context.supabase, context.userId, data.kind, "view");
    return preparationPicker(
      context.supabase,
      ws,
      data.picker,
      data.search,
      data.selected,
      data.company,
    );
  });
export const preparationReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ kind: requestKind, id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const ws = await assertPreparation(
      context.supabase,
      context.userId,
      data.kind,
      "reference_view",
    );
    return workRpc<{ reference_value: number | null; revision: number }>(
      context.supabase,
      "hiring_preparation_reference",
      { p_ws: ws, p_kind: data.kind, p_id: data.id },
    );
  });
