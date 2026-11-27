import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { emailSchema } from "@/lib/email-schema";

export type ContractAcceptanceEvidence = {
  id: string;
  source: "internal" | "public";
  clientName: string;
  acceptedAt: string;
  recordedAt: string;
  recordedByName?: string | null;
  evidence: string;
  contentHash: string;
  revokedAt: string | null;
  revokeReason: string | null;
};
export type ContractAcceptanceState = {
  contractId: string;
  currentHash: string;
  accepted: boolean;
  acceptance: ContractAcceptanceEvidence | null;
  history: ContractAcceptanceEvidence[];
  signaturePending: boolean;
  billingReleased: boolean;
  releaseBlocked: string | null;
  canRecord: boolean;
  canManageLinks: boolean;
  canReleaseBilling: boolean;
};
export type PublicContractAcceptance = {
  title: string;
  number: string | null;
  bodyHtml: string;
  workspaceName: string | null;
  counterpartyName: string | null;
  totalValue: number;
  currency: string;
  status: "pending" | "accepted";
  clientName: string | null;
  acceptedAt: string | null;
  expiresAt: string;
  startsAt: string | null;
  endsAt: string | null;
  paymentTerms: Json;
  services: Array<{
    name: string;
    description: string | null;
    type: string;
    quantity: number;
    unitPrice: number;
    currency: string;
  }>;
  attachments: Array<{ id: string; name: string; kind: "file" | "quote" | "proposal" }>;
};
const id = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const token = z.string().regex(/^[0-9a-f]{64}$/);
const contentHash = z.string().regex(/^[0-9a-f]{64}$/);
const reason = z.string().trim().min(10).max(4000);

// Every authenticated RPC revalidates active workspace, record scope, deny and the
// action-specific capability in SQL. No service-role fallback for an operator.
export const getContractAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ contractId: id }))
  .handler(async ({ context, data }) => {
    await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<ContractAcceptanceState>(context.supabase, "contract_commercial_state", {
      p_contract: data.contractId,
    });
  });

export const recordContractAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      contractId: id,
      acceptedAt: day,
      expectedHash: contentHash,
      clientName: z.string().trim().min(3).max(200),
      evidence: reason,
      reason: z.string().trim().max(4000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<ContractAcceptanceState>(context.supabase, "contract_commercial_record", {
      p_contract: data.contractId,
      p_accepted_at: data.acceptedAt,
      p_client_name: data.clientName,
      p_evidence: data.evidence,
      p_reason: data.reason ?? null,
      p_expected_hash: data.expectedHash,
    });
  });

export const createContractAcceptanceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ contractId: id }))
  .handler(async ({ context, data }) => {
    await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<{ token: string; expiresAt: string; path: string }>(
      context.supabase,
      "contract_commercial_issue_link",
      { p_contract: data.contractId },
    );
  });

export const revokeContractAcceptanceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ contractId: id, reason: reason.optional() }))
  .handler(async ({ context, data }) => {
    await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<ContractAcceptanceState>(context.supabase, "contract_commercial_revoke", {
      p_contract: data.contractId,
      p_reason: data.reason ?? "Link revogado pelo operador autorizado.",
      p_links_only: true,
    });
  });

export const revokeContractAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ contractId: id, reason }))
  .handler(async ({ context, data }) => {
    await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<ContractAcceptanceState>(context.supabase, "contract_commercial_revoke", {
      p_contract: data.contractId,
      p_reason: data.reason,
      p_links_only: false,
    });
  });

export const releaseContractAcceptanceBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ contractId: id, expectedHash: contentHash, dueDate: day.optional(), reason }),
  )
  .handler(async ({ context, data }) => {
    await getActiveWorkspaceId(context.supabase, context.userId);
    return workRpc<{ generated: number; duplicate: boolean; state: ContractAcceptanceState }>(
      context.supabase,
      "contract_commercial_release_billing",
      {
        p_contract: data.contractId,
        p_due_date: data.dueDate ?? null,
        p_reason: data.reason,
        p_expected_hash: data.expectedHash,
      },
    );
  });

// Public exceptions are finite, immutable version-bound DTOs behind a random
// 256-bit capability. SQL limits expiry, revocation, replay and issuer removal.
export const getPublicContractAcceptance = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return workRpc<PublicContractAcceptance | null>(
      supabaseAdmin,
      "contract_commercial_public_get",
      { p_token: data.token },
    );
  });

export const decidePublicContractAcceptance = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token,
      clientName: z.string().trim().min(3).max(200),
      clientEmail: emailSchema().optional(),
      accepted: z.literal(true),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return workRpc<{ accepted: true; acceptedAt: string; duplicate: boolean }>(
      supabaseAdmin,
      "contract_commercial_public_accept",
      {
        p_token: data.token,
        p_client_name: data.clientName,
        p_client_email: data.clientEmail ?? null,
      },
    );
  });
