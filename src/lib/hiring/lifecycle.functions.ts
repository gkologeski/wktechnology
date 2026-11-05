import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
const uuid = z.string().uuid();
const change = z.object({
  engagementId: uuid,
  kind: z.enum(["renew", "replace", "end_allocation", "end_engagement", "cancel_commitments"]),
  payload: z.object({
    date: z.string().date(),
    reason: z.string().trim().min(10).max(2000),
    allocation: uuid.optional(),
    replacement: uuid.optional(),
    start: z.string().date().optional(),
    end: z.string().date().optional(),
    overlap: z.boolean().optional(),
    entries: z.array(uuid).min(1).max(100).optional(),
  }),
});
export type LifecycleChange = z.infer<typeof change>;
export type LifecycleSnapshot = string;
export type LifecycleContext = {
  allocations: Array<{
    id: string;
    project_id: string;
    project_name: string | null;
    starts_at: string;
    ends_at: string | null;
    status: string;
  }>;
  replacements: Array<{ id: string; full_name: string }>;
  commitments: Array<{
    id: string;
    amount: number;
    currency: string;
    competence_date: string;
    due_date: string;
  }>;
  requests: Array<{
    id: string;
    kind: LifecycleChange["kind"];
    payload: LifecycleChange["payload"];
    snapshot: LifecycleSnapshot;
    status: string;
    requested_by: string;
    manager_id: string;
    ceo_id: string;
    manager_at: string | null;
    ceo_at: string | null;
    created_at: string;
    note: string | null;
  }>;
};
export const getLifecycleContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ engagementId: uuid, search: z.string().max(100).default("") }))
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
      eid: data.engagementId,
      search_text: data.search,
    });
  });
export const previewLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(change)
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.lifecycle.manage.workspace",
    );
    return JSON.stringify(
      await workRpc<Record<string, unknown>>(context.supabase, "hiring_lifecycle_preview", {
        w,
        eid: data.engagementId,
        k: data.kind,
        p: data.payload,
      }),
    );
  });
export const requestLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(change.extend({ snapshot: z.string().min(2).max(200000), requestId: uuid }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.lifecycle.manage.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_lifecycle_request", {
      w,
      eid: data.engagementId,
      k: data.kind,
      p: data.payload,
      expected: JSON.parse(data.snapshot),
      request_id: data.requestId,
    });
  });
export const decideLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ requestId: uuid, approve: z.boolean(), reason: z.string().trim().min(3).max(2000) }),
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
      req: data.requestId,
      accept: data.approve,
      reason: data.reason,
    });
  });
export const applyLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ requestId: uuid }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techpeople.lifecycle.manage.workspace",
    );
    return workRpc<{
      request_id: string;
      new_allocation_id: string | null;
      effective_date: string;
    }>(context.supabase, "hiring_lifecycle_apply", { w, req: data.requestId });
  });
