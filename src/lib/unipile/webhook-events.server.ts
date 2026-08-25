// Normalização de eventos de webhook da Unipile (v1 e v2).
//
// v1: o payload traz `status`/`event`/`type` e vem "gordo" (sender, texto,
// name = connect_token que enviávamos no hosted auth).
//
// v2: o payload traz `event_type` (ex.: "account.connected",
// "messaging.message_received") e é reduzido: normalmente só identificadores
// (account_id, chat_id, message_id, state) + timestamp. Quando faltam dados
// da mensagem, hidratamos via GET /v2/{account_id}/messages/{message_id}.
//
// Server-only.

export type UnipileWebhookKind =
  | "account_connected"
  | "account_failed"
  | "account_disconnected"
  | "message_received"
  | "unknown";

export interface NormalizedUnipileEvent {
  /** Categoria canônica usada pelo handler. */
  kind: UnipileWebhookKind;
  /** event_type (v2) ou status/event/type (v1), cru, para auditoria. */
  eventType: string;
  /** ID da conta no Unipile. */
  unipileAccountId: string | null;
  /**
   * Correlação com o registro local:
   * v1 => `name` (connect_token); v2 => `state` do hosted auth.
   */
  connectToken: string | null;
  error: string | null;
  /** Presente quando kind === "message_received". */
  message: {
    messageId: string | null;
    chatId: string | null;
    senderProviderId: string | null;
    text: string | null;
    /** true quando a mensagem partiu da própria conta conectada (echo). */
    isSelfSent: boolean;
    /** true quando o payload não trouxe sender/texto (v2 reduzido). */
    needsHydration: boolean;
  } | null;
}

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function classify(eventType: string): UnipileWebhookKind {
  const e = eventType.toLowerCase();
  if (!e) return "unknown";

  // --- Mensageria (v1 e v2) ---
  if (
    e.includes("message_received") ||
    e.includes("new_message") ||
    e === "message.received" ||
    e === "messaging.received" ||
    e === "messaging.message_received" ||
    e === "message"
  ) {
    return "message_received";
  }
  // v2 sinaliza envio/leitura com o mesmo prefixo — não são respostas.
  if (e.startsWith("message") || e.startsWith("messaging")) return "unknown";

  // --- Conta ---
  if (e.includes("disconnect")) return "account_disconnected";
  if (e.includes("credentials_invalid") || e.includes("credentials.invalid")) {
    return "account_disconnected";
  }
  if (e.includes("fail") || e.includes("invalid") || e.includes("error")) {
    return "account_failed";
  }
  if (e.includes("success") || e.includes("connected") || e === "account.created" || e === "ok") {
    return "account_connected";
  }
  return "unknown";
}

function isSelfSent(payload: any): boolean {
  const direction = str(payload?.direction ?? payload?.message?.direction).toLowerCase();
  const isSender = payload?.is_sender ?? payload?.message?.is_sender;
  return (
    isSender === true ||
    isSender === 1 ||
    isSender === "1" ||
    direction === "out" ||
    direction === "outgoing" ||
    payload?.sender?.is_self === true
  );
}

/**
 * Converte o payload cru da API v2 em um evento canônico.
 */
export function parseUnipileWebhook(payload: any): NormalizedUnipileEvent {
  const eventType =
    firstString(
      payload?.event_type, // v2
      payload?.event,
      payload?.type,
      payload?.status,
      payload?.account_status,
    ) ?? "";

  const kind = classify(eventType);

  const unipileAccountId = firstString(
    payload?.account_id,
    payload?.account?.id,
    payload?.data?.account_id,
  );

  const connectToken = firstString(
    payload?.state, // v2 (hosted auth `state`)
    payload?.connect_token,
    payload?.data?.state,
  );

  const error = firstString(
    payload?.error,
    payload?.error_message,
    payload?.reason,
    kind === "account_failed" || kind === "account_disconnected" ? payload?.message : undefined,
  );

  let message: NormalizedUnipileEvent["message"] = null;
  if (kind === "message_received") {
    const node = payload?.message ?? payload?.data ?? payload;
    const senderProviderId = firstString(
      payload?.sender?.provider_id,
      payload?.sender_id,
      payload?.from?.provider_id,
      payload?.attendee_provider_id,
      payload?.sender?.attendee_provider_id,
      node?.sender?.provider_id,
      node?.sender_id,
      node?.sender_attendee_id,
    );
    const text = firstString(
      typeof payload?.text === "string" ? payload.text : undefined,
      typeof payload?.body === "string" ? payload.body : undefined,
      typeof payload?.message === "string" ? payload.message : undefined,
      typeof node?.text === "string" ? node.text : undefined,
      typeof node?.body === "string" ? node.body : undefined,
    );
    const messageId = firstString(payload?.message_id, node?.id, payload?.data?.message_id);
    const chatId = firstString(payload?.chat_id, node?.chat_id, payload?.data?.chat_id);

    message = {
      messageId,
      chatId,
      senderProviderId,
      text,
      isSelfSent: isSelfSent(payload),
      needsHydration: !senderProviderId && !!messageId,
    };
  }

  return { kind, eventType, unipileAccountId, connectToken, error, message };
}

/**
 * Hidrata os dados da mensagem quando o webhook envia payload reduzido.
 * GET /v2/{account_id}/messages/{message_id}
 * Falhas são silenciosas (retorna null) — o handler segue com o que tem.
 */
export async function hydrateV2Message(
  unipileAccountId: string,
  messageId: string,
): Promise<{
  senderProviderId: string | null;
  text: string | null;
  chatId: string | null;
  isSelfSent: boolean;
} | null> {
  const key = process.env.UNIPILE_API_KEY;
  if (!key) return null;
  const base = (process.env.UNIPILE_API_BASE_URL?.trim() || "https://api.unipile.com/v2").replace(
    /\/$/,
    "",
  );

  try {
    const res = await fetch(
      `${base}/${encodeURIComponent(unipileAccountId)}/messages/${encodeURIComponent(messageId)}`,
      { headers: { "X-API-KEY": key, Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data: any = await res.json().catch(() => null);
    if (!data) return null;
    return {
      senderProviderId: firstString(
        data.sender_id,
        data.sender?.provider_id,
        data.sender_attendee_id,
      ),
      text: firstString(data.text, data.body),
      chatId: firstString(data.chat_id),
      isSelfSent: isSelfSent(data),
    };
  } catch {
    return null;
  }
}
