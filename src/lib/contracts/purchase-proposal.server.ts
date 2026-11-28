import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { workRpc } from "@/lib/access-control/work-core.server";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import {
  compilePurchaseProposalDesign,
  renderPurchaseProposalHtml,
} from "./purchase-proposal-render";
import type {
  PurchaseProposalContext,
  PurchaseProposalDocument,
  PurchaseProposalSaveInput,
} from "./purchase-proposal.types";

export async function purchaseProposalContext(
  sb: SupabaseClient,
  contractId: string,
): Promise<PurchaseProposalContext> {
  return workRpc(sb, "purchase_proposal_context", { p_contract: contractId });
}

function requireDocument(context: PurchaseProposalContext, documentId: string) {
  const document = context.documents.find((row) => row.id === documentId);
  if (!context.canView || !context.isPurchase || !document)
    throw new Error("Proposta de compra indisponível ou sem permissão.");
  return document;
}

export async function savePurchaseProposal(sb: SupabaseClient, input: PurchaseProposalSaveInput) {
  const context = await purchaseProposalContext(sb, input.contractId);
  const template = context.templates.find((row) => row.id === input.templateId);
  if (!context.canManage || !context.parties || !context.contract || !template)
    throw new Error(context.blockedReason || "Sem permissão para preparar a proposta de compra.");
  if (context.contractHash !== input.expectedContractHash)
    throw new Error("O contrato mudou. Recarregue e confira os dados antes de salvar.");
  const version = Math.max(0, ...context.documents.map((row) => row.version));
  if (version !== input.expectedVersion)
    throw new Error("A proposta foi atualizada. Recarregue antes de salvar.");
  // Only finite purchase inputs + canonical purchase parties enter the native design.
  // No sale/deal/proposal query and no browser-supplied design or party snapshot.
  const design = compilePurchaseProposalDesign(template.design, input.data, context.parties, {
    version: version + 1,
    issuedOn: new Date().toISOString().slice(0, 10),
    currency: context.contract.currency,
  });
  return workRpc<PurchaseProposalDocument>(sb, "purchase_proposal_save", {
    p_contract: input.contractId,
    p_template: input.templateId,
    p_data: input.data,
    p_design: design,
    p_expected_version: input.expectedVersion,
    p_expected_contract_hash: input.expectedContractHash,
  });
}

/** Native visual PDF, using the existing renderer account. Never fall back to a sale PDF. */
export async function purchaseProposalPdf(
  document: PurchaseProposalDocument,
  workspaceLogoUrl?: string | null,
): Promise<Uint8Array> {
  const token = process.env.BROWSERLESS_TOKEN;
  if (!token)
    throw new Error("Configure a geração de PDF antes de conferir ou gerar a proposta de compra.");
  const response = await fetch(
    `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: renderPurchaseProposalHtml(document.design, workspaceLogoUrl),
        options: {
          format: "A4",
          landscape: false,
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        },
        viewport: { width: 900, height: 1400, deviceScaleFactor: 2 },
        emulateMediaType: "screen",
        gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
      }),
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!response.ok)
    throw new Error(`Não foi possível gerar a proposta visual (HTTP ${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    !bytes.length ||
    bytes.length > 20 * 1024 * 1024 ||
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  )
    throw new Error("O serviço não retornou um PDF válido para a proposta.");
  return bytes;
}

function sameDocument(current: PurchaseProposalDocument, before: PurchaseProposalDocument) {
  if (
    current.version !== before.version ||
    JSON.stringify(current.design) !== JSON.stringify(before.design)
  )
    throw new Error("A versão documental mudou durante a geração. Recarregue a proposta.");
}

export async function previewPurchaseProposalDocument(
  sb: SupabaseClient,
  userId: string,
  contractId: string,
  documentId: string,
) {
  const context = await purchaseProposalContext(sb, contractId);
  const document = requireDocument(context, documentId);
  const bytes = await purchaseProposalPdf(document, context.branding?.logoUrl);
  sameDocument(
    requireDocument(await purchaseProposalContext(sb, contractId), documentId),
    document,
  );
  const workspace = await getActiveWorkspaceId(sb, userId);
  const path = `${workspace}/${contractId}/purchase-preview-${randomUUID()}.pdf`;
  // Private ephemeral preview. No durable attachment, invitation, acceptance or financial entry.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = supabaseAdmin.storage.from("contract-signature-previews");
  const uploaded = await bucket.upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploaded.error) throw new Error("Não foi possível preparar a prévia privada.");
  try {
    sameDocument(
      requireDocument(await purchaseProposalContext(sb, contractId), documentId),
      document,
    );
    const signed = await bucket.createSignedUrl(path, 60);
    if (signed.error || !signed.data) throw new Error("Não foi possível abrir a prévia.");
    return {
      url: signed.data.signedUrl,
      name: `Proposta técnica — versão ${document.version}.pdf`,
    };
  } catch (error) {
    await bucket.remove([path]);
    throw error;
  }
}

export async function generatePurchaseProposalDocument(
  sb: SupabaseClient,
  input: {
    contractId: string;
    documentId: string;
    expectedVersion: number;
    expectedContractHash: string;
  },
) {
  const context = await purchaseProposalContext(sb, input.contractId);
  const document = requireDocument(context, input.documentId);
  if (
    !context.canGenerate ||
    context.contractHash !== input.expectedContractHash ||
    document.version !== input.expectedVersion
  )
    throw new Error(
      context.blockedReason || "Recarregue o contrato e confira a versão antes de gerar o anexo.",
    );
  if (document.status === "generated" && document.attachmentId)
    return { documentId: document.id, attachmentId: document.attachmentId };
  const prepared = await workRpc<{
    id: string;
    path: string;
    document: PurchaseProposalDocument;
    generated: boolean;
  }>(sb, "purchase_proposal_prepare", {
    p_contract: input.contractId,
    p_document: input.documentId,
  });
  if (prepared.generated) {
    if (!prepared.document.attachmentId)
      throw new Error(
        "O anexo desta versão foi removido. Preserve o histórico e salve uma nova revisão para anexar novamente.",
      );
    return { documentId: document.id, attachmentId: prepared.document.attachmentId };
  }
  sameDocument(prepared.document, document);
  const bucket = sb.storage.from("contract-attachments");
  // Recover this version's own upload after a lost finish response. Rendering again may
  // produce different PDF timestamps, so never overwrite the already reserved artifact.
  const previous = await bucket.download(prepared.path);
  let sha: string;
  if (previous.data && !previous.error) {
    const bytes = new Uint8Array(await previous.data.arrayBuffer());
    if (
      !bytes.length ||
      bytes.length > 20 * 1024 * 1024 ||
      new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
    )
      throw new Error("O arquivo reservado não contém um PDF válido.");
    sha = createHash("sha256").update(bytes).digest("hex");
  } else {
    const bytes = await purchaseProposalPdf(document, context.branding?.logoUrl);
    sha = createHash("sha256").update(bytes).digest("hex");
    const upload = await bucket.upload(prepared.path, bytes, {
      contentType: "application/pdf",
      upsert: false,
      metadata: { sha256: sha },
    });
    if (upload.error)
      throw new Error("Não foi possível gravar o PDF da proposta. Recarregue e tente novamente.");
  }
  await workRpc(sb, "purchase_proposal_finish", {
    p_contract: input.contractId,
    p_document: input.documentId,
    p_sha: sha,
  });
  return { documentId: document.id, attachmentId: prepared.id };
}
