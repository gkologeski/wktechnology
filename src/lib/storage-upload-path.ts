import { supabase } from "@/integrations/supabase/client";

/** The database binds pending attachments to the current actor and workspace. */
export async function requestStorageUploadPath(
  bucket: "ats-cvs" | "notes-attachments" | "email-attachments",
  fileName: string,
): Promise<string> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  ).call(supabase, "shared_storage_upload_path", { b: bucket, file_name: fileName });
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) throw new Error("Caminho de upload inválido.");
  return data;
}
