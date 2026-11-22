import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Transport acceptance and projection are separate failure domains. These
 * functions receive only the privileged client after the caller's normal gates. */
export function inboxAttemptId(value: unknown): string {
  const hex = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const digest = (body: string) => createHash("sha256").update(body).digest("hex");
function stablePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stablePayload);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stablePayload(v)]),
    );
  return value;
}
/** Compare the entire logical send, excluding only projection timestamps. */
export function gmailRequestFingerprint(
  input: Pick<GmailTransportInput, "body" | "messageFields" | "threadFields">,
): string {
  const { sent_at: _sent, ...message } = input.messageFields;
  const { last_message_at: _last, ...thread } = input.threadFields;
  return digest(JSON.stringify(stablePayload({ body: input.body, message, thread })));
}
const must = <T>(result: { data: T; error: { message: string } | null }): T => {
  if (result.error) throw new Error("Registro canônico indisponível.");
  return result.data;
};

export type GmailTransportInput = {
  workspace: string;
  account: string;
  actor: string;
  request: string;
  message: string;
  body: string;
  messageFields: Record<string, unknown>;
  threadFields: Record<string, unknown>;
};
type AcceptedGmail = { id: string; threadId: string };

async function projectGmail(admin: SupabaseClient, receipt: Record<string, unknown>) {
  const payload = receipt["transport_payload"] as {
    provider_id: string;
    thread_id: string;
    message: Record<string, unknown>;
    thread: Record<string, unknown>;
  };
  const workspace = String(receipt["workspace_id"]);
  const account = String(receipt["account_id"]);
  // Acceptance is already durable. Resolve the real thread only in this
  // retryable projection domain; never rewrite the immutable transport row.
  const existing = must(
    await admin
      .from("email_threads")
      .select("id")
      .eq("workspace_id", workspace)
      .eq("account_id", account)
      .eq("provider_thread_id", payload.thread_id)
      .maybeSingle(),
  ) as { id: string } | null;
  const conversationId = existing?.id ?? String(receipt["conversation_id"]);
  must(
    await admin.from("email_threads").upsert(
      {
        ...payload.thread,
        id: conversationId,
        workspace_id: workspace,
        account_id: account,
        provider_thread_id: payload.thread_id,
      },
      { onConflict: "account_id,provider_thread_id", ignoreDuplicates: true },
    ),
  );
  if (
    conversationId !== receipt["conversation_id"] ||
    receipt["provider_id"] !== payload.provider_id
  ) {
    const sourceId = inboxAttemptId(["gmail-projection", receipt["source_id"]]);
    const previous = must(
      await admin
        .from("inbox_response_receipts")
        .select("*")
        .eq("workspace_id", workspace)
        .eq("origin", "gmail_send")
        .eq("source_id", sourceId)
        .maybeSingle(),
    ) as Record<string, unknown> | null;
    if (!previous) {
      const result = await admin.from("inbox_response_receipts").insert({
        workspace_id: workspace,
        channel: "email",
        account_id: account,
        conversation_id: conversationId,
        message_id: receipt["message_id"],
        provider_id: payload.provider_id,
        body_hash: receipt["body_hash"],
        actor_id: receipt["actor_id"],
        origin: "gmail_send",
        source_id: sourceId,
        confirmed_at: receipt["confirmed_at"],
        transport_state: "accepted",
        transport_payload: { ...payload, acceptance_id: receipt["id"] },
      });
      if (result.error) {
        // A concurrent projection may have won. Read back the immutable row.
        const winner = must(
          await admin
            .from("inbox_response_receipts")
            .select("*")
            .eq("workspace_id", workspace)
            .eq("origin", "gmail_send")
            .eq("source_id", sourceId)
            .maybeSingle(),
        );
        if (!winner) throw new Error("Reconciliação canônica indisponível.");
      }
    }
  }
  // Existing rows cannot be rewritten from a retry. A service-only no-op UPDATE
  // afterwards invokes reconciliation even if the first projection already exists.
  must(
    await admin.from("email_messages").upsert(
      {
        ...payload.message,
        id: receipt["message_id"],
        workspace_id: workspace,
        account_id: account,
        thread_id: conversationId,
        provider_message_id: payload.provider_id,
        direction: "outbound",
      },
      { onConflict: "account_id,provider_message_id", ignoreDuplicates: true },
    ),
  );
  must(
    await admin
      .from("email_messages")
      .update({ provider_message_id: payload.provider_id })
      .eq("workspace_id", workspace)
      .eq("account_id", account)
      .eq("id", String(receipt["message_id"])),
  );
  return conversationId;
}

/** Reserve BEFORE calling Gmail. Both reservation and accepted receipt are
 * append-only under existing private INSERT grants. An unknown attempt never
 * calls messages.send again, including a database failure after acceptance. */
export async function sendGmailWithInboxReceipt(
  admin: SupabaseClient,
  input: GmailTransportInput,
  transport: () => Promise<AcceptedGmail>,
): Promise<
  AcceptedGmail & { conversationId: string; messageId: string; projectionPending: boolean }
> {
  const acceptedSource = inboxAttemptId(["gmail-accepted", input.request]);
  const fingerprint = gmailRequestFingerprint(input);
  const assertSameAttempt = (row: Record<string, unknown>) => {
    const payload = row["transport_payload"] as Record<string, unknown> | null;
    const oldFingerprint =
      payload?.["request_fingerprint"] ??
      (payload?.["message"] && payload?.["thread"]
        ? gmailRequestFingerprint({
            body: String(payload["body"] ?? ""),
            messageFields: payload["message"] as Record<string, unknown>,
            threadFields: payload["thread"] as Record<string, unknown>,
          })
        : null);
    if (
      row["account_id"] !== input.account ||
      row["actor_id"] !== input.actor ||
      row["message_id"] !== input.message ||
      row["body_hash"] !== digest(input.body) ||
      (oldFingerprint !== null && oldFingerprint !== fingerprint)
    )
      throw new Error("Tentativa divergente; envio bloqueado.");
  };
  const existing = must(
    await admin
      .from("inbox_response_receipts")
      .select("*")
      .eq("workspace_id", input.workspace)
      .eq("origin", "gmail_send")
      .eq("source_id", acceptedSource)
      .maybeSingle(),
  ) as Record<string, unknown> | null;
  let receipt = existing;
  if (receipt) {
    assertSameAttempt(receipt);
  } else {
    const priorReservation = must(
      await admin
        .from("inbox_response_receipts")
        .select("*")
        .eq("workspace_id", input.workspace)
        .eq("origin", "gmail_send")
        .eq("source_id", input.request)
        .maybeSingle(),
    ) as Record<string, unknown> | null;
    if (priorReservation) {
      assertSameAttempt(priorReservation);
      throw new Error("Tentativa já reservada ou incerta; não repita o envio.");
    }
    // A duplicate reservation fails closed, including concurrent requests.
    const reserved = await admin.from("inbox_response_receipts").insert({
      workspace_id: input.workspace,
      channel: "email",
      account_id: input.account,
      conversation_id: input.request,
      message_id: input.message,
      provider_id: `reserved:${input.request}`,
      body_hash: digest(input.body),
      actor_id: input.actor,
      origin: "gmail_send",
      source_id: input.request,
      transport_state: "reserved",
      transport_payload: { request_fingerprint: fingerprint },
    });
    if (reserved.error) throw new Error("Tentativa já reservada ou incerta; não repita o envio.");
    const sent = await transport();
    if (!sent.id || !sent.threadId)
      throw new Error("Resultado do envio incerto; não repita o envio.");
    // Store acceptance BEFORE metadata reads, history insertion or notifications.
    receipt = must(
      await admin
        .from("inbox_response_receipts")
        .insert({
          workspace_id: input.workspace,
          channel: "email",
          account_id: input.account,
          conversation_id: inboxAttemptId([input.account, sent.threadId]),
          message_id: input.message,
          // A transport acceptance is not yet a conversation response. Keep
          // the unique canonical provider slot for its reconciled response.
          provider_id: `accepted:${sent.id}`,
          body_hash: digest(input.body),
          actor_id: input.actor,
          origin: "gmail_send",
          source_id: acceptedSource,
          transport_state: "accepted",
          transport_payload: {
            request_fingerprint: fingerprint,
            provider_id: sent.id,
            thread_id: sent.threadId,
            body: input.body,
            message: input.messageFields,
            thread: input.threadFields,
          },
        })
        .select("*")
        .single(),
    ) as Record<string, unknown>;
  }
  let projectionPending = false;
  let conversationId = String(receipt["conversation_id"]);
  try {
    conversationId = await projectGmail(admin, receipt);
  } catch {
    projectionPending = true;
  }
  const payload = receipt["transport_payload"] as { provider_id: string; thread_id: string };
  return {
    id: payload.provider_id,
    threadId: payload.thread_id,
    conversationId,
    messageId: String(receipt["message_id"]),
    projectionPending,
  };
}

/** Called only with the response in a *private sent transport receipt*, never
 * with a webhook/self echo or hydrated provider history. Quotas stay in call(). */
export async function reconcileUnipileInboxReceipt(
  admin: SupabaseClient,
  account: string,
  requestKey: string,
) {
  const receipt = must(
    await admin
      .from("unipile_delivery_receipts")
      .select("*")
      .eq("account_id", account)
      .eq("request_key", requestKey)
      .eq("status", "sent")
      .maybeSingle(),
  );
  if (!receipt?.inbox_request || receipt.inbox_request.endpoint !== "message.send") return;
  const { normalizeSendMessageResult } = await import("./unipile/client.server");
  const provider = normalizeSendMessageResult(receipt.response);
  const chatId = receipt.inbox_request.chat_id ?? provider.chatId;
  if (!provider.messageId || !chatId) return; // No inferred/hydrated chat identity.
  const source = must(
    await admin.from("unipile_accounts").select("workspace_id,owner_id").eq("id", account).single(),
  );
  if (!source) throw new Error("Conta canônica indisponível.");
  const conversation = must(
    await admin
      .from("linkedin_conversations")
      .select("id")
      .eq("workspace_id", source.workspace_id)
      .eq("account_id", account)
      .eq("provider_chat_id", chatId)
      .maybeSingle(),
  );
  if (!conversation) return; // Starting outreach is not a received conversation.
  must(
    await admin.from("linkedin_messages").upsert(
      {
        id: receipt.id,
        workspace_id: source.workspace_id,
        account_id: account,
        conversation_id: conversation.id,
        provider_message_id: provider.messageId,
        direction: "outbound",
        body: receipt.inbox_request.body,
      },
      { onConflict: "account_id,provider_message_id", ignoreDuplicates: true },
    ),
  );
  must(
    await admin
      .from("linkedin_messages")
      .update({ provider_message_id: provider.messageId })
      .eq("workspace_id", source.workspace_id)
      .eq("account_id", account)
      .eq("provider_message_id", provider.messageId),
  );
}

/** Recover a service reply only from its exact private, sent attempt. No
 * hydrated history, approximate body match or provider resend is permitted. */
export async function readServiceLinkedinAcceptance(
  admin: SupabaseClient,
  input: {
    workspace: string;
    conversation: string;
    job: string;
    body: string;
  },
): Promise<string | null> {
  const conversation = must(
    await admin
      .from("linkedin_conversations")
      .select("account_id,owner_id,provider_chat_id")
      .eq("workspace_id", input.workspace)
      .eq("id", input.conversation)
      .maybeSingle(),
  );
  if (!conversation) return null;
  const account = must(
    await admin
      .from("unipile_accounts")
      .select("id,owner_id")
      .eq("workspace_id", input.workspace)
      .eq("id", conversation.account_id)
      .maybeSingle(),
  );
  if (!account || account.owner_id !== conversation.owner_id) return null;
  const attempt = `sdr:${input.job}`;
  const key = digest(JSON.stringify({ endpoint: "message.send", attempt }));
  const receipt = must(
    await admin
      .from("unipile_delivery_receipts")
      .select("*")
      .eq("account_id", account.id)
      .eq("request_key", key)
      .eq("status", "sent")
      .maybeSingle(),
  );
  if (
    !receipt ||
    receipt.inbox_request?.endpoint !== "message.send" ||
    receipt.inbox_request.attempt_key !== attempt ||
    receipt.inbox_request.body !== input.body ||
    receipt.inbox_request.chat_id !== conversation.provider_chat_id
  )
    return null;
  const { normalizeSendMessageResult } = await import("./unipile/client.server");
  const result = normalizeSendMessageResult(receipt.response);
  if (!result.messageId || (result.chatId && result.chatId !== conversation.provider_chat_id))
    return null;
  return result.messageId;
}

/** The service job already owns a send-token reservation. Persist acceptance
 * before its completion transaction, so a notification failure cannot lose it. */
export async function storeServiceGmailAcceptance(
  admin: SupabaseClient,
  input: {
    workspace: string;
    account: string;
    conversation: string;
    job: string;
    message: string;
    provider: string;
    thread: string;
    body: string;
  },
) {
  const previous = must(
    await admin
      .from("inbox_response_receipts")
      .select("*")
      .eq("workspace_id", input.workspace)
      .eq("origin", "service_job")
      .eq("source_id", input.job)
      .maybeSingle(),
  );
  if (previous) {
    if (
      previous.provider_id !== input.provider ||
      previous.account_id !== input.account ||
      previous.conversation_id !== input.conversation ||
      previous.body_hash !== digest(input.body)
    )
      throw new Error("Recibo de transporte divergente.");
    return;
  }
  must(
    await admin.from("inbox_response_receipts").insert({
      workspace_id: input.workspace,
      channel: "email",
      account_id: input.account,
      conversation_id: input.conversation,
      message_id: input.message,
      provider_id: input.provider,
      body_hash: digest(input.body),
      actor_id: null,
      origin: "service_job",
      source_id: input.job,
      transport_payload: { provider_id: input.provider, thread_id: input.thread, body: input.body },
    }),
  );
}
