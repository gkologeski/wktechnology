import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesRecord } from "./access-control/sales-core.server";
import { inboxAttemptId } from "./inbox-transport.server";

export type GmailReply = {
  conversationId: string;
  accountId: string;
  providerThreadId: string;
  providerMessageId: string;
};

/** Resolve through the user's RLS client before any privileged transport. */
export async function resolveGmailReply(
  client: SupabaseClient,
  input: { conversationId: string; workspace: string; actor: string; accountId?: string },
): Promise<GmailReply> {
  const { data: thread, error } = await client
    .from("email_threads")
    .select("id,account_id,provider_thread_id")
    .eq("workspace_id", input.workspace)
    .eq("id", input.conversationId)
    .maybeSingle();
  if (error || !thread?.account_id || !thread.provider_thread_id)
    throw new Error("Conversa indisponível ou sem permissão.");
  await assertSalesRecord(client, "email_threads", thread.id, "view");
  await assertSalesRecord(client, "email_threads", thread.id, "create");
  if (input.accountId && input.accountId !== thread.account_id)
    throw new Error("Conta divergente da conversa.");
  const { data: account, error: accountError } = await client
    .from("email_accounts")
    .select("id")
    .eq("workspace_id", input.workspace)
    .eq("id", thread.account_id)
    .eq("owner_id", input.actor)
    .eq("provider", "gmail")
    .eq("status", "connected")
    .maybeSingle();
  if (accountError || !account)
    throw new Error("A conversa exige uma conta Gmail própria autorizada.");
  await assertSalesRecord(client, "email_accounts", account.id, "view");
  const { data: parent, error: parentError } = await client
    .from("email_messages")
    .select("provider_message_id")
    .eq("workspace_id", input.workspace)
    .eq("account_id", account.id)
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (parentError || !parent?.provider_message_id)
    throw new Error("Mensagem de origem indisponível; sincronize a conversa antes de responder.");
  return {
    conversationId: thread.id,
    accountId: account.id,
    providerThreadId: thread.provider_thread_id,
    providerMessageId: parent.provider_message_id,
  };
}

/** Mutable mirror headers are never used as the canonical reply headers. */
export async function canonicalGmailReplyHeaders(reply: GmailReply, accessToken: string) {
  const query = new URLSearchParams({ format: "metadata" });
  for (const name of ["Message-ID", "References", "In-Reply-To"])
    query.append("metadataHeaders", name);
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(reply.providerMessageId)}?${query}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
      redirect: "manual",
    },
  );
  if (!response.ok) throw new Error("Não foi possível confirmar a mensagem original no Gmail.");
  const message = (await response.json()) as {
    id?: string;
    threadId?: string;
    payload?: { headers?: { name: string; value: string }[] };
  };
  if (message.id !== reply.providerMessageId || message.threadId !== reply.providerThreadId)
    throw new Error("Mensagem Gmail divergente da conversa autorizada.");
  const read = (name: string) =>
    message.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value?.trim();
  const inReplyTo = read("message-id");
  const refs = read("references") || read("in-reply-to") || "";
  if (!inReplyTo || !/^<[^<>\s]+@[^<>\s]+>$/.test(inReplyTo) || /[\r\n]/.test(refs))
    throw new Error("Cabeçalhos canônicos da resposta indisponíveis.");
  const previous = refs.trim() ? refs.trim().split(/\s+/) : [];
  if (previous.some((id) => !/^<[^<>\s]+@[^<>\s]+>$/.test(id)))
    throw new Error("Referências canônicas da resposta inválidas.");
  const references = [...new Set([...previous, inReplyTo])].join(" ");
  return { inReplyTo, references };
}

/** Retry retains the original private headers, even after newer messages arrive. */
export async function gmailReplyHeadersForAttempt(
  admin: SupabaseClient,
  input: {
    reply: GmailReply;
    workspace: string;
    actor: string;
    request: string;
    accessToken: string;
  },
) {
  const { data: receipt, error } = await admin
    .from("inbox_response_receipts")
    .select("account_id,actor_id,transport_payload")
    .eq("workspace_id", input.workspace)
    .eq("origin", "gmail_send")
    .eq("source_id", inboxAttemptId(["gmail-accepted", input.request]))
    .maybeSingle();
  if (error) throw new Error("Tentativa original indisponível; envio bloqueado.");
  if (!receipt) return canonicalGmailReplyHeaders(input.reply, input.accessToken);
  const payload = receipt.transport_payload as {
    thread?: { id?: string; provider_thread_id?: string };
    message?: { headers?: { "In-Reply-To"?: string; References?: string } };
  } | null;
  const headers = payload?.message?.headers;
  if (
    receipt.account_id !== input.reply.accountId ||
    receipt.actor_id !== input.actor ||
    payload?.thread?.id !== input.reply.conversationId ||
    payload.thread.provider_thread_id !== input.reply.providerThreadId ||
    !headers?.["In-Reply-To"] ||
    !headers.References
  )
    throw new Error("Tentativa divergente da conversa; envio bloqueado.");
  return { inReplyTo: headers["In-Reply-To"], references: headers.References };
}
