import { createHash } from "node:crypto";
import { workRpc } from "@/lib/access-control/work-core.server";

type AttachmentContext = {
  attachmentId: string;
  kind: "file" | "quote" | "proposal";
  fileName: string;
  bucket: "contract-attachments" | "contract-signature-packages" | null;
  storagePath: string | null;
  sha256: string | null;
  sourceId: string | null;
  workspaceId: string;
  contentHash: string;
};
export type AcceptanceAttachmentDependencies = {
  authorize: (token: string, attachmentId: string) => Promise<AttachmentContext | null>;
  download: (bucket: string, path: string) => Promise<Uint8Array>;
  render: (
    kind: "quote" | "proposal",
    sourceId: string,
    workspaceId: string,
  ) => Promise<Uint8Array>;
};
const unavailable = () => new Error("Anexo indisponível ou link de aceite inválido.");
async function dependencies(): Promise<AcceptanceAttachmentDependencies> {
  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
  return {
    authorize: (token, attachmentId) =>
      workRpc<AttachmentContext | null>(sb, "contract_commercial_public_attachment", {
        p_token: token,
        p_attachment: attachmentId,
      }),
    download: async (bucket, path) => {
      const result = await sb.storage.from(bucket).download(path);
      if (result.error || !result.data) throw unavailable();
      return new Uint8Array(await result.data.arrayBuffer());
    },
    render: async (kind, sourceId, workspaceId) => {
      const browserlessToken = process.env.BROWSERLESS_TOKEN;
      if (!browserlessToken) throw new Error("Serviço de geração de PDF não configurado.");
      if (kind === "quote") {
        const { data, error } = await sb
          .from("quotes")
          .select("workspace_id")
          .eq("id", sourceId)
          .maybeSingle();
        if (error || data?.workspace_id !== workspaceId) throw unavailable();
        const { renderQuotePdf } = await import("./quote-pdf.server");
        return renderQuotePdf(sb, sourceId, browserlessToken);
      }
      const { loadProposalDocument } = await import("@/lib/proposals/proposal-document.server");
      const { renderProposalPdf } = await import("./proposal-pdf.server");
      const { data, error } = await sb
        .from("proposals")
        .select("workspace_id")
        .eq("id", sourceId)
        .maybeSingle();
      if (error || data?.workspace_id !== workspaceId) throw unavailable();
      const doc = await loadProposalDocument(sb, { id: sourceId });
      return renderProposalPdf(doc, browserlessToken);
    },
  };
}

/** Read only. Recheck the same live capability before and after privileged I/O. */
export async function loadContractAcceptanceAttachment(
  token: string,
  attachmentId: string,
  injected?: AcceptanceAttachmentDependencies,
): Promise<{ bytes: Uint8Array; fileName: string; contentType: string }> {
  if (
    !/^[0-9a-f]{64}$/.test(token) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attachmentId)
  )
    throw unavailable();
  const deps = injected ?? (await dependencies());
  const first = await deps.authorize(token, attachmentId);
  if (!first || first.attachmentId !== attachmentId) throw unavailable();
  let bytes: Uint8Array;
  if (first.bucket && first.storagePath && first.sha256) {
    bytes = await deps.download(first.bucket, first.storagePath);
    if (createHash("sha256").update(bytes).digest("hex") !== first.sha256) throw unavailable();
  } else if (!first.bucket && first.sourceId && first.kind !== "file") {
    bytes = await deps.render(first.kind, first.sourceId, first.workspaceId);
  } else throw unavailable();
  if (bytes.length === 0 || bytes.length > 50 * 1024 * 1024) throw unavailable();
  const final = await deps.authorize(token, attachmentId);
  if (!final || JSON.stringify(final) !== JSON.stringify(first)) throw unavailable();
  return {
    bytes,
    fileName: first.fileName,
    contentType: first.kind === "file" ? "application/octet-stream" : "application/pdf",
  };
}
