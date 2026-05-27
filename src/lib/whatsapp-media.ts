import { supabase } from "@/integrations/supabase/client";

const BUCKET = "whatsapp-media";

export const MAX_WA_MEDIA_BYTES = 16 * 1024 * 1024; // 16MB (limite WhatsApp)

export async function uploadWhatsAppMedia(file: File): Promise<{
  url: string;
  contentType: string;
}> {
  if (file.size > MAX_WA_MEDIA_BYTES) {
    throw new Error("Arquivo maior que 16MB (limite do WhatsApp)");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/out/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
  // Bucket é privado: gera URL assinada de 24h (Twilio busca a mídia no envio).
  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "Falha ao gerar URL da mídia");
  return { url: signed.signedUrl, contentType: file.type || "application/octet-stream" };
}

export type WaMediaKind = "image" | "audio" | "video" | "pdf" | "file";

export function classifyMedia(contentType?: string | null, url?: string | null): WaMediaKind {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("audio/")) return "audio";
  if (ct.startsWith("video/")) return "video";
  if (ct.includes("pdf")) return "pdf";
  const u = (url || "").toLowerCase();
  if (/\.(png|jpe?g|webp|gif)$/.test(u)) return "image";
  if (/\.(mp3|ogg|wav|amr|m4a)$/.test(u)) return "audio";
  if (/\.(mp4|webm|mov)$/.test(u)) return "video";
  if (/\.pdf$/.test(u)) return "pdf";
  return "file";
}
