import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { z } from "zod";
import { requestKind } from "./types";
import { opsDay as day, opsId as id } from "./operations-types";
import { payInstallment, type PayContext } from "./payables-types";

const hash = z.string().regex(/^[0-9a-f]{64}$/);
const keys = z.array(z.string().min(3).max(120)).min(1).max(50);

export const getPayables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ kind: requestKind, id, month: day.nullable() }))
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<PayContext>(context.supabase, "hiring_payable_context", {
      w,
      i: data.id,
      p_month: data.month,
    });
  });

export const generatePayables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      month: day,
      previewHash: hash,
      keys,
      installments: z.array(payInstallment).min(1).max(24),
      documentId: id.nullable(),
      justification: z.string().trim().min(10).max(2000),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_payable_generate", {
      w,
      i: data.id,
      p_month: data.month,
      p_preview_hash: data.previewHash,
      p_keys: data.keys,
      p_installments: data.installments,
      p_document: data.documentId,
      p_justification: data.justification,
      p_operation: data.operation,
    });
  });

export const reconcilePayable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: requestKind,
      id,
      month: day,
      targetId: id,
      decision: z.enum(["linked", "unrelated"]),
      previewHash: hash.nullable(),
      keys: z.array(z.string().min(3).max(120)).max(50),
      documentId: id.nullable(),
      reason: z.string().trim().min(10).max(2000),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_payable_reconcile", {
      w,
      i: data.id,
      p_month: data.month,
      p_target: data.targetId,
      p_decision: data.decision,
      p_preview_hash: data.previewHash,
      p_keys: data.keys,
      p_document: data.documentId,
      p_reason: data.reason,
      p_operation: data.operation,
    });
  });

export const registerClientAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: z.literal("supplier"),
      id,
      deliveryId: id,
      version: z.number().int().positive(),
      hash,
      targetKind: z.enum(["project", "commercial_contract", "deal"]),
      targetId: id,
      name: z.string().trim().min(3).max(200),
      role: z.string().trim().min(2).max(120),
      acceptedOn: day,
      evidence: z.string().trim().min(5).max(500),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_client_acceptance_register", {
      w,
      i: data.id,
      p_delivery: data.deliveryId,
      p_version: data.version,
      p_hash: data.hash,
      p_target_kind: data.targetKind,
      p_target: data.targetId,
      p_name: data.name,
      p_role: data.role,
      p_on: data.acceptedOn,
      p_evidence: data.evidence,
      p_operation: data.operation,
    });
  });

export const decideClientAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: z.literal("supplier"),
      id,
      acceptanceId: id,
      hash,
      decision: z.enum(["confirmed", "rejected"]),
      reason: z.string().trim().min(5).max(2000),
      operation: id,
    }),
  )
  .handler(async ({ context, data }) => {
    const w = await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<string>(context.supabase, "hiring_client_acceptance_decide", {
      w,
      i: data.id,
      p_acceptance: data.acceptanceId,
      p_hash: data.hash,
      p_decision: data.decision,
      p_reason: data.reason,
      p_operation: data.operation,
    });
  });
