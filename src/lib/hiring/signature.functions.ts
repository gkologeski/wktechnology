import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { emailSchema } from "@/lib/email-schema";
import type { SignatureContext } from "./signature.types";
const id = z.string().uuid();
const contract = z.object({ contractId: id });
const version = contract.extend({ hash: z.string().regex(/^[a-f0-9]{64}$/) });
export const getContractSignature = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contract)
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techcontracts.signature_evidence.view.workspace",
    );
    return workRpc<SignatureContext>(context.supabase, "hiring_contract_signature_context", {
      p_ws: ws,
      p_contract: data.contractId,
    });
  });
export const prepareContractSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    version.extend({
      customerName: z.string().trim().min(2).max(255),
      customerEmail: emailSchema(255),
      issuerName: z.string().trim().min(2).max(255),
      issuerEmail: emailSchema(255),
    }),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techcontracts.signature_evidence.manage.workspace",
    );
    return workRpc<string>(context.supabase, "hiring_contract_native_prepare", {
      p_ws: ws,
      p_contract: data.contractId,
      p_hash: data.hash,
      p_customer_name: data.customerName,
      p_customer_email: data.customerEmail,
      p_issuer_name: data.issuerName,
      p_issuer_email: data.issuerEmail,
    });
  });
export const attestExternalSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    version.extend({
      pdf: z.string().min(8).max(7_000_000),
      signedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reference: z.string().trim().min(3).max(500),
      note: z.string().trim().min(20).max(2000),
      confirmed: z.literal(true),
    }),
  )
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techcontracts.signature_evidence.manage.workspace",
    );
    // Authorization before decoding/uploading; never accepts a caller-provided path, URL or digest.
    const proof = await workRpc<SignatureContext>(
      context.supabase,
      "hiring_contract_signature_context",
      { p_ws: ws, p_contract: data.contractId },
    );
    if (!proof.can_manage || proof.hash !== data.hash)
      throw new Error("Sem permissão ou contrato alterado. Recarregue.");
    const bytes = Buffer.from(data.pdf, "base64");
    if (bytes.length > 5 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("Selecione um PDF de até 5 MB.");
    const { createHash, randomUUID } = await import("node:crypto");
    const sha = createHash("sha256").update(bytes).digest("hex");
    const path = `${ws}/${data.contractId}/${randomUUID()}.pdf`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from("contract-signature-evidence");
    const { error } = await bucket.upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
      metadata: { sha256: sha, contract_hash: data.hash, actor_id: context.userId },
    });
    if (error) throw new Error("Não foi possível guardar o PDF assinado.");
    // Do not delete on ambiguous commit failure: a successfully recorded evidence may reference this object.
    return workRpc<string>(context.supabase, "hiring_contract_external_attest", {
      p_ws: ws,
      p_contract: data.contractId,
      p_hash: data.hash,
      p_path: path,
      p_file_hash: sha,
      p_signed_on: data.signedOn,
      p_reference: data.reference,
      p_note: data.note,
    });
  });
export const revokeContractEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ evidenceId: id, note: z.string().trim().min(10).max(2000) }))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techcontracts.signature_evidence.manage.workspace",
    );
    await workRpc(context.supabase, "hiring_contract_evidence_revoke", {
      p_ws: ws,
      p_evidence: data.evidenceId,
      p_note: data.note,
    });
  });
export const selectCommercialContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contract)
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techcontracts.signature_evidence.manage.workspace",
    );
    await workRpc(context.supabase, "hiring_contract_select_commercial", {
      p_ws: ws,
      p_contract: data.contractId,
    });
  });
export const saveContractHiringOrigin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(version.extend({ dealId: id, entityId: id }))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techcontracts.signature_evidence.manage.workspace",
    );
    await workRpc(context.supabase, "hiring_contract_origin_save", {
      p_ws: ws,
      p_contract: data.contractId,
      p_hash: data.hash,
      p_deal: data.dealId,
      p_entity: data.entityId,
    });
  });
export const getSignedContractEvidenceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ evidenceId: id }))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    await assertPermission(
      context.supabase,
      context.userId,
      ws,
      "techcontracts.signature_evidence.view.workspace",
    );
    const { data: row, error } = await context.supabase
      .from("hiring_contract_evidence" as never)
      .select("file_path")
      .eq("id", data.evidenceId)
      .eq("workspace_id", ws)
      .maybeSingle();
    const path = (row as { file_path?: string } | null)?.file_path;
    if (error || !path) throw new Error("Comprovante indisponível no seu acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error: linkError } = await supabaseAdmin.storage
      .from("contract-signature-evidence")
      .createSignedUrl(path, 300);
    if (linkError || !link?.signedUrl) throw new Error("Não foi possível abrir o PDF.");
    return link.signedUrl;
  });
