import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { emailSchema } from "@/lib/email-schema";
import { getPublicAppUrl } from "@/lib/app-url";
type Attempt = { id: string; signer_id: string; status: string };
/** Caller RPC authorizes contract, active workspace, send scope and current evidence before any service read/effect. */
export async function dispatchContractSignature(
  caller: SupabaseClient,
  input: { contractId: string; hash: string; documentId: string; requestId: string },
  deps: {
    admin: () => Promise<SupabaseClient>;
    send: (to: string, data: Record<string, unknown>, key: string) => Promise<{ sent: boolean }>;
  },
) {
  const proof = await workRpc<{ workspace_id: string; deliveries: Attempt[] }>(
    caller,
    "contract_esign_request",
    {
      p_contract: input.contractId,
      p_hash: input.hash,
      p_document: input.documentId,
      p_request: input.requestId,
    },
  );
  if (!proof.workspace_id || !Array.isArray(proof.deliveries))
    throw new Error("Não foi possível autorizar o envio.");
  const result = { accepted: 0, suppressed: 0, failed: 0 };
  if (!proof.deliveries.length) return result;
  const admin = await deps.admin();
  // Service access is restricted to the exact row ids returned by the caller-authorized claim.
  const sb = admin as any;
  const [{ data: rows, error }, { data: doc, error: de }, { data: workspace, error: we }] =
    await Promise.all([
      sb
        .from("contract_esign_deliveries")
        .select("id,signer_id,status")
        .eq("workspace_id", proof.workspace_id)
        .eq("contract_id", input.contractId)
        .eq("document_id", input.documentId)
        .in(
          "id",
          proof.deliveries.map((x) => x.id),
        ),
      sb
        .from("esign_documents")
        .select("title,status,expires_at")
        .eq("workspace_id", proof.workspace_id)
        .eq("id", input.documentId)
        .single(),
      sb.from("workspaces").select("name").eq("id", proof.workspace_id).single(),
    ]);
  if (error || de || we || !doc || !["sent", "partially_signed"].includes(doc.status))
    throw new Error("Não foi possível conferir o documento autorizado.");
  if (rows?.length !== proof.deliveries.length)
    throw new Error("Não foi possível conferir os convites autorizados.");
  const { data: signers, error: se } = await sb
    .from("esign_signers")
    .select("id,name,email,public_token,status")
    .eq("workspace_id", proof.workspace_id)
    .eq("document_id", input.documentId)
    .in(
      "id",
      proof.deliveries.map((x) => x.signer_id),
    );
  if (se) throw new Error("Não foi possível consultar os destinatários autorizados.");
  for (const row of rows ?? []) {
    if (row.status === "accepted") {
      result.accepted++;
      continue;
    }
    if (row.status === "suppressed") {
      result.suppressed++;
      continue;
    }
    const s = signers?.find((s: any) => s.id === row.signer_id);
    if (!s || !["pending", "viewed"].includes(s.status)) continue;
    let status = "failed";
    try {
      const email = emailSchema(255).parse(s.email);
      if (!s.public_token) throw new Error("Signatário sem link.");
      await workRpc(caller, "hiring_formalization_signature_gate", {
        w: proof.workspace_id,
        k: input.contractId,
        h: input.hash,
      });
      const sent = await deps.send(
        email,
        {
          signerName: s.name,
          documentTitle: doc.title,
          workspaceName: workspace.name,
          signUrl: `${getPublicAppUrl()}/sign/${encodeURIComponent(s.public_token)}`,
        },
        `contract-signature:${row.id}`,
      );
      status = sent.sent ? "accepted" : "suppressed";
    } catch {
      status = "failed";
    }
    const { error: saveError } = await sb
      .from("contract_esign_deliveries")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("workspace_id", proof.workspace_id)
      .eq("document_id", input.documentId);
    if (saveError)
      throw new Error(
        "Não foi possível confirmar o resultado do envio. Tente novamente com a mesma solicitação; os convites são deduplicados.",
      );
    result[status as keyof typeof result]++;
  }
  return result;
}
