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

/** Autorização no banco, como o usuário; só aceita caminho do próprio usuário. */
export async function requestNoteUploadPath(
  rpc: UploadPathRpc,
  userId: string,
  fileName: string,
): Promise<string> {
  const { data: path, error } = await rpc("shared_storage_upload_path", {
    b: "notes-attachments",
    file_name: fileName,
  });
  if (error) throw new Error(error.message);
  if (typeof path !== "string" || !path.startsWith(`${userId}/`)) {
    throw new Error("Caminho de upload inválido.");
  }
  return path;
}

export async function uploadAuthorizedNoteAttachment(
  rpc: UploadPathRpc,
  storage: AttachmentStorage,
  userId: string,
  input: NoteAttachmentInput,
): Promise<{ path: string; size: number }> {
  const path = await requestNoteUploadPath(rpc, userId, input.name);
  const bytes = decodeBase64(input.base64);
  const { error: upErr } = await storage.upload(path, bytes, {
    contentType: input.type || "application/octet-stream",
  });
  if (upErr) {
    throw new Error(`Não foi possível enviar o anexo ${input.name}. Tente novamente.`);
  }
  return { path, size: bytes.length };
}
