import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Envia um anexo de nota/atividade pelo servidor, autorizado pelo banco como o usuário. */
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
    const { uploadAuthorizedNoteAttachment } = await import("./note-attachments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = (name: string, args: Record<string, unknown>) =>
      (
        context.supabase.rpc as unknown as (
          n: string,
          a: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>
      ).call(context.supabase, name, args);
    const bucket = supabaseAdmin.storage.from("notes-attachments");
    return uploadAuthorizedNoteAttachment(
      rpc,
      { upload: (path, bytes, opts) => bucket.upload(path, bytes, opts) },
      context.userId,
      data,
    );
  });
