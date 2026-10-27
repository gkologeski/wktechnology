import { resolveCloudNumber, sendCloudPayload } from "./cloud-runtime.server";
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
  provider?: "cloud";
  workspaceId?: string;
  connectionId?: string;
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
  workspaceId?: string,
  preferredPhoneNumberId?: string | null,
): Promise<WaNumber> {
  if (workspaceId && preferredPhoneNumberId) {
    const cloud = await resolveCloudNumber(workspaceId, preferredPhoneNumberId);
    if (cloud) return cloud;
  }
  if (!gatewayConfigured()) throw new Error(WA_NOT_CONNECTED_MESSAGE);
  const info = await getConnectedPhone();
  if (preferredPhoneNumberId && preferredPhoneNumberId !== info.id)
    throw new Error(
      "O número desta conversa não está conectado. Não é permitido trocar o remetente automaticamente.",
    );
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
  /** Nome exibido do documento anexado. */
  fileName?: string | null;
  template?: {
    name: string;
    language?: string;
    variables?: string[];
    /** Variáveis do cabeçalho de texto do modelo. */
    headerVariables?: string[];
    /** Link do cabeçalho de mídia (imagem, vídeo ou documento). */
    headerMediaUrl?: string | null;
    headerMediaContentType?: string | null;
  } | null;

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
    const headVars = payload.template.headerVariables ?? [];
    const headMedia = payload.template.headerMediaUrl ?? null;
    const components: any[] = [];
    if (headVars.length)
      components.push({
        type: "header",
        parameters: headVars.map((t) => ({ type: "text", text: t })),
      });
    else if (headMedia) {
      const kind = mediaKind(payload.template.headerMediaContentType ?? payload.mediaContentType);
      components.push({
        type: "header",
        parameters: [{ type: kind, [kind]: { link: headMedia } }],
      });
    }
    if (vars.length)
      components.push({ type: "body", parameters: vars.map((t) => ({ type: "text", text: t })) });
    body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: payload.template.name,
        language: { code: payload.template.language || "pt_BR" },
        components,
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

  if (num.provider === "cloud") {
    if (!num.workspaceId) throw new Error("Workspace do remetente ausente.");
    const res = await sendCloudPayload(num.workspaceId, num.phoneNumberId, body);
    return { wamid: (res?.messages?.[0]?.id as string) ?? null, raw: res };
  }
  const res = await gatewayFetch("/messages", { method: "POST", body: JSON.stringify(body) });
  return { wamid: (res?.messages?.[0]?.id as string) ?? null, raw: res };
}

/** Marca uma mensagem recebida como lida na Meta (métricas corretas). */
export async function metaMarkRead(num: WaNumber, wamid: string): Promise<void> {
  if (num.provider === "cloud") {
    if (!num.workspaceId) throw new Error("Workspace do remetente ausente.");
    await sendCloudPayload(num.workspaceId, num.phoneNumberId, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: wamid,
    });
    return;
  }
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

/**
 * Conversa que define a janela de 24 h: a indicada (se for do workspace) ou,
 * pelo telefone, a com recebimento mais recente — considerando o celular
 * brasileiro com e sem o nono dígito.
 */
export async function findConversationNumber(
  supabase: SupabaseClient,
  workspaceId: string,
  phoneE164: string,
  conversationId?: string | null,
): Promise<{ phoneNumberId: string | null; lastInboundAt: string | null } | null> {
  const { brPhoneVariants, pickWindowConversation } = await import("./phone-variants");
  type Row = {
    wa_phone_number_id: string | null;
    last_inbound_at: string | null;
    last_message_at: string | null;
  };
  if (conversationId) {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("wa_phone_number_id, last_inbound_at, last_message_at")
      .eq("workspace_id", workspaceId)
      .eq("id", conversationId)
      .in("contact_phone", brPhoneVariants(phoneE164))
      .maybeSingle();
    if (data) {
      const row = data as Row;
      return { phoneNumberId: row.wa_phone_number_id ?? null, lastInboundAt: row.last_inbound_at };
    }
    throw new Error("Conversa indisponível para este destinatário.");
  }
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("wa_phone_number_id, last_inbound_at, last_message_at")
    .eq("workspace_id", workspaceId)
    .in("contact_phone", brPhoneVariants(phoneE164))
    .limit(20);
  const best = pickWindowConversation((data ?? []) as Row[]);
  if (!best) return null;
  return {
    phoneNumberId: best.wa_phone_number_id ?? null,
    lastInboundAt: best.last_inbound_at ?? null,
  };
}
