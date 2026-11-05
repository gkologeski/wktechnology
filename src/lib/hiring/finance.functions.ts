import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";

const scope = z.object({
  contractId: z.string().uuid(),
  configId: z.string().uuid().nullable().optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/),
});
export type ProvisionSnapshot = {
  hash: string;
  model: string;
  currency: string;
  from: string;
  to: string;
  notice: string;
  timezone: string;
  totals: {
    eligible_revenue: number | null;
    estimated_pending_revenue: number | null;
    known_estimated_cost: number | null;
    unknown_cost_lines: number;
  };
  revenue: Array<{
    source_type: string;
    source_id: string;
    project_id: string | null;
    amount: number | null;
    included: boolean;
    issue: string | null;
  }>;
  pending_estimates: Array<{ entry_id: string; status: string; amount: number | null }>;
  costs: Array<{
    kind: string;
    allocation_id: string | null;
    project_id: string;
    amount: number | null;
    issue: string | null;
  }>;
};
export type ProvisionContext = {
  enabled: boolean;
  configs: Array<{
    id: string;
    model: string;
    currency: string;
    version: number;
    service_id: string | null;
    valid_from: string;
    valid_to: string | null;
  }>;
  history: Array<{
    id: string;
    config_id: string;
    revision: number;
    closed_at: string;
    reason: string;
    snapshot: ProvisionSnapshot;
    source_hash: string;
  }>;
};
export const loadProvisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(scope)
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techfinance.provisions.view.workspace",
    );
    return workRpc<ProvisionContext>(context.supabase, "hiring_provision_context", {
      w,
      k: data.contractId,
      p_cfg: data.configId ?? null,
      p_month: data.month,
    });
  });
export const previewProvision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      configId: z.string().uuid(),
      month: scope.shape.month,
      timezone: z.string().min(1).max(100),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techfinance.provisions.manage.workspace",
    );
    return workRpc<ProvisionSnapshot>(context.supabase, "hiring_provision_preview", {
      w,
      p_cfg: data.configId,
      p_month: data.month,
      p_tz: data.timezone,
    });
  });
export const closeProvision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      configId: z.string().uuid(),
      month: scope.shape.month,
      hash: z.string().regex(/^[a-f0-9]{32}$/),
      previousId: z.string().uuid().nullable(),
      timezone: z.string().min(1).max(100),
      reason: z.string().trim().min(10).max(2000),
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techfinance.provisions.approve.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_provision_close", {
      w,
      p_cfg: data.configId,
      p_month: data.month,
      p_hash: data.hash,
      p_previous: data.previousId,
      p_reason: data.reason,
      p_tz: data.timezone,
    });
  });
export const acceptBillingMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ milestoneId: z.string().uuid(), reference: z.string().trim().min(10).max(2000) }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      w,
      "techprojects.billing_acceptance.approve.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_milestone_accept", {
      w,
      p_id: data.milestoneId,
      p_reference: data.reference,
    });
  });
