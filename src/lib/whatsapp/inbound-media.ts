// Texto de exibição de mensagens recebidas que não são texto puro (sem servidor).

export const INBOUND_MEDIA_TYPES = ["image", "audio", "video", "document", "sticker"] as const;
export const MAX_INBOUND_MEDIA_BYTES = 16 * 1024 * 1024;

const LABELS: Record<string, string> = {
  image: "🖼 Imagem",
  audio: "🎤 Áudio",
  video: "🎬 Vídeo",
  document: "📎 Documento",
  sticker: "Figurinha",
};

/** Converte qualquer mensagem da Meta em texto legível (lista, histórico e Lia). */
export function inboundBody(m: any): string {
  if (!m || typeof m !== "object") return "";
  if (m.type === "text") return m.text?.body ?? "";
  if (m.type === "button") return m.button?.text ?? "";
  if (m.type === "interactive")
    return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
  if (m.type === "reaction")
    return m.reaction?.emoji ? `Reagiu com ${m.reaction.emoji}` : "Reação removida";
  if (m.type === "location") {
    const l = m.location ?? {};
    const name = [l.name, l.address].filter(Boolean).join(" — ");
    const link =
      typeof l.latitude === "number" && typeof l.longitude === "number"
        ? `https://maps.google.com/?q=${l.latitude},${l.longitude}`
        : "";
    return ["📍 Localização", name, link].filter(Boolean).join("\n");
  }
  if (m.type === "contacts") {
    const list = (m.contacts ?? []).map((c: any) => {
      const n = c?.name?.formatted_name ?? "Contato";
      const p = (c?.phones ?? [])
        .map((x: any) => x?.phone)
        .filter(Boolean)
        .join(", ");
      return p ? `${n}: ${p}` : n;
    });
    return ["👤 Contato compartilhado", ...list].join("\n");
  }
  const label = LABELS[m.type];
  if (label) {
    const media = m[m.type] ?? {};
    const head = m.type === "document" && media.filename ? `${label}: ${media.filename}` : label;
    return media.caption ? `${head}\n${media.caption}` : head;
  }
  if (m.type === "unsupported") return "Mensagem não suportada pelo WhatsApp";
  return `Mensagem do tipo ${m.type ?? "desconhecido"}`;
}

/** Corpo antigo "[tipo] legenda" gravado antes desta versão. */
export function isLegacyPlaceholder(body: string | null | undefined): boolean {
  return /^\[(image|audio|video|document|sticker|location|contacts|reaction|unsupported)\]/.test(
    body ?? "",
  );
}

/** Origem para baixar a mídia: Meta direta (número Cloud) ou Conector Lovable. */
export function audioSource(raw: any): "cloud" | "gateway" {
  return raw && typeof raw._cloud_phone_number_id === "string" && raw._cloud_phone_number_id
    ? "cloud"
    : "gateway";
}
