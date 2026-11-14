import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { assertWorkRecord, workRpc } from "@/lib/access-control/work-core.server";
import { assertNotReadOnlyView } from "@/lib/view-as-guard.server";
export type Handoff = {
  id: string;
  step: "legal" | "finance" | "signature" | "approval_legal" | "approval_finance";
  status: "queued" | "pending" | "blocked" | "done" | "canceled";
  assignee_name: string | null;
  subject: string;
  href: string;
  due_at: string;
  blocked_reason: string | null;
  created_at: string;
};
const key = "techcontracts.handoffs.manage.workspace";
export const getContractHandoffs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({ dealId: z.string().uuid().optional(), contractId: z.string().uuid().optional() })
      .refine((d) => !!d.dealId !== !!d.contractId, "Informe uma origem."),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    if (data.dealId) await assertSalesRecord(context.supabase, "deals", data.dealId, "view");
    else
      await assertWorkRecord(context.supabase, "techcontracts.contracts", data.contractId!, "view");
    const { data: rows, error } = await (context.supabase as any)
      .from("contract_handoffs")
      .select("id,step,status,assignee_name,subject,href,due_at,blocked_reason,created_at")
      .eq("workspace_id", w)
      .eq(data.dealId ? "deal_id" : "contract_id", data.dealId ?? data.contractId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error("Não foi possível carregar os encaminhamentos.");
    return (rows ?? []) as Handoff[];
  });
export const getContractHandoffSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(context.supabase, context.userId, w, key);
    return workRpc<HandoffSettingsResponse>(context.supabase, "contract_handoff_settings_get", {});
  });
const settings = z.object({
  enabled: z.boolean(),
  legal_user_id: z.string().uuid().nullable(),
  finance_user_id: z.string().uuid().nullable(),
  signature_user_id: z.string().uuid().nullable(),
  operator_user_id: z.string().uuid().nullable(),
  escalation_user_id: z.string().uuid().nullable(),
  legal_days: z.number().int().min(1).max(30),
  finance_days: z.number().int().min(1).max(30),
  signature_days: z.number().int().min(1).max(30),
  timezone: z.string().min(1).max(80),
});
export type HandoffSettings = z.infer<typeof settings>;
export type HandoffSettingsResponse = {
  settings: HandoffSettings | null;
  members: {
    id: string;
    name: string;
    legal: boolean;
    finance: boolean;
    signature: boolean;
    operator: boolean;
  }[];
};
export const saveContractHandoffSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(settings)
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(context.supabase, context.userId, w, key);
    await assertNotReadOnlyView(context.supabase);
    await workRpc<void>(context.supabase, "contract_handoff_settings_save", { p_data: data });
    return { ok: true };
  });
export const retryContractHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(context.supabase, context.userId, w, key);
    await assertNotReadOnlyView(context.supabase);
    await workRpc(context.supabase, "contract_handoff_retry", { p_handoff: data.id });
    return { ok: true };
  });
export const reconcileContractHandoffs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ dealId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(context.supabase, context.userId, w, key);
    await assertNotReadOnlyView(context.supabase);
    await assertSalesRecord(context.supabase, "deals", data.dealId, "view");
    return workRpc<number>(context.supabase, "contract_handoff_reconcile", { p_deal: data.dealId });
  });
