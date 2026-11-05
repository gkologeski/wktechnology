import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";

const job = z.object({ jobId: z.string().uuid() });
export const getHiringDemand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(job)
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techhire.hiring_demands.view.workspace",
    );
    return (await workRpc(context.supabase, "hiring_stage2_context", {
      p_ws: ws,
      p_job: data.jobId,
    })) as HiringContext;
  });
export const saveHiringDemand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    job.extend({
      revision: z.number().int().positive(),
      purpose: z.enum(["client", "internal", "shared_management"]),
      area: z.string().uuid(),
      regime: z.enum(["clt", "pj", "contract", "internship", "temporary"]),
      billing: z.enum([
        "not_applicable",
        "per_hour",
        "fixed_recurring",
        "package",
        "milestone",
        "success_fixed",
        "success_percent",
        "headcount_month",
      ]),
    }),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techhire.hiring_demands.update.workspace",
    );
    await workRpc(context.supabase, "hiring_demand_save", {
      p_ws: ws,
      p_job: data.jobId,
      p_revision: data.revision,
      p_purpose: data.purpose,
      p_area: data.area,
      p_regime: data.regime,
      p_billing: data.billing,
    });
  });
export const requestHiringApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(job.extend({ revision: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techhire.hiring_demands.create.workspace",
    );
    await workRpc(context.supabase, "hiring_demand_request", {
      p_ws: ws,
      p_job: data.jobId,
      p_revision: data.revision,
    });
  });
export const decideHiringApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      requestId: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techhire.hiring_demands.approve.workspace",
    );
    await workRpc(context.supabase, "hiring_demand_decide", {
      p_ws: ws,
      p_request: data.requestId,
      p_decision: data.decision,
      p_note: data.note,
    });
  });
export const saveHiringPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      area: z.string().uuid(),
      manager: z.string().uuid(),
      ceo: z.string().uuid(),
      managerDelegate: z.string().uuid().nullable(),
      ceoDelegate: z.string().uuid().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techhire.hiring_policies.manage.workspace",
    );
    await workRpc(context.supabase, "hiring_area_policy_save", {
      p_ws: ws,
      p_area: data.area,
      p_manager: data.manager,
      p_ceo: data.ceo,
      p_manager_delegate: data.managerDelegate,
      p_ceo_delegate: data.ceoDelegate,
    });
  });
export type HiringContext = {
  actor_id: string;
  email_deliveries: { step_id: string; status: string; attempts: number }[];
  job: {
    id: string;
    purpose: "client" | "internal" | "shared_management" | null;
    area_id: string | null;
    regime: "clt" | "pj" | "contract" | "internship" | "temporary" | null;
    billing:
      | "not_applicable"
      | "per_hour"
      | "fixed_recurring"
      | "package"
      | "milestone"
      | "success_fixed"
      | "success_percent"
      | "headcount_month"
      | null;
    revision: number;
    status: string;
    governed: boolean;
    deal_id: string | null;
  };
  areas: { id: string; name: string }[];
  members: { id: string; name: string }[];
  policies: {
    area_id: string;
    manager_id: string;
    ceo_id: string;
    manager_delegate_id: string | null;
    ceo_delegate_id: string | null;
    revision: number;
  }[];
  requests: {
    id: string;
    revision: number;
    status: string;
    requested_by: string;
    created_at: string;
    steps: {
      id: string;
      stage: string;
      approver_id: string;
      status: string;
      note: string | null;
    }[];
  }[];
  capabilities: Record<"update" | "request" | "approve" | "manage", boolean>;
};
