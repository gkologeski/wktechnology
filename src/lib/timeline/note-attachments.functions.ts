import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Envia um anexo de nota/atividade pelo servidor. A autorização continua no
 * banco: `shared_storage_upload_path` roda como o usuário (RLS/permissões) e
 * devolve o único caminho permitido; só então o arquivo é gravado nesse
 * caminho. Evita o envio direto do navegador, que esgotava o tempo do banco.
 */
export const uploadNoteAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(255),
        type: z.string().max(200),
        base64: z.string().min(1).max(28_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data: path, error } = await rpc.call(context.supabase, "shared_storage_upload_path", {
      b: "notes-attachments",
      file_name: data.name,
    });
    if (error) throw new Error(error.message);
    if (typeof path !== "string" || !path) throw new Error("Caminho de upload inválido.");
    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("notes-attachments")
      .upload(path, bytes, { contentType: data.type || "application/octet-stream" });
    if (upErr) {
      console.error("note attachment upload failed", upErr.message);
      throw new Error(`Não foi possível enviar o anexo ${data.name}. Tente novamente.`);
    }
    return { path, size: bytes.length };
  });
