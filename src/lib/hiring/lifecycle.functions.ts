import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { LifecycleContext, LifecyclePreview } from "./lifecycle.types";

export const loadLifecycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ engagementId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.lifecycle.view.workspace",
    );
    return workRpc<LifecycleContext>(context.supabase, "hiring_lifecycle_context", {
      w,
      p_engagement: data.engagementId,
    });
  });
export const previewLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      engagementId: z.string().uuid(),
      allocationId: z.string().uuid().nullable(),
      kind: z.enum(["renew", "replace", "end_allocation", "end_employment"]),
      effectiveDate: z.string().date(),
      startsAt: z.string().date().nullable(),
      endsAt: z.string().date().nullable(),
      replacementId: z.string().uuid().nullable(),
      overlap: z.boolean(),
      reason: z.string().trim().min(10).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.lifecycle.view.workspace",
    );
    return workRpc<LifecyclePreview>(context.supabase, "hiring_lifecycle_preview", {
      w,
      p_engagement: data.engagementId,
      p_allocation: data.allocationId,
      p_kind: data.kind,
      p_effective: data.effectiveDate,
      p_start: data.startsAt,
      p_end: data.endsAt,
      p_replacement: data.replacementId,
      p_overlap: data.overlap,
      p_reason: data.reason,
    });
  });
export const requestLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      engagementId: z.string().uuid(),
      allocationId: z.string().uuid().nullable(),
      kind: z.enum(["renew", "replace", "end_allocation", "end_employment"]),
      effectiveDate: z.string().date(),
      startsAt: z.string().date().nullable(),
      endsAt: z.string().date().nullable(),
      replacementId: z.string().uuid().nullable(),
      overlap: z.boolean(),
      reason: z.string().trim().min(10).max(2000),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.lifecycle.view.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_lifecycle_request", {
      w,
      p_engagement: data.engagementId,
      p_allocation: data.allocationId,
      p_kind: data.kind,
      p_effective: data.effectiveDate,
      p_start: data.startsAt,
      p_end: data.endsAt,
      p_replacement: data.replacementId,
      p_overlap: data.overlap,
      p_reason: data.reason,
      p_hash: data.hash,
    });
  });
export const decideLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      requestId: z.string().uuid(),
      revision: z.number().int().positive(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().trim().min(5).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.lifecycle.approve.workspace",
    );
    return workRpc<void>(context.supabase, "hiring_lifecycle_decide", {
      w,
      p_request: data.requestId,
      p_revision: data.revision,
      p_decision: data.decision,
      p_note: data.note,
    });
  });
export const executeLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ requestId: z.string().uuid(), revision: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.lifecycle.execute.workspace",
    );
    return workRpc<{ allocation_id: string | null }>(context.supabase, "hiring_lifecycle_execute", {
      w,
      p_request: data.requestId,
      p_revision: data.revision,
    });
  });
