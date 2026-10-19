import {
  PERSON_PHOTO_BUCKET,
  PERSON_PHOTO_MAX_BYTES,
  canAutoReplacePhoto,
  isAcceptedPhotoType,
  photoPath,
  type PersonEntity,
} from "./person-photo";

/** Lê o corpo com corte no limite, sem bufferizar respostas sem tamanho. */
async function readLimited(res: Response, limit: number): Promise<Uint8Array | null> {
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len && len > limit) return null;
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/**
 * Baixa a foto de perfil devolvida pelo enriquecimento e grava uma cópia privada.
 * Retorna o caminho no bucket ou null quando a imagem não é válida/acessível.
 */
export async function storeRemotePersonPhoto(
  workspaceId: string,
  entity: PersonEntity,
  id: string,
  url: string,
): Promise<string | null> {
  if (!/^https:\/\//i.test(url)) return null;
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const type = res.headers.get("content-type");
  if (!isAcceptedPhotoType(type)) return null;
  const bytes = await readLimited(res, PERSON_PHOTO_MAX_BYTES);
  if (!bytes?.byteLength) return null;
  const ext = type!.includes("png") ? "png" : type!.includes("webp") ? "webp" : "jpg";
  const path = photoPath(workspaceId, entity, id, ext);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from(PERSON_PHOTO_BUCKET)
    .upload(path, bytes, { contentType: type!.split(";")[0], upsert: true });
  return error ? null : path;
}

/**
 * Aplica a foto do LinkedIn a um Contato/Lead usando o cliente do usuário (RLS).
 * Não faz nada quando já existe foto manual. Falhas não interrompem o enriquecimento.
 */
export async function applyLinkedinPhoto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  entity: PersonEntity,
  id: string,
  url: string,
): Promise<boolean> {
  try {
    const table = entity === "contact" ? "contacts" : "leads";
    const { data: row } = await supabase
      .from(table)
      .select("photo_source")
      .eq("id", id)
      .maybeSingle();
    if (!row || !canAutoReplacePhoto(row.photo_source)) return false;
    const path = await storeRemotePersonPhoto(workspaceId, entity, id, url);
    if (!path) return false;
    const { data } = await supabase
      .from(table)
      .update({
        photo_url: path,
        photo_source: "linkedin",
        photo_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");
    return !!data?.length;
  } catch {
    return false;
  }
}
