import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { LegacyRegularizeInput } from "./legacy-types";

/**
 * LEGADO-REGULARIZA: user-path wrappers. Always called with the authenticated user's client
 * (`context.supabase`), so every decision runs in the definer RPCs as auth.uid() with active
 * membership, workspace, real contract access, specific key and deny precedence. Never use the
 * service client here. Server functions/UI arrive in a later batch.
 */
export function recognizeLegacyContract(
  db: SupabaseClient,
  input: {
    workspaceId: string;
    contractId: string;
    expectedRevision: number | null;
    reason: string;
    operationId: string;
  },
) {
  return workRpc<{ id: string; revision: number; status: string; replayed: boolean }>(
    db,
    "contract_legacy_recognize",
    {
      w: input.workspaceId,
      p_contract: input.contractId,
      p_expected_revision: input.expectedRevision,
      p_reason: input.reason,
      p_operation: input.operationId,
    },
  );
}
export function reserveLegacyEvidence(
  db: SupabaseClient,
  input: {
    workspaceId: string;
    contractId: string;
    expectedRevision: number;
    fileName: string;
    size: number;
    sha256: string;
    operationId: string;
  },
) {
  return workRpc<{ evidence_id: string; path: string; replayed: boolean }>(
    db,
    "contract_legacy_evidence_reserve",
    {
      w: input.workspaceId,
      p_contract: input.contractId,
      p_expected_revision: input.expectedRevision,
      p_file_name: input.fileName,
      p_size: input.size,
      p_sha256: input.sha256,
      p_operation: input.operationId,
    },
  );
}
export function regularizeLegacyContract(
  db: SupabaseClient,
  workspaceId: string,
  i: LegacyRegularizeInput,
) {
  return workRpc<{ id: string; revision: number; status: string; replayed: boolean }>(
    db,
    "contract_legacy_regularize",
    {
      w: workspaceId,
      p_contract: i.contractId,
      p_expected_revision: i.expectedRevision,
      p_situation: i.situation,
      p_signed_on: i.signedOn,
      p_signature_confirmed: i.signatureConfirmed,
      p_starts: i.startsOn,
      p_ends: i.endsOn,
      p_terminated_on: i.terminatedOn,
      p_auto_renew: i.autoRenew,
      p_auto_renew_confirmed: i.autoRenewConfirmed,
      p_evidence: i.evidenceId,
      p_evidence_sha256: i.evidenceSha256,
      p_external_reference: i.externalReference,
      p_reason: i.reason,
      p_operation: i.operationId,
    },
  );
}
export function legacyContractState(db: SupabaseClient, workspaceId: string, contractId: string) {
  return workRpc<Record<string, unknown>>(db, "contract_legacy_state", {
    w: workspaceId,
    p_contract: contractId,
  });
}
