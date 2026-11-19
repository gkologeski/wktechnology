import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { LEGACY_EVIDENCE_MAX_BYTES, isPdfBytes, type LegacyRegularizeInput } from "./legacy-types";
import type { LegacyState } from "./legacy-view";

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

const DENIED = /Sem permissão|somente leitura|Sessão obrigatória/;
function decodePdf(base64: string): Uint8Array {
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Leitura: só "denied" quando a própria RPC negou; demais falhas propagam para a tela mostrar erro. */
export async function loadLegacyState(db: SupabaseClient, workspaceId: string, contractId: string) {
  try {
    return {
      access: "granted" as const,
      state: (await legacyContractState(db, workspaceId, contractId)) as unknown as LegacyState,
    };
  } catch (e) {
    if (DENIED.test((e as Error).message)) return { access: "denied" as const };
    throw e;
  }
}

/** Reserva pelo usuário (RPC autoriza); só o caminho devolvido segue para gravação/atestado privilegiados. */
export async function uploadLegacyEvidence(
  db: SupabaseClient,
  actorId: string,
  workspaceId: string,
  input: {
    contractId: string;
    expectedRevision: number;
    fileName: string;
    base64: string;
    operationId: string;
  },
) {
  const bytes = decodePdf(input.base64);
  if (bytes.length < 5 || bytes.length > LEGACY_EVIDENCE_MAX_BYTES || !isPdfBytes(bytes))
    throw new Error("Envie o PDF do original assinado (até 5 MB). DOCX de minuta não é evidência.");
  const { sha256Hex, storeAndAttestLegacyEvidence } = await import("./legacy-evidence.server");
  const sha256 = await sha256Hex(bytes);
  const reserved = await reserveLegacyEvidence(db, {
    workspaceId,
    contractId: input.contractId,
    expectedRevision: input.expectedRevision,
    fileName: input.fileName,
    size: bytes.length,
    sha256,
    operationId: input.operationId,
  });
  const state = await legacyContractState(db, workspaceId, input.contractId);
  const evidence = (state as unknown as LegacyState).evidence.find(
    (x) => x.id === reserved.evidence_id,
  );
  if (evidence?.status === "pending_upload")
    await storeAndAttestLegacyEvidence({
      workspaceId,
      evidenceId: reserved.evidence_id,
      actorId,
      path: reserved.path,
      bytes,
      expectedSha256: sha256,
    });
  return { evidenceId: reserved.evidence_id, sha256, replayed: reserved.replayed };
}

/** Download curto: a RPC do usuário autoriza e devolve o caminho; o servidor só assina a URL por 60 s. */
export async function openLegacyEvidence(
  db: SupabaseClient,
  workspaceId: string,
  contractId: string,
  evidenceId: string,
) {
  const opened = await workRpc<{ path: string; sha256: string; file_name: string }>(
    db,
    "contract_legacy_evidence_open",
    {
      w: workspaceId,
      p_contract: contractId,
      p_evidence: evidenceId,
    },
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const signed = await supabaseAdmin.storage
    .from("contract-signature-evidence")
    .createSignedUrl(opened.path, 60);
  if (signed.error || !signed.data) throw new Error("Não foi possível abrir o PDF privado.");
  return { url: signed.data.signedUrl, sha256: opened.sha256, fileName: opened.file_name };
}
