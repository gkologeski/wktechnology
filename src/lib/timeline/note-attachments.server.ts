// Envio de anexo de nota/atividade autorizado pelo banco como o usuário.
// `shared_storage_upload_path` (RLS/permissões: membro ativo, workspace ativo,
// view+create em notas/tarefas/atividades, deny prevalece) devolve o único
// caminho permitido; só então o arquivo é gravado nesse caminho.

export type UploadPathRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export type AttachmentStorage = {
  upload: (
    path: string,
    bytes: Uint8Array,
    opts: { contentType: string },
  ) => Promise<{ error: { message: string } | null }>;
};

export type NoteAttachmentInput = { name: string; type: string; base64: string };

export function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function uploadAuthorizedNoteAttachment(
  rpc: UploadPathRpc,
  storage: AttachmentStorage,
  userId: string,
  input: NoteAttachmentInput,
): Promise<{ path: string; size: number }> {
  const { data: path, error } = await rpc("shared_storage_upload_path", {
    b: "notes-attachments",
    file_name: input.name,
  });
  if (error) throw new Error(error.message);
  // O caminho precisa ser do próprio usuário; qualquer outro é recusado.
  if (typeof path !== "string" || !path.startsWith(`${userId}/`)) {
    throw new Error("Caminho de upload inválido.");
  }
  const bytes = decodeBase64(input.base64);
  const { error: upErr } = await storage.upload(path, bytes, {
    contentType: input.type || "application/octet-stream",
  });
  if (upErr) {
    console.error("note attachment upload failed", upErr.message);
    throw new Error(`Não foi possível enviar o anexo ${input.name}. Tente novamente.`);
  }
  return { path, size: bytes.length };
}
