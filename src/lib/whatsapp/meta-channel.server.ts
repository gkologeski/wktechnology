// Canal único de WhatsApp: conexão WhatsApp Business do Lovable.
// Resolve o número conectado do workspace, envia texto/mídia/template e
// marca mensagens como lidas. Não há mais envio via Twilio.
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  WA_NOT_CONNECTED_MESSAGE,
  gatewayConfigured,
  gatewayFetch,
  getConnectedPhone,
} from "@/lib/whatsapp/gateway-channel.server";

export { WA_NOT_CONNECTED_MESSAGE };

export type WaNumber = {
  phoneNumberId: string;
  displayPhoneNumber: string;
};

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function toDigits(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/** Substitui variáveis posicionais {{1}}, {{2}}… */
export function applyPositionalTemplate(body: string, vars: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => vars[Number(n) - 1] ?? "");
}

/**
 * Resolve o número conectado pela conexão WhatsApp Business do Lovable.
 * Parâmetros mantidos por compatibilidade com os chamadores.
 */
export async function resolveWaNumber(
  _workspaceId?: string,
  _preferredPhoneNumberId?: string | null,
): Promise<WaNumber> {
  if (!gatewayConfigured()) throw new Error(WA_NOT_CONNECTED_MESSAGE);
  const info = await getConnectedPhone();
  return {
    phoneNumberId: info.id,
    displayPhoneNumber: normalizePhone(info.display_phone_number),
  };
}

export type WaSendPayload = {
  to: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaContentType?: string | null;
  template?: { name: string; language?: string; variables?: string[] } | null;
  contextMessageId?: string | null;
};

function mediaKind(contentType?: string | null): "image" | "audio" | "video" | "document" {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("audio/")) return "audio";
  if (ct.startsWith("video/")) return "video";
  return "document";
}

/** Envia pela Cloud API e devolve o identificador da mensagem (wamid). */
export async function metaSend(
  num: WaNumber,
  payload: WaSendPayload,
): Promise<{ wamid: string | null; raw: any }> {
  const to = toDigits(payload.to);
  let body: any;

  if (payload.template) {
    const vars = payload.template.variables ?? [];
    body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: payload.template.name,
        language: { code: payload.template.language || "pt_BR" },
        components: vars.length
          ? [{ type: "body", parameters: vars.map((t) => ({ type: "text", text: t })) }]
          : [],
      },
    };
  } else if (payload.mediaUrl) {
    const kind = mediaKind(payload.mediaContentType);
    body = {
      messaging_product: "whatsapp",
      to,
      type: kind,
      [kind]: {
        link: payload.mediaUrl,
        ...(payload.body && kind !== "audio" ? { caption: payload.body } : {}),
      },
    };
  } else {
    if (!payload.body || !payload.body.trim()) throw new Error("Mensagem vazia");
    body = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: payload.body, preview_url: true },
    };
  }

  if (payload.contextMessageId) body.context = { message_id: payload.contextMessageId };

  void num;
  const res = await gatewayFetch("/messages", { method: "POST", body: JSON.stringify(body) });
  return { wamid: (res?.messages?.[0]?.id as string) ?? null, raw: res };
}

/** Marca uma mensagem recebida como lida na Meta (métricas corretas). */
export async function metaMarkRead(num: WaNumber, wamid: string): Promise<void> {
  void num;
  await gatewayFetch("/messages", {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: wamid }),
  });
}

/** Janela de atendimento de 24h a partir da última mensagem recebida. */
export function isWithinServiceWindow(lastInboundAt: string | null | undefined): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000;
}

/** Número da Meta já usado na conversa deste telefone, se houver. */
export async function findConversationNumber(
  supabase: SupabaseClient,
  workspaceId: string,
  phoneE164: string,
): Promise<{ phoneNumberId: string | null; lastInboundAt: string | null } | null> {
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("wa_phone_number_id, last_inbound_at")
    .eq("workspace_id", workspaceId)
    .eq("contact_phone", phoneE164)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    phoneNumberId: (data.wa_phone_number_id as string) ?? null,
    lastInboundAt: (data.last_inbound_at as string) ?? null,
  };
}
