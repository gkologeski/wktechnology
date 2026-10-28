import { downloadCloudMedia } from "./cloud-runtime.server";
// Baixa mídia recebida pelo gateway e guarda no armazenamento privado.
import { INBOUND_MEDIA_TYPES, MAX_INBOUND_MEDIA_BYTES, audioSource } from "./inbound-media";

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
  const cloud = m._cloud_phone_number_id
    ? await downloadCloudMedia(msg.workspace_id, m._cloud_phone_number_id, media.id)
    : null;
  let info: { url?: string; mime_type?: string; file_size?: number };
  let dl: Response;
  if (cloud) {
    info = cloud.info;
    dl = cloud.response;
  } else {
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
    info = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!info.url) throw new Error("Mídia sem endereço");
    if (info.file_size && info.file_size > MAX_INBOUND_MEDIA_BYTES)
      throw new Error("Arquivo maior que 16 MB");
    dl = await fetch(`${GATEWAY_URL}/media_download`, {
      headers: { ...h, "X-WhatsApp-Media-URL": info.url },
    });
    if (!dl.ok) throw new Error(`Download [${dl.status}]: ${await dl.text()}`);
  }
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

export const AUDIO_PLACEHOLDER = "🎤 Áudio";
const STT_MODEL = "openai/gpt-transcribe";
const MAX_AUDIO_BYTES = 14 * 1024 * 1024;

/** Lê o SSE da transcrição e devolve o texto final. */
async function readTranscript(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let buf = "";
  let deltas = "";
  let done = "";
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data) as { type?: string; delta?: string; text?: string };
        if (ev.type === "transcript.text.delta" && ev.delta) deltas += ev.delta;
        if (ev.type === "transcript.text.done" && ev.text) done = ev.text;
      } catch {
        /* fragmento incompleto */
      }
    }
  }
  return (done || deltas).trim();
}

/**
 * Transcreve áudios recebidos da conversa que ainda estão só com o marcador
 * "🎤 Áudio". Grava a transcrição no corpo; falha definitiva grava aviso para
 * a Lia pedir que o cliente escreva. Erro transitório lança (o turno tenta de novo).
 */
export async function ensureAudioTranscripts(
  admin: Admin,
  conversationId: string,
  limit = 2,
): Promise<number> {
  const { data } = await admin
    .from("whatsapp_messages")
    .select("id, workspace_id, raw, body")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .eq("body", AUDIO_PLACEHOLDER)
    .order("created_at", { ascending: false })
    .limit(limit);
  let n = 0;
  for (const row of data ?? []) {
    const media = row.raw?.audio;
    const lov = process.env.LOVABLE_API_KEY;
    if (!media?.id || !lov) continue;
    const setBody = (body: string) =>
      admin
        .from("whatsapp_messages")
        .update({ body })
        .eq("id", row.id)
        .eq("body", AUDIO_PLACEHOLDER);
    // Mesma origem usada para guardar a mídia: Meta direta quando a mensagem
    // veio por ela; senão, Conector Lovable.
    const cloudId = row.raw?._cloud_phone_number_id as string | undefined;
    let info: { url?: string; mime_type?: string; file_size?: number };
    let dl: Response;
    if (audioSource(row.raw) === "cloud" && cloudId) {
      const cloud = await downloadCloudMedia(row.workspace_id, cloudId, media.id).catch(() => null);
      if (!cloud || (cloud.info.file_size && cloud.info.file_size > MAX_AUDIO_BYTES)) {
        await setBody(`${AUDIO_PLACEHOLDER} (não foi possível transcrever)`);
        continue;
      }
      info = cloud.info;
      dl = cloud.response;
    } else {
      const h = headers();
      const metaRes = await fetch(`${GATEWAY_URL}/media/${encodeURIComponent(media.id)}`, {
        headers: h,
      });
      if (metaRes.status === 404 || metaRes.status === 400) {
        await setBody(`${AUDIO_PLACEHOLDER} (não foi possível transcrever)`);
        continue;
      }
      if (!metaRes.ok) throw new Error(`Mídia [${metaRes.status}]: ${await metaRes.text()}`);
      info = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
      if (!info.url || (info.file_size && info.file_size > MAX_AUDIO_BYTES)) {
        await setBody(`${AUDIO_PLACEHOLDER} (não foi possível transcrever)`);
        continue;
      }
      dl = await fetch(`${GATEWAY_URL}/media_download`, {
        headers: { ...h, "X-WhatsApp-Media-URL": info.url },
      });
      if (!dl.ok) throw new Error(`Download [${dl.status}]: ${await dl.text()}`);
    }
    const bytes = await readLimited(dl);
    const mime = (info.mime_type || media.mime_type || "audio/ogg").split(";")[0];
    const form = new FormData();
    form.append("model", STT_MODEL);
    form.append(
      "file",
      new Blob([bytes as BlobPart], { type: mime }),
      `audio.${mime.includes("ogg") ? "ogg" : "mp3"}`,
    );
    form.append("response_format", "json");
    form.append("stream", "true");
    form.append("languages", "pt");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lov}` },
      body: form,
    });
    if (res.status === 429 || res.status >= 500)
      throw new Error(`Transcrição [${res.status}]: ${await res.text()}`);
    if (!res.ok) {
      console.error("[whatsapp-audio] transcrição recusada", res.status, await res.text());
      await setBody(`${AUDIO_PLACEHOLDER} (não foi possível transcrever)`);
      continue;
    }
    const text = await readTranscript(res);
    await setBody(
      text
        ? `${AUDIO_PLACEHOLDER}: "${text.slice(0, 3000)}"`
        : `${AUDIO_PLACEHOLDER} (não foi possível transcrever)`,
    );
    n++;
  }
  return n;
}
