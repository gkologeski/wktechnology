// Normalização de eventos de webhook da Unipile (v1 e v2).
//
// v1: o payload traz `status`/`event`/`type` e vem "gordo" (sender, texto,
// name = connect_token que enviávamos no hosted auth).
//
// v2: o payload traz `event_type` (ex.: "account.connected",
// "messaging.message_received") e é reduzido: normalmente só identificadores
// (account_id, chat_id, message_id, state) + timestamp. Quando faltam dados
// da mensagem, hidratamos via GET /v2/{account_id}/chats/{chat_id}/messages/{message_id}.
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
    if (typeof v !== "string" && typeof v !== "number") continue;
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
    e === "message.new" ||
    e === "messaging.received" ||
    e === "messaging.message_received" ||
    e === "message"
  ) {
    return "message_received";
  }
  // v2 sinaliza envio/leitura com o mesmo prefixo — não são respostas.
  if (e.startsWith("message") || e.startsWith("messaging")) return "unknown";

  // Initial history sync does not determine whether a live account can receive messages.
  if (e.startsWith("account.initial_sync.")) return "unknown";
  if (e === "account.locked") return "account_failed";

  // --- Conta ---
  if (e === "account.remove" || e.includes("disconnect")) return "account_disconnected";
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
    direction === "outbound" ||
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
    payload?.payload?.account_id,
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
    const node = payload?.payload ?? payload?.message ?? payload?.data ?? payload;
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
      isSelfSent: isSelfSent(payload) || isSelfSent(node),
      needsHydration: (!senderProviderId || text === null || !chatId) && !!messageId,
    };
  }

  return { kind, eventType, unipileAccountId, connectToken, error, message };
}

/**
 * Hidrata os dados da mensagem quando o webhook envia payload reduzido.
 * GET /v2/{account_id}/chats/{chat_id}/messages/{message_id}
 * A falha retorna null e o handler responde 503; nunca confirma ingestão incompleta.
 */
export async function hydrateV2Message(
  unipileAccountId: string,
  messageId: string,
  chatId: string | null,
): Promise<{
  senderProviderId: string | null;
  text: string | null;
  chatId: string | null;
  isSelfSent: boolean;
} | null> {
  if (!chatId) return null; // Never guess a global message endpoint or another conversation.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccountCtx, getLinkedinChatMessage } = await import("./client.server");
    const account = await supabaseAdmin
      .from("unipile_accounts")
      .select("owner_id,workspace_id,status")
      .eq("unipile_account_id", unipileAccountId)
      .maybeSingle();
    if (account.error || !account.data?.workspace_id || account.data.status !== "connected")
      return null;
    const ctx = await loadAccountCtx(account.data.owner_id, account.data.workspace_id);
    if (ctx.unipileAccountId !== unipileAccountId) return null;
    const raw: any = await getLinkedinChatMessage(ctx, { chatId, messageId });
    const data = raw?.data ?? raw;
    if (!data || (data.id && data.id !== messageId) || (data.chat_id && data.chat_id !== chatId))
      return null;
    return {
      senderProviderId: firstString(
        data.sender_id,
        data.sender?.provider_id,
        data.sender_attendee_id,
      ),
      text: firstString(data.text, data.body),
      chatId: firstString(data.chat_id, chatId),
      isSelfSent: isSelfSent(data),
    };
  } catch {
    return null;
  }
}
