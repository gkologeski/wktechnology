import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { z } from "zod";
import { requestKind } from "./types";
import { opsDay as day, opsId as id } from "./operations-types";
import { econComponent, type EconContext, type EconPreview } from "./economics-types";

export const getEconomics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ kind: requestKind, id }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<EconContext>(context.supabase, "hiring_econ_context", { w, i: data.id });
  });

export const saveEconomicPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      planId: id.nullable(),
      version: z.number().int().positive().nullable(),
      modality: z.enum(["delivery", "hourly", "monthly", "mixed"]),
      currency: z.string().regex(/^[A-Z]{3}$/),
      effectiveFrom: day,
      effectiveTo: day.nullable(),
      components: z.array(econComponent).min(1).max(20),
      sourceReference: z.string().trim().min(5).max(500),
      reason: z.string().trim().max(2000).nullable(),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_econ_save", {
      w,
      i: data.id,
      p_plan: data.planId,
      p_version: data.version,
      p_modality: data.modality,
      p_currency: data.currency,
      p_from: data.effectiveFrom,
      p_to: data.effectiveTo,
      p_components: data.components,
      p_source: data.sourceReference,
      p_reason: data.reason,
      p_operation: data.operation,
    });
  });

export const moveEconomicPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      planId: id,
      version: z.number().int().positive(),
      hash: z.string().regex(/^[0-9a-f]{64}$/),
      action: z.enum(["submitted", "approved", "rejected"]),
      reason: z.string().trim().min(5).max(2000),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_econ_transition", {
      w,
      i: data.id,
      p_plan: data.planId,
      p_version: data.version,
      p_hash: data.hash,
      p_action: data.action,
      p_reason: data.reason,
      p_operation: data.operation,
    });
  });

export const previewProvision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ kind: requestKind, id, month: day }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<EconPreview>(context.supabase, "hiring_econ_provision_preview", {
      w,
      i: data.id,
      p_month: data.month,
    });
  });

export const closeProvision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      month: day,
      hash: z.string().regex(/^[0-9a-f]{64}$/),
      previousId: id.nullable(),
      reason: z.string().trim().min(10).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_econ_provision_close", {
      w,
      i: data.id,
      p_month: data.month,
      p_hash: data.hash,
      p_previous: data.previousId,
      p_reason: data.reason,
    });
  });
