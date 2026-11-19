import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { LEGACY_EVIDENCE_MAX_BYTES, isPdfBytes } from "./legacy-types";

const LEGACY_EVIDENCE_BUCKET = "contract-signature-evidence";

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Internal only. The authenticated handler first calls `contract_legacy_evidence_reserve` with the user's
 * client (RLS/RPC authorization); only the path returned by that reservation reaches this helper.
 * The service client stores the bytes, re-reads them and confirms the hash through the service-only RPC,
 * which rechecks the uploader's current authority. A hash proves integrity, not external legal authentication.
 */
export async function storeAndAttestLegacyEvidence(input: {
  workspaceId: string;
  evidenceId: string;
  actorId: string;
  path: string;
  bytes: Uint8Array;
  expectedSha256: string;
}): Promise<void> {
  const { bytes } = input;
  if (bytes.length < 5 || bytes.length > LEGACY_EVIDENCE_MAX_BYTES || !isPdfBytes(bytes))
    throw new Error("Envie o PDF do original assinado (até 5 MB).");
  const sent = await sha256Hex(bytes);
  if (sent !== input.expectedSha256) throw new Error("Arquivo enviado difere do reservado.");
  const bucket = supabaseAdmin.storage.from(LEGACY_EVIDENCE_BUCKET);
  const put = await bucket.upload(input.path, bytes, {
    contentType: "application/pdf",
    upsert: false,
    metadata: { sha256: sent, actor_id: input.actorId, evidence_id: input.evidenceId },
  });
  if (put.error) throw new Error("Não foi possível guardar o PDF privado.");
  const back = await bucket.download(input.path);
  if (back.error) throw new Error("PDF privado indisponível para confirmação.");
  const reread = new Uint8Array(await back.data.arrayBuffer());
  if (reread.length !== bytes.length || (await sha256Hex(reread)) !== sent || !isPdfBytes(reread))
    throw new Error("Arquivo armazenado difere do enviado; envio interrompido.");
  await workRpc<void>(supabaseAdmin, "contract_legacy_evidence_attest", {
    w: input.workspaceId,
    p_evidence: input.evidenceId,
    p_actor: input.actorId,
    p_sha256: sent,
    p_size: reread.length,
  });
}
