import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkRecord, workRpc } from "@/lib/access-control/work-core.server";

// Supporting attachments reuse contract view/update; commercial references also
// require current source-record visibility in the database. No service-role reads.
export const CONTRACT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const CONTRACT_ATTACHMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "text/plain",
] as const;
export type ContractAttachment = {
  id: string;
  kind: "quote" | "proposal" | "file";
  source_id: string | null;
  name: string;
  created_at: string;
  frozen?: boolean;
};
export type ContractAttachmentSource = { id: string; kind: "quote" | "proposal"; title: string };
const contractInput = z.object({ contractId: z.string().uuid() });

export const listContractAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contractInput)
  .handler(async ({ data, context }) =>
    workRpc<ContractAttachment[]>(context.supabase, "contract_attachment_manage", {
      p_contract: data.contractId,
      p_action: "list",
      p_data: {},
    }),
  );
export const listContractAttachmentSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contractInput)
  .handler(async ({ data, context }) =>
    workRpc<ContractAttachmentSource[]>(context.supabase, "contract_attachment_manage", {
      p_contract: data.contractId,
      p_action: "sources",
      p_data: {},
    }),
  );
export const linkContractAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    contractInput.extend({ kind: z.enum(["quote", "proposal"]), sourceId: z.string().uuid() }),
  )
  .handler(async ({ data, context }) =>
    workRpc<{ ok: boolean }>(context.supabase, "contract_attachment_manage", {
      p_contract: data.contractId,
      p_action: "link",
      p_data: { kind: data.kind, source_id: data.sourceId },
    }),
  );
export const reserveContractAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    contractInput.extend({
      name: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .refine(
          (name) =>
            !name.includes("/") &&
            !name.includes("\\") &&
            [...name].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127),
          "Nome de arquivo inválido",
        ),
    }),
  )
  .handler(async ({ data, context }) =>
    workRpc<{ id: string; path: string }>(context.supabase, "contract_attachment_manage", {
      p_contract: data.contractId,
      p_action: "reserve",
      p_data: { name: data.name },
    }),
  );
export const finishContractAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contractInput.extend({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertWorkRecord(context.supabase, "techcontracts.contracts", data.contractId, "update");
    const { data: row, error } = await context.supabase
      .from("contract_attachments" as never)
      .select("storage_path")
      .eq("id", data.id)
      .eq("contract_id", data.contractId)
      .maybeSingle();
    const path = (row as { storage_path: string } | null)?.storage_path;
    if (error || !path) throw new Error("Anexo indisponível.");
    const file = await context.supabase.storage.from("contract-attachments").download(path);
    if (file.error || !file.data) throw new Error("Não foi possível validar o arquivo enviado.");
    if (file.data.size === 0 || file.data.size > CONTRACT_ATTACHMENT_MAX_BYTES)
      throw new Error("Arquivo excede o limite.");
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256")
      .update(new Uint8Array(await file.data.arrayBuffer()))
      .digest("hex");
    return workRpc<{ ok: boolean }>(context.supabase, "contract_attachment_manage", {
      p_contract: data.contractId,
      p_action: "finish",
      p_data: { id: data.id, sha256 },
    });
  });
export const removeContractAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contractInput.extend({ id: z.string().uuid() }))
  .handler(async ({ data, context }) =>
    workRpc<{ ok: boolean }>(context.supabase, "contract_attachment_manage", {
      p_contract: data.contractId,
      p_action: "remove",
      p_data: { id: data.id },
    }),
  );
export const downloadContractAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contractInput.extend({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertWorkRecord(context.supabase, "techcontracts.contracts", data.contractId, "view");
    // Use the caller's RLS client for both metadata and the short-lived URL.
    const { data: row, error } = await context.supabase
      .from("contract_attachments" as never)
      .select("storage_path,file_name,ready,source_snapshot_path,source_name")
      .eq("id", data.id)
      .eq("contract_id", data.contractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const file = row as {
      storage_path: string | null;
      file_name: string;
      ready: boolean;
      source_snapshot_path: string | null;
      source_name: string | null;
    } | null;
    if (file?.ready && file.source_snapshot_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const frozen = await supabaseAdmin.storage
        .from("contract-signature-packages")
        .createSignedUrl(file.source_snapshot_path, 60, {
          download: `${file.source_name ?? "Anexo"}.pdf`,
        });
      if (frozen.error || !frozen.data) throw new Error("Cópia do anexo indisponível.");
      return { url: frozen.data.signedUrl };
    }
    if (!file?.ready || !file.storage_path) throw new Error("Anexo indisponível.");
    const { data: signed, error: signError } = await context.supabase.storage
      .from("contract-attachments")
      .createSignedUrl(file.storage_path, 60, { download: file.file_name });
    if (signError || !signed) throw new Error(signError?.message ?? "Arquivo indisponível.");
    return { url: signed.signedUrl };
  });

export const previewContractSignaturePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contractInput)
  .handler(async ({ data, context }) => {
    const { getActiveWorkspaceId } = await import("@/lib/access-control/enforce.server");
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    const signature = await workRpc<{ hash: string; hiring_origin?: boolean }>(
      context.supabase,
      "hiring_contract_signature_context",
      { p_ws: ws, p_contract: data.contractId },
    );
    const { prepareSignaturePackage } = await import("./signature-package.server");
    const pack = await prepareSignaturePackage(
      context.supabase,
      context.userId,
      data.contractId,
      signature.hash,
    );
    if (!pack) {
      if (!signature.hiring_origin)
        throw new Error("Inclua ao menos um anexo para gerar a prévia do pacote.");
      const current = await workRpc<{ workspace_id: string; body: string }>(
        context.supabase,
        "contract_attachment_signing_context",
        { p_contract: data.contractId, p_hash: signature.hash },
      );
      const { contractHtmlToPdf } = await import("@/lib/integrations/forsign/forsign-pdf");
      const bytes = await contractHtmlToPdf(current.body, "Prévia do instrumento");
      await workRpc(context.supabase, "contract_attachment_signing_context", {
        p_contract: data.contractId,
        p_hash: signature.hash,
      });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { randomUUID } = await import("node:crypto");
      const path = `${current.workspace_id}/${data.contractId}/${signature.hash}/preview-${randomUUID()}.pdf`;
      const bucket = supabaseAdmin.storage.from("contract-signature-packages");
      const uploaded = await bucket.upload(path, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploaded.error) throw new Error("Não foi possível guardar a prévia privada.");
      await workRpc(context.supabase, "contract_attachment_signing_context", {
        p_contract: data.contractId,
        p_hash: signature.hash,
      });
      const preview = await bucket.createSignedUrl(path, 60, {
        download: "Previa-instrumento.pdf",
      });
      if (preview.error || !preview.data) throw new Error("Prévia indisponível.");
      return { url: preview.data.signedUrl };
    }
    await workRpc(context.supabase, "contract_attachment_signing_context", {
      p_contract: data.contractId,
      p_hash: signature.hash,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.storage
      .from("contract-signature-packages")
      .createSignedUrl(pack.storage_path, 60, { download: "Previa-contrato-e-anexos.pdf" });
    if (result.error || !result.data) throw new Error("Não foi possível abrir a prévia do pacote.");
    return { url: result.data.signedUrl };
  });

export const getContractAttachmentPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(contractInput)
  .handler(async ({ data, context }) =>
    workRpc<{ hiring_origin: boolean; can_preview: boolean }>(
      context.supabase,
      "hiring_attachment_policy",
      { k: data.contractId },
    ),
  );
