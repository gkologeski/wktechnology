// Sprint 6: Contract approvals (legal / finance / purchasing) + audit events.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { workRpc } from "@/lib/access-control/work-core.server";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";

const stageEnum = z.enum(["legal", "finance", "purchasing"]);
const decisionEnum = z.enum(["approved", "rejected"]);

// Default approval chain per contract role.
// provider (venda): legal → finance
// client   (compra): purchasing → finance → legal
export function defaultStagesForRole(
  role: "provider" | "client",
): Array<"legal" | "finance" | "purchasing"> {
  return role === "client" ? ["purchasing", "finance", "legal"] : ["legal", "finance"];
}

export const listContractApprovals = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.approvals", "view")])
  .inputValidator((input) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("contract_approvals")
      .select("*")
      .eq("contract_id", data.contractId)
      .is("superseded_at", null)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const listContractEvents = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.audit", "view")])
  .inputValidator((input) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("contract_events")
      .select("*")
      .eq("contract_id", data.contractId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

/**
 * Cria (ou recria) o fluxo de aprovações padrão para o contrato, baseado no seu role.
 * Se já existir aprovação pendente, apenas retorna as existentes (idempotente).
 * Muda o status do contrato para "in_review".
 */
export const startContractApprovals = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.approvals", "manage")])
  .inputValidator((input) =>
    z
      .object({
        contractId: z.string().uuid(),
        stages: z.array(stageEnum).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return workRpc<{
      started: boolean;
      approvals: import("@/integrations/supabase/types").Database["public"]["Tables"]["contract_approvals"]["Row"][];
    }>(context.supabase, "contract_approval_start", {
      p_contract: data.contractId,
      p_stages: data.stages ?? null,
      p_reset: false,
    });
  });

export const decideContractApproval = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.approvals", "approve")])
  .inputValidator((input) =>
    z
      .object({
        approvalId: z.string().uuid(),
        decision: decisionEnum,
        comment: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return workRpc<{ status: string; contractStatus: string | null }>(
      context.supabase,
      "contract_approval_decide",
      { p_approval: data.approvalId, p_decision: data.decision, p_comment: data.comment ?? null },
    );
  });

export const resetContractApprovals = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.approvals", "manage")])
  .inputValidator((input) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await workRpc(context.supabase, "contract_approval_start", {
      p_contract: data.contractId,
      p_stages: null,
      p_reset: true,
    });
    return { ok: true };
  });
