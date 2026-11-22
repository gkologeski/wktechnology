/** Explicit channel keys never widen the WhatsApp-only shared.message.received key. */
/** Runtime released with canonical producer/proof/RLS regression coverage; no user rule is activated. */
export const INBOX_CHANNEL_RUNTIME_READY = true;
export const INBOX_CHANNELS = ["email", "chat", "linkedin"] as const;
export type InboxChannel = (typeof INBOX_CHANNELS)[number];
export const INBOX_CHANNEL_EVENT_KINDS = [
  "message_received",
  "conversation_created",
  "conversation_assigned",
  "conversation_status_changed",
  "first_response",
] as const;
export type InboxChannelEventKind = (typeof INBOX_CHANNEL_EVENT_KINDS)[number];
const labels = { email: "E-mail Gmail", chat: "Chat do site", linkedin: "LinkedIn" };
const events = {
  message_received: "Mensagem recebida",
  conversation_created: "Conversa criada",
  conversation_assigned: "Responsável alterado",
  conversation_status_changed: "Status alterado",
  first_response: "Primeira resposta",
};
// Keep the supported matrix explicit in both runtime values and its closed type.
// Email has no conversation status; LinkedIn has no assignment control.
export const INBOX_CHANNEL_EVENT_KEYS = [
  "shared.email.message_received",
  "shared.email.conversation_created",
  "shared.email.conversation_assigned",
  "shared.email.first_response",
  "shared.chat.message_received",
  "shared.chat.conversation_created",
  "shared.chat.conversation_assigned",
  "shared.chat.conversation_status_changed",
  "shared.chat.first_response",
  "shared.linkedin.message_received",
  "shared.linkedin.conversation_created",
  "shared.linkedin.conversation_status_changed",
  "shared.linkedin.first_response",
] as const;
export type InboxChannelEventKey = (typeof INBOX_CHANNEL_EVENT_KEYS)[number];
export function inboxEventChannel(key: unknown): InboxChannel | null {
  if (typeof key !== "string" || !INBOX_CHANNEL_EVENT_KEYS.includes(key as InboxChannelEventKey))
    return null;
  const channel = key.split(".")[1];
  return INBOX_CHANNELS.find((value) => value === channel) ?? null;
}
export const INBOX_CHANNEL_EVENT_DEFINITIONS = INBOX_CHANNEL_EVENT_KEYS.map((key) => {
  const [, channel, kind] = key.split(".");
  return {
    key,
    label: `${events[kind as InboxChannelEventKind]} · ${labels[channel as InboxChannel]}`,
    description:
      "Ocorrência comprovada da Inbox; exclui histórico, recibos, espelhos e atualizações técnicas.",
    entity: "inbox_channel_occurrences" as const,
    moduleKey: "crm" as const,
    scheduling: "transition" as const,
    deadline: false,
  };
});
export const INBOX_OCCURRENCE_FIELDS = [
  "id",
  "workspace_id",
  "channel",
  "account_id",
  "conversation_id",
  "event_key",
  "message_id",
  "inbound_id",
  "actor_id",
  "assigned_to",
  "previous_status",
  "status",
  "occurred_at",
] as const;
