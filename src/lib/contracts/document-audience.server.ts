import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";

export type ContractDocumentAudience = "internal" | "client" | "supplier" | "technical_shared";
export type ContractDocumentAudienceContext = {
  audience: "client" | "supplier";
  content_hash: string;
  attachments: Array<{
    id: string;
    audience: ContractDocumentAudience;
    commercial_sensitive: boolean;
  }>;
};

/** Revalidate the caller and the live audience even when reusing a cached PDF.
 * The database owns the audience decision; source-sale JSON is never projected. */
export async function assertContractDocumentAudience(
  client: SupabaseClient,
  contractId: string,
  contentHash?: string,
): Promise<ContractDocumentAudienceContext> {
  const result = await workRpc<ContractDocumentAudienceContext>(
    client,
    "contract_attachment_audience_check",
    { p_contract: contractId, p_hash: contentHash ?? null },
  );
  if (
    !result ||
    !["client", "supplier"].includes(result.audience) ||
    !/^[a-f0-9]{64}$/.test(result.content_hash) ||
    !Array.isArray(result.attachments) ||
    (contentHash !== undefined && result.content_hash !== contentHash)
  )
    throw new Error("Contrato ou público dos anexos indisponível. Recarregue.");
  return result;
}

/** An internal read requires its own live economic-content permission. This
 * check intentionally does not approve an unclassified file for sharing. */
export async function assertAttachmentDocumentAccess(
  client: SupabaseClient,
  contractId: string,
  attachmentId: string,
): Promise<void> {
  const allowed = await workRpc<boolean>(client, "contract_attachment_access_check", {
    p_contract: contractId,
    p_attachment: attachmentId,
  });
  if (allowed !== true) throw new Error("Anexo indisponível.");
}
