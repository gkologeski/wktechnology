// Baixa mídia recebida pelo gateway e guarda no armazenamento privado.
import { INBOUND_MEDIA_TYPES, MAX_INBOUND_MEDIA_BYTES } from "./inbound-media";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";
const BUCKET = "whatsapp-media";
const SIGNED_TTL = 60 * 60 * 24 * 365;

type Admin = any;

function headers() {
  const lov = process.env.LOVABLE_API_KEY;
  const wa = process.env.WHATSAPP_API_KEY;
  if (!lov || !wa) throw new Error("Conexão WhatsApp não configurada");
  return { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": wa };
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Arquivo vazio");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_INBOUND_MEDIA_BYTES) {
      await reader.cancel();
      throw new Error("Arquivo maior que 16 MB");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

/** Retorna "unavailable" quando a Meta não tem mais o arquivo. */
export async function storeInboundMedia(
  admin: Admin,
  msg: { id: string; workspace_id: string; raw: any },
): Promise<"stored" | "unavailable" | "skip"> {
  const m = msg.raw;
  if (!m || !(INBOUND_MEDIA_TYPES as readonly string[]).includes(m.type)) return "skip";
  const media = m[m.type];
  if (!media?.id) return "skip";
  const h = headers();
  const metaRes = await fetch(`${GATEWAY_URL}/media/${encodeURIComponent(media.id)}`, {
    headers: h,
  });
  if (metaRes.status === 404 || metaRes.status === 400) {
    await admin
      .from("whatsapp_messages")
      .update({ media_url: "unavailable", media_content_type: media.mime_type ?? null })
      .eq("id", msg.id);
    return "unavailable";
  }
  if (!metaRes.ok) throw new Error(`Mídia [${metaRes.status}]: ${await metaRes.text()}`);
  const info = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url) throw new Error("Mídia sem endereço");
  if (info.file_size && info.file_size > MAX_INBOUND_MEDIA_BYTES)
    throw new Error("Arquivo maior que 16 MB");
  const dl = await fetch(`${GATEWAY_URL}/media_download`, {
    headers: { ...h, "X-WhatsApp-Media-URL": info.url },
  });
  if (!dl.ok) throw new Error(`Download [${dl.status}]: ${await dl.text()}`);
  const bytes = await readLimited(dl);
  const contentType =
    info.mime_type ||
    media.mime_type ||
    dl.headers.get("content-type") ||
    "application/octet-stream";
  const safe = String(media.filename ?? `${m.type}`)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const path = `${msg.workspace_id}/in/${msg.id}-${safe}`;
  const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (up.error) throw new Error(up.error.message);
  const signed = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (signed.error || !signed.data?.signedUrl) throw new Error("Falha ao gerar link do arquivo");
  const { error } = await admin
    .from("whatsapp_messages")
    .update({ media_url: signed.data.signedUrl, media_content_type: contentType })
    .eq("id", msg.id);
  if (error) throw new Error(error.message);
  return "stored";
}

/** Recupera mídias recebidas ainda sem arquivo (limitado para caber no prazo). */
export async function processPendingInboundMedia(admin: Admin, limit = 3, workspaceId?: string) {
  let q = admin
    .from("whatsapp_messages")
    .select("id, workspace_id, raw")
    .eq("direction", "inbound")
    .is("media_url", null)
    .in("raw->>type", INBOUND_MEDIA_TYPES as unknown as string[])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data } = await q;
  const out: Record<string, number> = { stored: 0, unavailable: 0, failed: 0 };
  for (const row of data ?? []) {
    try {
      const r = await storeInboundMedia(admin, row);
      if (r !== "skip") out[r]++;
    } catch (e) {
      out.failed++;
      console.error("[whatsapp-media] falha", (e as Error).message);
    }
  }
  return out;
}
