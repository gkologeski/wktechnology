import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inboxAttemptId, sendGmailWithInboxReceipt } from "../../../src/lib/inbox-transport.server";

/** Portable PostgreSQL/PostgREST acceptance checks. Caller owns its disposable
 * target; the transport callback is a test provider, never Google's endpoint. */
export async function checkGmailTransport(
  admin: SupabaseClient,
  workspace: string,
  account: string,
  actor: string,
  occurredAt?: string,
  regressions = true,
) {
  let checks = 0;
  const equal = (actual: unknown, expected: unknown, message?: string) => {
    assert.equal(actual, expected, message);
    checks++;
  };
  const must = <T>(r: { data: T; error: { message: string } | null }) => {
    equal(r.error, null, "Disposable PostgREST operation failed");
    return r.data;
  };
  const request = crypto.randomUUID();
  const provider = `transport_${request.replaceAll("-", "")}`;
  const conversation = crypto.randomUUID();
  must(await admin.from("profiles").update({ active_workspace_id: workspace }).eq("id", actor));
  must(
    await admin
      .from("email_accounts")
      .update({ status: "connected", history_id: "8100" })
      .eq("id", account),
  );
  const scope = { p_workspace: workspace, p_account: account };
  must(
    await admin.rpc("gmail_sync_enqueue", {
      ...scope,
      p_expected_history: "8100",
      p_next_history: "8101",
      p_provenance: "incremental",
      p_ids: [provider],
    }),
  );
  const lease = crypto.randomUUID();
  const claimed = must(await admin.rpc("gmail_sync_claim", { ...scope, p_token: lease })) as Array<{
    id: string;
    provider_message_id: string;
  }>;
  const receipt = claimed.find((r) => r.provider_message_id === provider);
  assert.ok(receipt);
  must(
    await admin.from("email_threads").insert({
      id: conversation,
      workspace_id: workspace,
      owner_id: actor,
      assigned_to: actor,
      account_id: account,
      provider_thread_id: provider,
      inbox_creation_receipt: receipt.id,
      subject: "Disposable Gmail input",
    }),
  );
  const message = crypto.randomUUID();
  must(
    await admin.from("email_messages").insert({
      id: message,
      workspace_id: workspace,
      owner_id: actor,
      account_id: account,
      thread_id: conversation,
      provider_message_id: provider,
      direction: "inbound",
      body_text: "Canonical incoming",
      received_at: occurredAt ?? new Date(Date.now() - 1000).toISOString(),
    }),
  );
  equal(
    must(
      await admin.rpc("gmail_sync_finish", {
        ...scope,
        p_id: receipt.id,
        p_token: lease,
        p_outcome: "existing",
      }),
    ),
    true,
  );
  const events = must(
    await admin
      .from("inbox_channel_occurrences")
      .select("event_key")
      .eq("conversation_id", conversation),
  );
  assert.deepEqual(events?.map((r) => r.event_key).sort(), [
    "shared.email.conversation_created",
    "shared.email.message_received",
  ]);
  equal(
    must(
      await admin.rpc("gmail_sync_finish", {
        ...scope,
        p_id: receipt.id,
        p_token: lease,
        p_outcome: "existing",
      }),
    ),
    false,
  );
  const input = {
    workspace,
    account,
    actor,
    request,
    message: inboxAttemptId([request, "outbound"]),
    body: "Confirmed reply",
    threadFields: { owner_id: actor, subject: "Disposable Gmail input" },
    messageFields: {
      owner_id: actor,
      body_text: "Confirmed reply",
      from_email: "queue-a@example.invalid",
      to_emails: ["visitor@example.invalid"],
    },
  };
  let sends = 0;
  const transport = async () => {
    sends++;
    return { id: `${provider}_reply`, threadId: provider };
  };
  const first = await sendGmailWithInboxReceipt(admin, input, transport);
  equal(first.projectionPending, false);
  const retry = await sendGmailWithInboxReceipt(admin, input, transport);
  equal(retry.id, first.id);
  equal(sends, 1);
  const responses = must(
    await admin
      .from("inbox_channel_occurrences")
      .select("id")
      .eq("conversation_id", conversation)
      .eq("event_key", "shared.email.first_response"),
  );
  equal(responses?.length, 1);
  const immutable = await admin
    .from("inbox_response_receipts")
    .update({ body_hash: "0".repeat(64) })
    .eq("message_id", input.message);
  assert.ok(immutable.error, "Private acceptance cannot be changed, even by the service client");
  if (!regressions) return checks;
  const count = async (thread: string) => {
    const rows = must(
      await admin
        .from("inbox_channel_occurrences")
        .select("id")
        .eq("conversation_id", thread)
        .eq("event_key", "shared.email.first_response"),
    );
    return rows?.length ?? 0;
  };
  const send = async (threadProvider: string, body: string) => {
    const req = crypto.randomUUID();
    return sendGmailWithInboxReceipt(
      admin,
      {
        ...input,
        request: req,
        message: inboxAttemptId([req, "outbound"]),
        body,
        threadFields: { owner_id: actor, assigned_to: actor },
        messageFields: { owner_id: actor, body_text: body },
      },
      async () => ({ id: `reply_${req}`, threadId: threadProvider }),
    );
  };
  const inboundFor = async (thread: string, threadProvider: string, history: string) => {
    const incomingProvider = `incoming_${crypto.randomUUID()}`;
    must(
      await admin.rpc("gmail_sync_enqueue", {
        ...scope,
        p_expected_history: history,
        p_next_history: String(Number(history) + 1),
        p_provenance: "incremental",
        p_ids: [incomingProvider],
      }),
    );
    const lease = crypto.randomUUID();
    const claimed = must(
      await admin.rpc("gmail_sync_claim", { ...scope, p_token: lease }),
    ) as Array<{ id: string; provider_message_id: string }>;
    const q = claimed.find((r) => r.provider_message_id === incomingProvider);
    assert.ok(q);
    must(
      await admin.from("email_messages").insert({
        id: crypto.randomUUID(),
        workspace_id: workspace,
        owner_id: actor,
        account_id: account,
        thread_id: thread,
        provider_message_id: incomingProvider,
        direction: "inbound",
        body_text: "New attested input",
        received_at: new Date().toISOString(),
      }),
    );
    equal(
      must(
        await admin.rpc("gmail_sync_finish", {
          ...scope,
          p_id: q.id,
          p_token: lease,
          p_outcome: "existing",
        }),
      ),
      true,
    );
    const actualThread = must(
      await admin.from("email_threads").select("provider_thread_id").eq("id", thread).single(),
    );
    assert.ok(actualThread, "Canonical thread projection missing");
    equal(actualThread.provider_thread_id, threadProvider);
  };
  // First and second transport-confirmed answers still produce one total.
  equal((await send(provider, "Second confirmed reply")).projectionPending, false);
  equal(await count(conversation), 1);
  // Opening outbound has a real accepted receipt but no attested inbound.
  const openingThread = `opening_${crypto.randomUUID()}`;
  const opening = await send(openingThread, "Opening email before any inbound");
  equal(opening.projectionPending, false);
  const openingReceipt = must(
    await admin
      .from("inbox_response_receipts")
      .select("inbound_id")
      .eq("message_id", opening.messageId)
      .eq("transport_state", "accepted")
      .eq("provider_id", opening.id)
      .single(),
  );
  assert.ok(openingReceipt, "Canonical opening receipt missing");
  equal(openingReceipt.inbound_id, null);
  equal(await count(opening.conversationId), 0);
  await inboundFor(opening.conversationId, openingThread, "8101");
  equal((await send(openingThread, "First real response after opening")).projectionPending, false);
  equal(await count(opening.conversationId), 1);
  equal((await send(openingThread, "Second real response after opening")).projectionPending, false);
  equal(await count(opening.conversationId), 1);
  // A historical transport-confirmed reply cannot be relabeled first later.
  const historicThread = `historic_${crypto.randomUUID()}`;
  const historicConversation = crypto.randomUUID(),
    historicMessage = crypto.randomUUID();
  must(
    await admin.from("email_threads").insert({
      id: historicConversation,
      workspace_id: workspace,
      owner_id: actor,
      assigned_to: actor,
      account_id: account,
      provider_thread_id: historicThread,
    }),
  );
  must(
    await admin.from("email_messages").insert({
      id: crypto.randomUUID(),
      workspace_id: workspace,
      owner_id: actor,
      account_id: account,
      thread_id: historicConversation,
      provider_message_id: `${historicThread}_input`,
      direction: "inbound",
      body_text: "Historical received input",
      created_at: "2000-01-01T00:00:00Z",
      received_at: "2000-01-01T00:00:00Z",
    }),
  );
  const historicalBody = "Historical transport accepted reply";
  must(
    await admin.from("inbox_response_receipts").insert({
      workspace_id: workspace,
      channel: "email",
      account_id: account,
      conversation_id: historicConversation,
      message_id: historicMessage,
      provider_id: `${historicThread}_reply`,
      body_hash: createHash("sha256").update(historicalBody).digest("hex"),
      actor_id: actor,
      origin: "gmail_send",
      source_id: crypto.randomUUID(),
      confirmed_at: "2000-01-02T00:00:00Z",
      transport_state: "accepted",
      transport_payload: {
        provider_id: `${historicThread}_reply`,
        thread_id: historicThread,
        body: historicalBody,
      },
    }),
  );
  must(
    await admin.from("email_messages").insert({
      id: historicMessage,
      workspace_id: workspace,
      owner_id: actor,
      account_id: account,
      thread_id: historicConversation,
      provider_message_id: `${historicThread}_reply`,
      direction: "outbound",
      body_text: historicalBody,
      created_at: "2000-01-02T00:00:00Z",
    }),
  );
  equal(await count(historicConversation), 0);
  await inboundFor(historicConversation, historicThread, "8102");
  equal(
    (await send(historicThread, "Future reply is not the historical first")).projectionPending,
    false,
  );
  equal(await count(historicConversation), 0);
  must(await admin.from("email_messages").delete().eq("id", historicMessage));
  equal(
    (await send(historicThread, "Removing a mirror cannot erase prior history")).projectionPending,
    false,
  );
  equal(await count(historicConversation), 0);
  // Self echoes/sync projections are not transport confirmation, even with input.
  const mirrorThread = `mirror_${crypto.randomUUID()}`,
    mirrorConversation = crypto.randomUUID();
  must(
    await admin.from("email_threads").insert({
      id: mirrorConversation,
      workspace_id: workspace,
      owner_id: actor,
      assigned_to: actor,
      account_id: account,
      provider_thread_id: mirrorThread,
    }),
  );
  await inboundFor(mirrorConversation, mirrorThread, "8103");
  for (const body of [
    "Self echo",
    "Sync history mirror",
    "Transport error mirror",
    "Uncertain send mirror",
  ]) {
    must(
      await admin.from("email_messages").insert({
        id: crypto.randomUUID(),
        workspace_id: workspace,
        owner_id: actor,
        account_id: account,
        thread_id: mirrorConversation,
        provider_message_id: crypto.randomUUID(),
        direction: "outbound",
        body_text: body,
      }),
    );
    equal(await count(mirrorConversation), 0);
  }
  const uncertainRequest = crypto.randomUUID();
  let attempts = 0;
  const uncertainInput = {
    ...input,
    request: uncertainRequest,
    message: inboxAttemptId([uncertainRequest]),
  };
  const uncertainTransport = async () => {
    attempts++;
    throw new Error("uncertain provider");
  };
  await assert.rejects(
    sendGmailWithInboxReceipt(admin, uncertainInput, uncertainTransport),
    /uncertain provider/,
  );
  await assert.rejects(
    sendGmailWithInboxReceipt(admin, uncertainInput, uncertainTransport),
    /não repita/,
  );
  equal(attempts, 1);
  equal(await count(mirrorConversation), 0);
  // An earlier private row with inbound but invalid acceptance is NOT eligible.
  const invalidMessage = crypto.randomUUID(),
    invalidProvider = crypto.randomUUID();
  const invalidBody = "Projected but unconfirmed body";
  must(
    await admin.from("inbox_response_receipts").insert({
      workspace_id: workspace,
      channel: "email",
      account_id: account,
      conversation_id: mirrorConversation,
      message_id: invalidMessage,
      provider_id: invalidProvider,
      body_hash: createHash("sha256").update(invalidBody).digest("hex"),
      actor_id: actor,
      origin: "gmail_send",
      source_id: crypto.randomUUID(),
      transport_state: "accepted",
      transport_payload: {
        provider_id: invalidProvider,
        thread_id: mirrorThread,
        body: "Different acceptance body",
      },
    }),
  );
  must(
    await admin.from("email_messages").insert({
      id: invalidMessage,
      workspace_id: workspace,
      owner_id: actor,
      account_id: account,
      thread_id: mirrorConversation,
      provider_message_id: invalidProvider,
      direction: "outbound",
      body_text: invalidBody,
    }),
  );
  equal(await count(mirrorConversation), 0);
  equal((await send(mirrorThread, "A real response, not the mirrors")).projectionPending, false);
  equal(await count(mirrorConversation), 1);
  // Accepted transport must survive a failing post-send thread read. The
  // acceptance writes/readbacks below use the real private PostgREST table.
  const repairThread = `repair_${crypto.randomUUID()}`;
  const repairOpening = await send(repairThread, "Opening before input for repair");
  await inboundFor(repairOpening.conversationId, repairThread, "8104");
  const repairRequest = crypto.randomUUID();
  const repairInput = {
    ...input,
    request: repairRequest,
    message: inboxAttemptId([repairRequest, "outbound"]),
    messageFields: { ...input.messageFields, subject: "Stable subject" },
  };
  let repairSends = 0;
  const repairTransport = async () => {
    repairSends++;
    return { id: `repair_${repairRequest}`, threadId: repairThread };
  };
  const failReads = new Proxy(admin, {
    get(target, property, receiver) {
      if (property !== "from") return Reflect.get(target, property, receiver);
      return (table: string) => {
        const query = target.from(table);
        if (table !== "email_threads") return query;
        const wrap = (chain: object): object =>
          new Proxy(chain, {
            get(q, key) {
              if (key === "maybeSingle")
                return async () => ({
                  data: null,
                  error: { message: "Injected post-acceptance read failure" },
                });
              const member = Reflect.get(q, key);
              return typeof member === "function"
                ? (...args: unknown[]) => wrap(Reflect.apply(member, q, args))
                : member;
            },
          });
        return wrap(query);
      };
    },
  });
  equal(
    (await sendGmailWithInboxReceipt(failReads, repairInput, repairTransport)).projectionPending,
    true,
  );
  equal(repairSends, 1);
  equal(await count(repairOpening.conversationId), 0);
  const durable = must(
    await admin
      .from("inbox_response_receipts")
      .select("*")
      .eq("source_id", inboxAttemptId(["gmail-accepted", repairRequest]))
      .single(),
  );
  equal(durable.provider_id, `accepted:repair_${repairRequest}`);
  const snapshot = JSON.stringify(durable);
  const repaired = await sendGmailWithInboxReceipt(admin, repairInput, repairTransport);
  equal(repaired.projectionPending, false);
  equal(repaired.conversationId, repairOpening.conversationId);
  equal(repairSends, 1);
  equal(await count(repairOpening.conversationId), 1);
  equal(
    JSON.stringify(
      must(await admin.from("inbox_response_receipts").select("*").eq("id", durable.id).single()),
    ),
    snapshot,
  );
  for (const patch of [
    { to_emails: ["other@example.invalid"] },
    { cc_emails: ["other@example.invalid"] },
    { bcc_emails: ["other@example.invalid"] },
    { subject: "Changed" },
    { attachments: [{ path: "private/file", content_sha256: "0".repeat(64) }] },
  ]) {
    await assert.rejects(
      sendGmailWithInboxReceipt(
        admin,
        { ...repairInput, messageFields: { ...repairInput.messageFields, ...patch } },
        repairTransport,
      ),
      /divergente/,
    );
    checks++;
  }
  equal(repairSends, 1);
  const canonical = must(
    await admin
      .from("inbox_response_receipts")
      .select("*")
      .eq("source_id", inboxAttemptId(["gmail-projection", durable.source_id]))
      .single(),
  );
  equal(canonical.transport_payload.acceptance_id, durable.id);
  for (const patch of [
    { actor_id: crypto.randomUUID() },
    { workspace_id: crypto.randomUUID() },
    { account_id: crypto.randomUUID() },
    { message_id: crypto.randomUUID() },
    { provider_id: "different-provider" },
    { body_hash: "0".repeat(64) },
    { transport_payload: { ...canonical.transport_payload, message: { subject: "Divergent" } } },
    { confirmed_at: "2000-01-01T00:00:00Z" },
  ]) {
    const { id: _id, inbound_id: _inbound, ...fields } = canonical;
    const result = await admin
      .from("inbox_response_receipts")
      .insert({ ...fields, source_id: crypto.randomUUID(), ...patch });
    assert.ok(result.error, "Divergent immutable acceptance lineage must be denied");
    checks++;
  }
  return checks;
}
