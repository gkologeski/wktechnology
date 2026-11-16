import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { randomUUID } from "node:crypto";
import { assembleSignaturePackage, sha256, type PackagePart } from "./signature-package-pdf.server";

type Context = {
  workspace_id: string;
  body: string;
  attachments: Array<
    Omit<PackagePart, "bytes" | "mime"> & {
      storage_path: string | null;
      source_snapshot_path: string | null;
      source_snapshot_sha256: string | null;
    }
  >;
};
export type SignaturePackage = {
  id: string;
  workspace_id: string;
  contract_id: string;
  contract_hash: string;
  storage_path: string;
  sha256: string;
  page_count: number;
  manifest: Array<{ name: string; sha256: string }>;
};

/** Privileged storage is used only after the caller's live signing/source gates.
 * Both ends of rendering recheck the same current contract + source fingerprint. */
export async function prepareSignaturePackage(
  sb: SupabaseClient,
  userId: string,
  contractId: string,
  hash: string,
): Promise<SignaturePackage | null> {
  const context = await workRpc<Context>(sb, "contract_attachment_signing_context", {
    p_contract: contractId,
    p_hash: hash,
  });
  if (context.attachments.length === 0) return null;
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data: existing, error: existingError } = await admin
    .from("contract_signature_packages" as never)
    .select("*")
    .eq("workspace_id", context.workspace_id)
    .eq("contract_id", contractId)
    .eq("contract_hash", hash)
    .maybeSingle();
  if (existingError) throw new Error("Não foi possível consultar o pacote de assinatura.");
  if (existing) return existing as SignaturePackage;
  const parts: PackagePart[] = [];
  const token = process.env.BROWSERLESS_TOKEN;
  for (const attachment of context.attachments) {
    let bytes: Uint8Array,
      mime = "application/pdf";
    if (attachment.kind === "file") {
      if (!attachment.storage_path) throw new Error("Arquivo do anexo indisponível.");
      const file = await sb.storage.from("contract-attachments").download(attachment.storage_path);
      if (file.error || !file.data)
        throw new Error(`Não foi possível carregar o anexo ${attachment.name}.`);
      bytes = new Uint8Array(await file.data.arrayBuffer());
      mime = file.data.type;
    } else if (attachment.source_snapshot_path) {
      const frozen = await admin.storage
        .from("contract-signature-packages")
        .download(attachment.source_snapshot_path);
      if (frozen.error || !frozen.data)
        throw new Error(`Cópia congelada indisponível: ${attachment.name}`);
      bytes = new Uint8Array(await frozen.data.arrayBuffer());
      if (sha256(bytes) !== attachment.source_snapshot_sha256)
        throw new Error(`Integridade da cópia congelada inválida: ${attachment.name}`);
    } else {
      if (!token)
        throw new Error(
          "Configure o serviço de geração de PDF antes de enviar cotações e propostas para assinatura.",
        );
      if (!attachment.source_id) throw new Error("Documento comercial indisponível.");
      if (attachment.kind === "quote") {
        const { renderQuotePdf } = await import("./quote-pdf.server");
        bytes = await renderQuotePdf(sb, attachment.source_id, token);
      } else {
        const { loadProposalDocument } = await import("@/lib/proposals/proposal-document.server");
        const { renderProposalPdf } = await import("./proposal-pdf.server");
        bytes = await renderProposalPdf(
          await loadProposalDocument(sb, { id: attachment.source_id }),
          token,
        );
      }
    }
    parts.push({ ...attachment, bytes, mime });
  }
  const pack = await assembleSignaturePackage(context.body, parts, token);
  await workRpc(sb, "contract_attachment_signing_context", {
    p_contract: contractId,
    p_hash: hash,
  });
  const bucket = admin.storage.from("contract-signature-packages");
  const sourcePaths: string[] = [];
  try {
    for (let i = 0; i < context.attachments.length; i++) {
      const attachment = context.attachments[i];
      if (attachment.kind === "file") continue;
      if (attachment.source_snapshot_path) {
        Object.assign(pack.manifest[i], { source_pdf_path: attachment.source_snapshot_path });
        continue;
      }
      const sourcePath = `${context.workspace_id}/${contractId}/${hash}/${attachment.id}-${randomUUID()}.pdf`;
      const copied = await bucket.upload(sourcePath, parts[i].bytes, {
        contentType: "application/pdf",
        upsert: false,
        metadata: { sha256: pack.manifest[i].sha256 },
      });
      if (copied.error) throw new Error("Não foi possível congelar um anexo comercial.");
      sourcePaths.push(sourcePath);
      Object.assign(pack.manifest[i], { source_pdf_path: sourcePath });
    }
  } catch (error) {
    if (sourcePaths.length) await bucket.remove(sourcePaths);
    throw error;
  }
  const path = `${context.workspace_id}/${contractId}/${hash}/${randomUUID()}.pdf`;
  const upload = await bucket.upload(path, pack.bytes, {
    contentType: "application/pdf",
    upsert: false,
    metadata: { sha256: pack.sha256, contract_hash: hash },
  });
  if (upload.error) {
    if (sourcePaths.length) await bucket.remove(sourcePaths);
    throw new Error("Não foi possível guardar o pacote com anexos. Nenhum convite foi enviado.");
  }
  try {
    const stored = await workRpc<SignaturePackage>(admin, "contract_signature_package_store", {
      p_ws: context.workspace_id,
      p_contract: contractId,
      p_actor: userId,
      p_hash: hash,
      p_path: path,
      p_sha: pack.sha256,
      p_manifest: pack.manifest,
      p_pages: pack.pageCount,
    });
    if (stored.storage_path !== path) await bucket.remove([path, ...sourcePaths]);
    return stored;
  } catch (error) {
    await bucket.remove([path, ...sourcePaths]);
    throw error;
  }
}
export async function loadPackageBytes(pack: SignaturePackage) {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const file = await admin.storage.from("contract-signature-packages").download(pack.storage_path);
  if (file.error || !file.data) throw new Error("Pacote de assinatura indisponível.");
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  if (sha256(bytes) !== pack.sha256)
    throw new Error("A integridade do pacote de assinatura não pôde ser confirmada.");
  return bytes;
}

/** Called only after contract_esign_public validates the secret signer token.
 * SHA in the sealed body binds the PDF; no arbitrary file or contract ID input. */
export async function signerSignaturePackage(
  doc: { id: string; body: string },
  workspaceId: string,
) {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data: evidence, error } = await admin
    .from("hiring_contract_evidence")
    .select("contract_id,contract_hash")
    .eq("workspace_id", workspaceId)
    .eq("document_id", doc.id)
    .eq("kind", "native")
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar os anexos da assinatura.");
  if (!evidence) {
    if (doc.body.includes("<!--techerp:contract-package:"))
      throw new Error("Pacote de assinatura revogado ou indisponível.");
    return null;
  }
  const { data: row, error: packError } = await admin
    .from("contract_signature_packages" as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("contract_id", evidence.contract_id)
    .eq("contract_hash", evidence.contract_hash)
    .maybeSingle();
  if (packError) throw new Error("Não foi possível verificar o pacote de assinatura.");
  if (!row) {
    if (doc.body.includes("<!--techerp:contract-package:"))
      throw new Error("Pacote de assinatura indisponível.");
    return null;
  }
  const pack = row as SignaturePackage;
  if (!doc.body.includes(`<!--techerp:contract-package:${pack.id}:${pack.sha256}-->`))
    throw new Error("O pacote não corresponde ao documento de assinatura.");
  // Package bytes and metadata are immutable to public/authenticated callers.
  // Avoid downloading the entire (up to 50 MB) PDF on every signer page view.
  const { data: signed, error: signError } = await admin.storage
    .from("contract-signature-packages")
    .createSignedUrl(pack.storage_path, 60, { download: "Contrato-e-anexos.pdf" });
  if (signError || !signed) throw new Error("Pacote de assinatura indisponível.");
  return {
    url: signed.signedUrl,
    sha256: pack.sha256,
    pageCount: pack.page_count,
    attachments: pack.manifest.length,
  };
}
