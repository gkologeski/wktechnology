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
  .handler(async ({ data, context }) =>
    workRpc<{ ok: boolean }>(context.supabase, "contract_attachment_manage", {
      p_contract: data.contractId,
      p_action: "finish",
      p_data: { id: data.id },
    }),
  );
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
      .select("storage_path,file_name,ready")
      .eq("id", data.id)
      .eq("contract_id", data.contractId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const file = row as { storage_path: string | null; file_name: string; ready: boolean } | null;
    if (!file?.ready || !file.storage_path) throw new Error("Anexo indisponível.");
    const { data: signed, error: signError } = await context.supabase.storage
      .from("contract-attachments")
      .createSignedUrl(file.storage_path, 60, { download: file.file_name });
    if (signError || !signed) throw new Error(signError?.message ?? "Arquivo indisponível.");
    return { url: signed.signedUrl };
  });
