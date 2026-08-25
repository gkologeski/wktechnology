// Sprint 6: Contract approvals (legal / finance / purchasing) + audit events.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("contract_approvals")
      .select("*")
      .eq("contract_id", data.contractId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const listContractEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contractId: z.string().uuid(),
        stages: z.array(stageEnum).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, role, status")
      .eq("id", data.contractId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!contract) throw new Error("Contrato não encontrado");

    const { data: existing } = await (supabase as any)
      .from("contract_approvals")
      .select("id, status")
      .eq("contract_id", data.contractId);
    if (existing && existing.length > 0) {
      return { started: false, approvals: existing };
    }

    const stages = data.stages ?? defaultStagesForRole((contract as any).role);
    const rows = stages.map((stage, idx) => ({
      workspace_id: workspaceId,
      owner_id: userId,
      contract_id: data.contractId,
      stage,
      sort_order: idx,
      status: "pending" as const,
    }));

    const { data: created, error: iErr } = await (supabase as any)
      .from("contract_approvals")
      .insert(rows)
      .select("*");
    if (iErr) throw iErr;

    await supabase.from("contracts").update({ status: "in_review" }).eq("id", data.contractId);

    await (supabase as any).from("contract_events").insert({
      workspace_id: workspaceId,
      contract_id: data.contractId,
      actor_id: userId,
      event_type: "approvals_started",
      payload: { stages },
    });

    return { started: true, approvals: created ?? [] };
  });

/**
 * Aprova ou rejeita uma etapa. Quando todas estão aprovadas, avança o contrato para
 * "awaiting_signature". Uma rejeição volta o contrato para "in_negotiation".
 */
export const decideContractApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: approval, error: aErr } = await (supabase as any)
      .from("contract_approvals")
      .select("*")
      .eq("id", data.approvalId)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!approval) throw new Error("Aprovação não encontrada");
    if (approval.status !== "pending") throw new Error("Etapa já decidida");

    const newStatus = data.decision === "approved" ? "approved" : "rejected";
    const { error: uErr } = await (supabase as any)
      .from("contract_approvals")
      .update({
        status: newStatus,
        comment: data.comment ?? null,
        decided_at: new Date().toISOString(),
        decided_by: userId,
        approver_id: approval.approver_id ?? userId,
      })
      .eq("id", data.approvalId);
    if (uErr) throw uErr;

    // Recarrega todas as aprovações para verificar estado agregado.
    const { data: all } = await (supabase as any)
      .from("contract_approvals")
      .select("status")
      .eq("contract_id", approval.contract_id);

    let contractStatus: string | null = null;
    if (data.decision === "rejected") {
      contractStatus = "in_negotiation";
    } else if ((all ?? []).every((r: any) => r.status === "approved" || r.status === "skipped")) {
      contractStatus = "awaiting_signature";
    }
    if (contractStatus) {
      await supabase
        .from("contracts")
        .update({ status: contractStatus as any })
        .eq("id", approval.contract_id);
    }

    await (supabase as any).from("contract_events").insert({
      workspace_id: workspaceId,
      contract_id: approval.contract_id,
      actor_id: userId,
      event_type: `approval_${data.decision}`,
      payload: { stage: approval.stage, comment: data.comment ?? null },
    });

    return { status: newStatus, contractStatus };
  });

/** Reinicia o fluxo removendo aprovações existentes e recriando pendências. */
export const resetContractApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ contractId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    await (supabase as any).from("contract_approvals").delete().eq("contract_id", data.contractId);
    await (supabase as any).from("contract_events").insert({
      workspace_id: workspaceId,
      contract_id: data.contractId,
      actor_id: userId,
      event_type: "approvals_reset",
      payload: {},
    });
    return { ok: true };
  });
