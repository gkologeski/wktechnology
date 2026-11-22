import { resolveGmailReply } from "./gmail-reply.server";
import { beforeAll, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertSalesAnyArea, assertSalesRecord } from "./access-control/sales-core.server";
import { sendAuthenticatedChat } from "./inbox/chat-send.server";
import { checkGmailTransport } from "../../tests/fixtures/inbox/gmail-transport-checks";
import { workflowDraftInsert, workflowDraftFields } from "./workflows/draft-payload";
import { checkInboxWorkflowGuard } from "../../tests/fixtures/inbox/guard-checks";
import {
  db,
  W,
  B,
  A,
  C,
  D,
  U,
  N,
  F,
  ROLE,
  WF,
  reset,
  withRole,
  request,
  fixtureJwt,
  fixtureHttpBase,
} from "../../tests/fixtures/notification-deliveries";
import {
  setupInboxExecutionCopy,
  withInboxAvailabilityLock,
} from "../../tests/fixtures/inbox/runtime";

beforeAll(async () => setupInboxExecutionCopy(db), 60000);
beforeEach(async () => {
  await db.unsafe(
    "TRUNCATE techerp_api.inbox_response_history_barriers,unipile_delivery_receipts,prospecting_sequence_runs,prospecting_sequence_effects,inbox_transition_receipts,inbox_response_receipts,inbox_channel_occurrences,inbox_channel_evidence,inbox_widget_receipts,live_chat_messages,gmail_sync_queue,email_messages,email_accounts CASCADE",
  );
  await reset();
  // Keep the baseline fixture explicit while real new inserts use draft/version0 defaults.
  await db`update workflows set status='published',published_version=1,enabled=true where id=${WF}`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.chat.view.workspace','grant'),
      (${W},${ROLE},'system.workflows.create.workspace','grant'),
      (${W},${ROLE},'system.workflows.update.workspace','grant')`;
});

const delivery = { channels: ["inapp"], fallback: "none" };
const rules = [{ kind: "source_responsible" }];
async function catalogAccount() {
  const account = randomUUID();
  await db`insert into email_accounts(id,workspace_id,owner_id,provider,status,email)
    values(${account},${W},${U},'gmail','connected','catalog@example.invalid')`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.email_accounts.view.own','grant')`;
  return account;
}
const catalog = (actor = U) =>
  request(
    "/rpc/workflow_inbox_sources",
    {
      p_workspace: W,
      p_channel: "email",
    },
    actor,
  );
async function chatReply(conversation: string, body: string, attempt = randomUUID(), actor = U) {
  const base = fixtureHttpBase();
  let failure: { status: number; payload: Record<string, unknown> } | undefined;
  const user = createClient(base, fixtureJwt("authenticated", actor), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = String(input);
        if (!url.startsWith(base + "/rest/v1/")) throw new Error("Refused non-owned fixture URL");
        const result = await fetch(base + url.slice((base + "/rest/v1").length), init);
        if (!result.ok)
          failure = {
            status: result.status,
            payload: (await result.clone().json()) as Record<string, unknown>,
          };
        return result;
      },
    },
  });
  try {
    await sendAuthenticatedChat(user, {
      workspace: W,
      actor,
      session: conversation,
      request: attempt,
      body,
    });
    return { status: 200, payload: attempt as unknown };
  } catch (error) {
    if (failure) return failure;
    throw error;
  }
}

async function assertChatCreate(actor: string, allowed: boolean) {
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.chat.create.workspace','grant') on conflict do nothing`;
  const conversation = randomUUID(),
    attempt = randomUUID();
  await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status)
    values(${conversation},${W},${W},${actor},'writer_scope_visitor','open')`;
  const sent = await chatReply(conversation, "Synthetic writer scope", attempt, actor);
  expect(sent.status).toBe(allowed ? 200 : 403);
  const rows = await db`select id from live_chat_messages where session_id=${conversation}`;
  expect(rows).toHaveLength(allowed ? 1 : 0);
  if (allowed) expect(rows[0]!.id).toBe(attempt);
}
it("Chat canonical sender permits the active authorized workspace writer", async () => {
  await expect(assertChatCreate(U, true)).resolves.toBeUndefined();
});
it("Chat canonical sender rejects a writer without the create key", async () => {
  await expect(assertChatCreate(N, false)).resolves.toBeUndefined();
});
it("Chat canonical sender preserves explicit deny over a create grant", async () => {
  const deny = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${deny},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${deny},${C},${W},${W})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${deny},'techsales.inbox.chat.create.workspace','deny')`;
  await expect(assertChatCreate(C, false)).resolves.toBeUndefined();
});
it("Chat canonical sender rejects another workspace writer", async () => {
  await expect(assertChatCreate(F, false)).resolves.toBeUndefined();
});
it("Chat canonical sender rejects an inactive workspace writer", async () => {
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${C}`;
  await expect(assertChatCreate(C, false)).resolves.toBeUndefined();
});
it("Chat package preserves the existing rejection for a team-only create key", async () => {
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.chat.create.team','grant')`;
  const conversation = randomUUID();
  await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status)
    values(${conversation},${W},${W},${C},'team_scope_visitor','open')`;
  expect((await chatReply(conversation, "Synthetic team-only probe")).status).toBe(403);
  expect(await db`select id from live_chat_messages where session_id=${conversation}`).toHaveLength(
    0,
  );
});

it("Chat reply preserves canonical own write scope despite workspace-wide viewing", async () => {
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.chat.create.own','grant')`;
  const conversation = randomUUID();
  await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status)
    values(${conversation},${W},${W},${C},'scope_visitor_01','open')`;
  await expect(
    withRole(
      "authenticated",
      U,
      (tx) => tx`insert into live_chat_messages
    (workspace_id,owner_id,session_id,direction,author_user_id,body)
    values(${W},${W},${conversation},'outbound',${U},'Synthetic scope probe')`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  const result = await chatReply(conversation, "Synthetic scope probe");
  expect(result.status).toBe(403);
  expect(result.payload).toMatchObject({ code: "42501" });
  expect(await db`select id from live_chat_messages where session_id=${conversation}`).toHaveLength(
    0,
  );
});
it("Chat reply private commit rejects direct authenticated invocation", async () => {
  const result = await request(
    "/rpc/inbox_chat_outbound_commit",
    {
      p_workspace: W,
      p_actor: U,
      p_session: randomUUID(),
      p_request: randomUUID(),
      p_body: "Synthetic private probe",
    },
    U,
    fixtureJwt("authenticated", U),
  );
  expect(result.status).toBe(403);
  expect(result.payload).toMatchObject({ code: "42501" });
});

async function firstResponseConversation() {
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.chat.create.workspace','grant')`;
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set
    execution_user_id=${U},entity='inbox_channel_occurrences',
    trigger=${tx.json({ event: "updated", notification_event: { key: "shared.chat.first_response", channel: "chat", account_ids: [W] } })},
    actions=${tx.json([{ type: "notify", title: "Atualização disponível", recipients: rules, delivery }])}
    where id=${WF}`,
  );
  const conversation = randomUUID();
  await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status)
    values(${conversation},${W},${W},${U},'first_reply_visitor_01','open')`;
  return conversation;
}
async function customerReply(conversation: string) {
  const result = await request(
    "/rpc/widget_inbound_commit",
    {
      p_session: conversation,
      p_visitor: "first_reply_visitor_01",
      p_request: randomUUID(),
      p_body: "Synthetic inbound reply",
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(result.status).toBe(200);
}
it("First response follows opening then inbound and emits once across subsequent replies and retry", async () => {
  const conversation = await firstResponseConversation();
  expect((await chatReply(conversation, "Synthetic opening")).status).toBe(200);
  expect(
    await db`select id from inbox_channel_occurrences where conversation_id=${conversation}
    and event_key='shared.chat.first_response'`,
  ).toHaveLength(0);
  await customerReply(conversation);
  const attempt = randomUUID();
  const first = await chatReply(conversation, "Synthetic actual response", attempt);
  expect(first.status).toBe(200);
  expect(
    await db`select id from inbox_channel_occurrences where conversation_id=${conversation}
    and event_key='shared.chat.first_response'`,
  ).toHaveLength(1);
  const retry = await chatReply(conversation, "Synthetic actual response", attempt);
  expect(retry.status).toBe(200);
  expect(retry.payload).toBe(first.payload);
  expect((await chatReply(conversation, "Synthetic second response")).status).toBe(200);
  expect(
    await db`select id from inbox_channel_occurrences where conversation_id=${conversation}
    and event_key='shared.chat.first_response'`,
  ).toHaveLength(1);
});
it("First response is not fabricated for an already answered historical conversation", async () => {
  const conversation = await firstResponseConversation();
  await withRole(
    "service_role",
    null,
    (
      tx,
    ) => tx`insert into live_chat_messages(workspace_id,owner_id,session_id,direction,body,created_at)
    values(${W},${W},${conversation},'inbound','Synthetic prior inbound',clock_timestamp()-interval '2 hours'),
      (${W},${W},${conversation},'outbound','Synthetic prior confirmed reply',clock_timestamp()-interval '1 hour')`,
  );
  await customerReply(conversation);
  expect((await chatReply(conversation, "Synthetic later reply")).status).toBe(200);
  expect(
    await db`select id from inbox_channel_occurrences where conversation_id=${conversation}
    and event_key='shared.chat.first_response'`,
  ).toHaveLength(0);
});

async function linkedinAccount() {
  const account = randomUUID();
  for (const key of [
    "system.linkedin.view.own",
    "system.linkedin.manage.own",
    "techsales.inbox.linkedin.view.own",
    "techsales.inbox.linkedin.manage.own",
  ]) {
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
      values(${W},${ROLE},${key},'grant') on conflict do nothing`;
  }
  await db`insert into unipile_accounts(id,workspace_id,owner_id,status) values(${account},${W},${U},'connected')`;
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set
    execution_user_id=${U},entity='inbox_channel_occurrences',
    trigger=${tx.json({ event: "updated", notification_event: { key: "shared.linkedin.message_received", channel: "linkedin", account_ids: [account] } })},
    actions=${tx.json([{ type: "notify", title: "Atualização disponível", recipients: [{ kind: "workflow_owner" }], delivery }])}
    where id=${WF}`,
  );
  return account;
}
async function linkedinInbound(
  account: string,
  message: string,
  live = true,
  self = false,
  chat = "synthetic-chat",
  occurred?: string,
) {
  const at = occurred ?? String((await db`select clock_timestamp()::text at`)[0]!["at"]);
  const response = await request(
    "/rpc/unipile_signed_inbound_commit",
    {
      p_account: account,
      p_message: message,
      p_chat: chat,
      p_sender: "synthetic-sender",
      p_body: "Synthetic private LinkedIn body",
      p_envelope_hash: "b".repeat(64),
      p_occurred: at,
      p_live: live,
      p_self: self,
    },
    U,
    fixtureJwt("service_role"),
  );
  return { response, at };
}
it("LinkedIn signed incremental receive creates metadata occurrences once and preserves personal ownership", async () => {
  const account = await linkedinAccount();
  const first = await linkedinInbound(account, "synthetic-message-1");
  expect(first.response.status, JSON.stringify(first.response.payload)).toBe(200);
  expect(first.response.payload.accepted).toBe(true);
  const occurrences =
    await db`select id,event_key,conversation_id from inbox_channel_occurrences where account_id=${account}`;
  expect(occurrences.map((r) => r.event_key).sort()).toEqual([
    "shared.linkedin.conversation_created",
    "shared.linkedin.message_received",
  ]);
  const retry = await linkedinInbound(
    account,
    "synthetic-message-1",
    true,
    false,
    "synthetic-chat",
    first.at,
  );
  expect(retry.response.payload).toMatchObject({ accepted: true, duplicate: true });
  expect(
    await db`select id from inbox_channel_occurrences where account_id=${account}`,
  ).toHaveLength(2);
  const conversation = String(occurrences[0]!.conversation_id);
  const read = await request(
    `/linkedin_conversations?select=id&id=eq.${conversation}`,
    undefined,
    U,
  );
  expect(read.payload).toEqual([{ id: conversation }]);
  // A workspace-scoped grant cannot adopt somebody else's personal account.
  const foreignOwner = await request(
    `/linkedin_conversations?select=id&id=eq.${conversation}`,
    undefined,
    C,
  );
  expect(foreignOwner.payload).toEqual([]);
  const body = await request(
    `/inbox_channel_occurrences?select=*&account_id=eq.${account}`,
    undefined,
    U,
  );
  expect(body.status).toBe(403);
});
it("LinkedIn history and self echoes cannot create occurrences or promote on retry", async () => {
  const account = await linkedinAccount();
  const history = await linkedinInbound(account, "synthetic-history", false);
  expect(history.response.status, JSON.stringify(history.response.payload)).toBe(200);
  expect(
    await db`select id from inbox_channel_occurrences where account_id=${account}`,
  ).toHaveLength(0);
  const promoted = await linkedinInbound(
    account,
    "synthetic-history",
    true,
    false,
    "synthetic-chat",
    history.at,
  );
  expect(promoted.response.payload).toMatchObject({ accepted: true, duplicate: true });
  const self = await linkedinInbound(account, "synthetic-self", true, true);
  expect(self.response.payload).toMatchObject({ accepted: false, reason: "self" });
  expect(
    await db`select id from inbox_channel_occurrences where account_id=${account}`,
  ).toHaveLength(0);
  expect(await db`select id from linkedin_messages where account_id=${account}`).toHaveLength(1);
});

async function assertLinkedinAccountUnavailable(mode: "missing" | "deny" | "foreign" | "inactive") {
  const account = await linkedinAccount();
  if (mode === "missing")
    await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key='system.linkedin.manage.own'`;
  if (mode === "deny") {
    const deny = randomUUID();
    await db`insert into job_roles(id,workspace_id) values(${deny},${W})`;
    await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${deny},${U},${W},${W})`;
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
      values(${W},${deny},'system.linkedin.manage.own','deny')`;
  }
  if (mode === "foreign")
    await db`update unipile_accounts set workspace_id=${randomUUID()} where id=${account}`;
  if (mode === "inactive")
    await db`update workspace_members set status='inactive' where user_id=${U} and workspace_id=${W}`;
  const result = await linkedinInbound(account, "synthetic-unavailable");
  expect(result.response.status, JSON.stringify(result.response.payload)).toBe(200);
  expect(result.response.payload).toMatchObject({ accepted: false, reason: "account_unavailable" });
  expect(
    await db`select id from inbox_channel_occurrences where account_id=${account}`,
  ).toHaveLength(0);
  expect(await db`select id from linkedin_messages where account_id=${account}`).toHaveLength(0);
}
it("LinkedIn producer rejects an owner without the current manage key", async () => {
  await expect(assertLinkedinAccountUnavailable("missing")).resolves.toBeUndefined();
});
it("LinkedIn producer rejects an explicitly denied owner", async () => {
  await expect(assertLinkedinAccountUnavailable("deny")).resolves.toBeUndefined();
});
it("LinkedIn producer rejects another workspace account", async () => {
  await expect(assertLinkedinAccountUnavailable("foreign")).resolves.toBeUndefined();
});
it("LinkedIn producer rejects an inactive account owner", async () => {
  await expect(assertLinkedinAccountUnavailable("inactive")).resolves.toBeUndefined();
});
it("LinkedIn status change comes from the authorized edit RPC and never from service reopen", async () => {
  const account = await linkedinAccount();
  const first = await linkedinInbound(account, "synthetic-status-origin");
  expect(first.response.status).toBe(200);
  const [row] = await db`select id from linkedin_conversations where account_id=${account}`;
  const conversation = String(row!.id);
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set
    trigger=${tx.json({ event: "updated", notification_event: { key: "shared.linkedin.conversation_status_changed", channel: "linkedin", account_ids: [account] } })} where id=${WF}`,
  );
  const changed = await fetch(fixtureHttpBase() + "/rpc/linkedin_conversation_edit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fixtureJwt("authenticated", U)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_id: conversation, p_status: "closed" }),
  });
  expect(changed.status).toBe(204);
  const occurrences =
    await db`select id from inbox_channel_occurrences where account_id=${account} and event_key='shared.linkedin.conversation_status_changed'`;
  expect(occurrences).toHaveLength(1);
  const proof = await db.begin(async (tx) => {
    // Same service claims as the real dispatch caller; private proof execution
    // itself retains its real definer ownership and is never exposed by HTTP.
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ role: "service_role" })},true)`;
    return tx`select techerp_api.inbox_transition_evidence_current(${String(occurrences[0]!.id)}) valid`;
  });
  expect(proof[0]!.valid).toBe(true);
  await withRole(
    "service_role",
    null,
    (tx) => tx`update linkedin_conversations set status='open' where id=${conversation}`,
  );
  expect(
    await db`select id from inbox_channel_occurrences where account_id=${account} and event_key='shared.linkedin.conversation_status_changed'`,
  ).toHaveLength(1);
});

it("Gmail actual transport receipt reconciles incremental creation first response and retry without a second provider send", async () => {
  const account = await catalogAccount();
  for (const key of [
    "techsales.email_accounts.update.own",
    "techsales.inbox.email.view.workspace",
    "techsales.inbox.email.create.workspace",
  ])
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},'grant') on conflict do nothing`;
  const base = fixtureHttpBase();
  // SDK path adaptation only: all operations still hit the owned PostgREST
  // using its signed synthetic service JWT. No authorization response is mocked.
  const admin = createClient(base, fixtureJwt("service_role"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const url = String(input);
        if (!url.startsWith(base + "/rest/v1/")) throw new Error("Refused non-owned fixture URL");
        return fetch(base + url.slice((base + "/rest/v1").length), init);
      },
    },
  });
  expect(await checkGmailTransport(admin, W, account, U)).toBe(123);
});

it("LinkedIn confirmed private transport and canonical projection emit first response exactly once", async () => {
  const account = await linkedinAccount();
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.linkedin.create.own','grant')`;
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`update workflows set trigger=${tx.json({ event: "updated", notification_event: { key: "shared.linkedin.first_response", channel: "linkedin", account_ids: [account] } })} where id=${WF}`,
  );
  expect((await linkedinInbound(account, "synthetic-before-confirmation")).response.status).toBe(
    200,
  );
  const [conversation] =
    await db`select id from linkedin_conversations where account_id=${account}`;
  const receipt = randomUUID(),
    lease = randomUUID(),
    provider = "synthetic-confirmed-response";
  // A synthetic provider callback uses the real private transport journal and
  // confirmation CAS. No provider is called or quota/reservation claimed here.
  await withRole(
    "service_role",
    null,
    (tx) => tx`insert into unipile_delivery_receipts
    (id,account_id,request_key,lease_token,status,inbox_request)
    values(${receipt},${account},${"c".repeat(64)},${lease},'started',${tx.json({ endpoint: "message.send", body: "Synthetic confirmed reply", chat_id: "synthetic-chat" })})`,
  );
  const finish = await fetch(fixtureHttpBase() + "/rpc/unipile_delivery_finish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fixtureJwt("service_role")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_id: receipt,
      p_token: lease,
      p_status: "sent",
      p_response: { message_id: provider, chat_id: "synthetic-chat" },
    }),
  });
  expect(finish.status).toBe(204);
  const args = {
    p_conversation: String(conversation!.id),
    p_workspace: W,
    p_owner: U,
    p_message: provider,
    p_body: "Synthetic confirmed reply",
  };
  const projected = await request(
    "/rpc/linkedin_outbound_commit",
    args,
    U,
    fixtureJwt("service_role"),
  );
  expect(projected.status, JSON.stringify(projected.payload)).toBe(200);
  expect(
    await db`select id from inbox_channel_occurrences where account_id=${account} and event_key='shared.linkedin.first_response'`,
  ).toHaveLength(1);
  const retried = await request(
    "/rpc/linkedin_outbound_commit",
    args,
    U,
    fixtureJwt("service_role"),
  );
  expect(retried.payload).toBe(projected.payload);
  expect(
    await db`select id from inbox_channel_occurrences where account_id=${account} and event_key='shared.linkedin.first_response'`,
  ).toHaveLength(1);
  await expect(
    withRole(
      "service_role",
      null,
      (tx) => tx`update unipile_delivery_receipts set response='{}' where id=${receipt}`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("LinkedIn outbound mirror without private transport confirmation cannot create first response", async () => {
  const account = await linkedinAccount();
  expect((await linkedinInbound(account, "synthetic-before-mirror")).response.status).toBe(200);
  const [conversation] =
    await db`select id from linkedin_conversations where account_id=${account}`;
  const projected = await request(
    "/rpc/linkedin_outbound_commit",
    {
      p_conversation: String(conversation!.id),
      p_workspace: W,
      p_owner: U,
      p_message: "synthetic-unattested-outbound",
      p_body: "Synthetic mirror only",
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(projected.status).toBe(200);
  expect(
    await db`select id from inbox_channel_occurrences where account_id=${account} and event_key='shared.linkedin.first_response'`,
  ).toHaveLength(0);
});

const channelMatrix = {
  email: [
    "shared.email.message_received",
    "shared.email.conversation_created",
    "shared.email.conversation_assigned",
    "shared.email.first_response",
  ],
  chat: [
    "shared.chat.message_received",
    "shared.chat.conversation_created",
    "shared.chat.conversation_assigned",
    "shared.chat.conversation_status_changed",
    "shared.chat.first_response",
  ],
  linkedin: [
    "shared.linkedin.message_received",
    "shared.linkedin.conversation_created",
    "shared.linkedin.conversation_status_changed",
    "shared.linkedin.first_response",
  ],
} as const;
function ownedServiceClient(actor?: string) {
  const base = fixtureHttpBase();
  return createClient(base, fixtureJwt(actor ? "authenticated" : "service_role", actor), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const url = String(input);
        if (!url.startsWith(base + "/rest/v1/")) throw new Error("Refused non-owned fixture URL");
        return fetch(base + url.slice((base + "/rest/v1").length), init);
      },
    },
  });
}
async function installChannelMatrix(channel: keyof typeof channelMatrix, account: string) {
  const mapping = new Map<string, string>();
  for (const key of channelMatrix[channel]) {
    const id = randomUUID();
    const input = {
      name: `Synthetic ${key}`,
      entity: "inbox_channel_occurrences",
      enabled: true,
      trigger: { event: "updated", notification_event: { key, channel, account_ids: [account] } },
      actions: [
        {
          type: "notify",
          title: "Atualização disponível",
          recipients: [{ kind: "workflow_owner" }],
          delivery,
        },
      ],
    };
    const payload = workflowDraftInsert(input, U, W);
    await withRole("authenticated", U, async (tx) => {
      await tx`insert into workflows(id,name,workspace_id,owner_id,entity,enabled,status,trigger,actions,draft_trigger,draft_actions)
        values(${id},${payload.name},${W},${U},${payload.entity},${payload.enabled},${payload.status},${tx.json(payload.trigger)},${tx.json(payload.actions)},${tx.json(payload.draft_trigger)},${tx.json(payload.draft_actions)})`;
      await tx`update workflows set trigger=draft_trigger,actions=draft_actions,status='published',published_version=1,execution_user_id=${U} where id=${id}`;
      await tx`update workflows set enabled=true where id=${id}`;
    });
    mapping.set(key, id);
  }
  return mapping;
}
async function checkChannelWorkerMatrix(
  channel: keyof typeof channelMatrix,
  account: string,
  workflows: Map<string, string>,
) {
  const rows = await db`select o.event_key,e.id event from inbox_channel_occurrences o
    join workflow_events e on e.entity_id=o.id and e.notification_event_key=o.event_key
    where o.account_id=${account} and o.channel=${channel}`;
  expect(rows.map((row) => row.event_key).sort()).toEqual([...channelMatrix[channel]].sort());
  for (const row of rows) {
    const workflow = workflows.get(String(row.event_key));
    expect(workflow).toBeDefined();
    const result = await request(
      "/rpc/notification_business_event_check",
      { p_event: row.event, p_workflow: workflow, p_version: 1 },
      U,
      fixtureJwt("service_role"),
    );
    expect(result.status, String(row.event_key) + JSON.stringify(result.payload)).toBe(200);
    expect(result.payload, String(row.event_key)).toBe(true);
    const wrongVersion = await request(
      "/rpc/notification_business_event_check",
      { p_event: row.event, p_workflow: workflow, p_version: 2 },
      U,
      fixtureJwt("service_role"),
    );
    expect(wrongVersion.payload).toBe(false);
  }
  const assertAllBlocked = async (reason: string) => {
    for (const row of rows) {
      const result = await request(
        "/rpc/notification_business_event_check",
        { p_event: row.event, p_workflow: workflows.get(String(row.event_key)), p_version: 1 },
        U,
        fixtureJwt("service_role"),
      );
      expect(result.status, reason).toBe(200);
      expect(result.payload, reason + ":" + String(row.event_key)).toBe(false);
    }
  };
  const prefix = `techsales.inbox.${channel}.view.%`;
  const grants =
    await db`select permission_key,effect from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key like ${prefix}`;
  expect(grants.length).toBeGreaterThan(0);
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key like ${prefix}`;
  await assertAllBlocked("missing current channel permission");
  for (const grant of grants)
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${String(grant.permission_key)},${String(grant.effect)})`;
  const denied = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${denied},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${denied},${U},${W},${W})`;
  for (const grant of grants)
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${denied},${String(grant.permission_key)},'deny')`;
  await assertAllBlocked("explicit deny over current grant");
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${denied}`;
  await db`update workspace_members set workspace_id=${B} where workspace_id=${W} and user_id=${U}`;
  await assertAllBlocked("executor belongs to another workspace");
  await db`update workspace_members set workspace_id=${W} where workspace_id=${B} and user_id=${U}`;
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await assertAllBlocked("inactive executor");
  await db`update workspace_members set status='active' where workspace_id=${W} and user_id=${U}`;
  const ids = [...workflows.values()];
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set enabled=false where id=any(${ids}::uuid[])`,
  );
  await assertAllBlocked("paused workflow");
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set enabled=true where id=any(${ids}::uuid[])`,
  );
  await assertAllBlocked("reactivation does not replay pre-cutoff events");
}
it("Chat five named events retain real producer proof and published worker authorization", async () => {
  for (const key of [
    "techsales.inbox.chat.create.workspace",
    "techsales.inbox.chat.update.workspace",
    "techsales.inbox.chat.assign.workspace",
  ])
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},'grant') on conflict do nothing`;
  const workflows = await installChannelMatrix("chat", W);
  const conversation = randomUUID();
  await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status)
    values(${conversation},${W},${W},${U},'matrix_visitor_01','open')`;
  expect(
    (
      await request(
        "/rpc/widget_inbound_commit",
        {
          p_session: conversation,
          p_visitor: "matrix_visitor_01",
          p_request: randomUUID(),
          p_body: "Synthetic matrix inbound",
        },
        U,
        fixtureJwt("service_role"),
      )
    ).status,
  ).toBe(200);
  expect((await chatReply(conversation, "Synthetic matrix reply")).status).toBe(200);
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`update live_chat_sessions set assignee_id=${C},status='closed' where id=${conversation}`,
  );
  await checkChannelWorkerMatrix("chat", W, workflows);
});
it("Gmail four named events retain real incremental creation response and assignment worker proof", async () => {
  const account = await catalogAccount();
  for (const key of [
    "techsales.email_accounts.update.own",
    "techsales.inbox.email.view.workspace",
    "techsales.inbox.email.create.workspace",
    "techsales.inbox.email.update.workspace",
    "techsales.inbox.email.assign.workspace",
  ])
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},'grant') on conflict do nothing`;
  const workflows = await installChannelMatrix("email", account);
  const [clock] = await db`select clock_timestamp()::text at`;
  expect(
    await checkGmailTransport(ownedServiceClient(), W, account, U, String(clock!.at), false),
  ).toBeGreaterThan(0);
  const [conversation] = await db`select id from email_threads where account_id=${account}`;
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update email_threads set assigned_to=${C} where id=${String(conversation!.id)}`,
  );
  await checkChannelWorkerMatrix("email", account, workflows);
});
it("LinkedIn four named events retain personal account producer response and status worker proof", async () => {
  const account = await linkedinAccount();
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'techsales.inbox.linkedin.create.own','grant')`;
  const workflows = await installChannelMatrix("linkedin", account);
  expect((await linkedinInbound(account, "synthetic-matrix-linkedin")).response.status).toBe(200);
  const [conversation] =
    await db`select id from linkedin_conversations where account_id=${account}`;
  const receipt = randomUUID(),
    lease = randomUUID(),
    provider = "synthetic-matrix-response";
  await withRole(
    "service_role",
    null,
    (
      tx,
    ) => tx`insert into unipile_delivery_receipts(id,account_id,request_key,lease_token,status,inbox_request)
    values(${receipt},${account},${"d".repeat(64)},${lease},'started',${tx.json({ endpoint: "message.send", body: "Synthetic matrix reply", chat_id: "synthetic-chat" })})`,
  );
  const admin = ownedServiceClient();
  const finished = await admin.rpc("unipile_delivery_finish", {
    p_id: receipt,
    p_token: lease,
    p_status: "sent",
    p_response: { message_id: provider, chat_id: "synthetic-chat" },
  });
  expect(finished.error).toBeNull();
  const projected = await request(
    "/rpc/linkedin_outbound_commit",
    {
      p_conversation: String(conversation!.id),
      p_workspace: W,
      p_owner: U,
      p_message: provider,
      p_body: "Synthetic matrix reply",
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(projected.status).toBe(200);
  const changed = await fetch(fixtureHttpBase() + "/rpc/linkedin_conversation_edit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${fixtureJwt("authenticated", U)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_id: conversation!.id, p_status: "closed" }),
  });
  expect(changed.status).toBe(204);
  await checkChannelWorkerMatrix("linkedin", account, workflows);
});

async function emailSenderBoundary(actor: string, account: string) {
  const base = fixtureHttpBase();
  const client = createClient(base, fixtureJwt("authenticated", actor), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const url = String(input);
        if (!url.startsWith(base + "/rest/v1/")) throw new Error("Refused non-owned fixture URL");
        return fetch(base + url.slice((base + "/rest/v1").length), init);
      },
    },
  });
  // Exact gates used by the human email sender, with real SQL/RLS responses.
  await assertSalesAnyArea(client, "techsales.inbox.email", "create");
  await assertSalesRecord(client, "email_accounts", account, "view");
}
async function senderAccount() {
  const account = await catalogAccount();
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.email.create.workspace','grant') on conflict do nothing`;
  return account;
}
it("Email sender boundary permits the authorized active account owner", async () => {
  await expect(emailSenderBoundary(U, await senderAccount())).resolves.toBeUndefined();
});
it("Email sender boundary rejects a missing sending permission", async () => {
  await expect(emailSenderBoundary(N, await senderAccount())).rejects.toThrow();
});
it("Email sender boundary preserves explicit deny over sending grant", async () => {
  const account = await senderAccount(),
    deny = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${deny},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${deny},${C},${W},${W})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${deny},'techsales.inbox.email.create.workspace','deny')`;
  await expect(emailSenderBoundary(C, account)).rejects.toThrow();
});
it("Email sender boundary rejects an account in another workspace even with local sending rights", async () => {
  const account = await senderAccount(),
    role = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${role},${B})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${role},${F},${B},${B})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${B},${role},'techsales.inbox.email.create.workspace','grant'),(${B},${role},'techsales.inbox.email.view.workspace','grant'),(${B},${role},'techsales.email_accounts.view.workspace','grant')`;
  await expect(emailSenderBoundary(F, account)).rejects.toThrow("Registro indisponível");
});
it("Email sender boundary rejects an inactive workspace member", async () => {
  const account = await senderAccount();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await expect(emailSenderBoundary(U, account)).rejects.toThrow();
});

async function sourceForConfirmedAutomation(channel: keyof typeof channelMatrix) {
  if (channel === "chat") {
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'techsales.inbox.chat.create.workspace','grant') on conflict do nothing`;
    const workflows = await installChannelMatrix(channel, W),
      conversation = randomUUID();
    await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status) values(${conversation},${W},${W},${U},'automation_visitor','open')`;
    expect(
      (
        await request(
          "/rpc/widget_inbound_commit",
          {
            p_session: conversation,
            p_visitor: "automation_visitor",
            p_request: randomUUID(),
            p_body: "Synthetic automation input",
          },
          U,
          fixtureJwt("service_role"),
        )
      ).status,
    ).toBe(200);
    return { channel, account: W, conversation, workflows };
  }
  if (channel === "linkedin") {
    const account = await linkedinAccount();
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'techsales.inbox.linkedin.create.own','grant')`;
    const workflows = await installChannelMatrix(channel, account);
    expect((await linkedinInbound(account, "synthetic-automation-input")).response.status).toBe(
      200,
    );
    const [conversation] =
      await db`select id from linkedin_conversations where account_id=${account}`;
    return { channel, account, conversation: String(conversation!.id), workflows };
  }
  const account = await senderAccount();
  for (const key of ["techsales.email_accounts.update.own", "techsales.inbox.email.view.workspace"])
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},'grant') on conflict do nothing`;
  const workflows = await installChannelMatrix(channel, account),
    admin = ownedServiceClient(),
    provider = randomUUID(),
    lease = randomUUID(),
    conversation = randomUUID();
  await db`update email_accounts set history_id='501' where id=${account}`;
  const scope = { p_workspace: W, p_account: account };
  const queued = await admin.rpc("gmail_sync_enqueue", {
    ...scope,
    p_expected_history: "501",
    p_next_history: "502",
    p_provenance: "incremental",
    p_ids: [provider],
  });
  expect(queued.error).toBeNull();
  const claimed = await admin.rpc("gmail_sync_claim", { ...scope, p_token: lease });
  expect(claimed.error).toBeNull();
  const receipt = (claimed.data as { id: string; provider_message_id: string }[]).find(
    (r) => r.provider_message_id === provider,
  );
  expect(receipt).toBeDefined();
  const thread = await admin.from("email_threads").insert({
    id: conversation,
    workspace_id: W,
    owner_id: U,
    assigned_to: U,
    account_id: account,
    provider_thread_id: "synthetic-automation-thread",
    inbox_creation_receipt: receipt!.id,
  });
  expect(thread.error).toBeNull();
  const [clock] = await db`select clock_timestamp()::text at`;
  const message = await admin.from("email_messages").insert({
    workspace_id: W,
    owner_id: U,
    account_id: account,
    thread_id: conversation,
    provider_message_id: provider,
    direction: "inbound",
    body_text: "Synthetic automation input",
    received_at: String(clock!.at),
  });
  expect(message.error).toBeNull();
  const finished = await admin.rpc("gmail_sync_finish", {
    ...scope,
    p_id: receipt!.id,
    p_token: lease,
    p_outcome: "existing",
  });
  expect(finished.error).toBeNull();
  expect(finished.data).toBe(true);
  return { channel, account, conversation, workflows };
}
async function automationProjection(
  source: Awaited<ReturnType<typeof sourceForConfirmedAutomation>>,
  message: string,
  provider: string,
  body: string,
) {
  await withRole("service_role", null, async (tx) => {
    if (source.channel === "email")
      await tx`insert into email_messages(id,workspace_id,owner_id,account_id,thread_id,provider_message_id,direction,body_text) values(${message},${W},${U},${source.account},${source.conversation},${provider},'outbound',${body})`;
    else if (source.channel === "linkedin")
      await tx`insert into linkedin_messages(id,workspace_id,account_id,conversation_id,provider_message_id,direction,body) values(${message},${W},${source.account},${source.conversation},${provider},'outbound',${body})`;
    else
      await tx`insert into live_chat_messages(id,workspace_id,owner_id,session_id,direction,body) values(${message},${W},${W},${source.conversation},'outbound',${body})`;
  });
}
async function confirmedServiceResponse(channel: keyof typeof channelMatrix) {
  const source = await sourceForConfirmedAutomation(channel),
    enrollment = randomUUID(),
    session = randomUUID(),
    job = randomUUID(),
    message = randomUUID();
  const provider = channel === "chat" ? message : "synthetic-service-provider",
    body = "Synthetic confirmed service reply";
  await withRole("service_role", null, async (tx) => {
    await tx`insert into sdr_enrollments(id,workspace_id,owner_id) values(${enrollment},${W},${U})`;
    await tx`insert into service_agent_sessions(id,workspace_id,enrollment_id,channel,source_id) values(${session},${W},${enrollment},${channel},${source.conversation})`;
    await tx`insert into service_agent_jobs(id,workspace_id,session_id,status,send_started_at,send_token,draft_text) values(${job},${W},${session},'running',clock_timestamp(),${randomUUID()},${body})`;
    await tx`update service_agent_jobs set status='uncertain' where id=${job}`;
  });
  expect(
    await db`select id from inbox_channel_occurrences where conversation_id=${source.conversation} and event_key=${`shared.${channel}.first_response`}`,
  ).toHaveLength(0);
  await automationProjection(source, message, provider, body);
  // Exercise the new observer on the canonical private completion transition;
  // upstream agent/lease authorization remains covered by the existing SDR tests.
  await withRole(
    "service_role",
    null,
    (tx) =>
      tx`update service_agent_jobs set status='sent',sent_at=clock_timestamp(),outbound_message_id=${message},provider_message_id=${provider} where id=${job}`,
  );
  const [occurrence] =
    await db`select o.id,e.id event from inbox_channel_occurrences o join workflow_events e on e.entity_id=o.id where o.conversation_id=${source.conversation} and o.event_key=${`shared.${channel}.first_response`}`;
  expect(occurrence).toBeDefined();
  const checked = await request(
    "/rpc/notification_business_event_check",
    {
      p_event: occurrence!.event,
      p_workflow: source.workflows.get(`shared.${channel}.first_response`),
      p_version: 1,
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(checked.payload).toBe(true);
  await withRole(
    "service_role",
    null,
    (tx) => tx`update service_agent_jobs set status='sent' where id=${job}`,
  );
  expect(
    await db`select id from inbox_channel_occurrences where conversation_id=${source.conversation} and event_key=${`shared.${channel}.first_response`}`,
  ).toHaveLength(1);
}
it("SDR email completion attests first response while uncertain projection alone does not", async () => {
  await expect(confirmedServiceResponse("email")).resolves.toBeUndefined();
});
it("SDR chat completion attests first response without a human request marker", async () => {
  await expect(confirmedServiceResponse("chat")).resolves.toBeUndefined();
});
it("SDR LinkedIn completion attests first response from the current private job", async () => {
  await expect(confirmedServiceResponse("linkedin")).resolves.toBeUndefined();
});
it("Gmail sequence first response binds private succeeded effect and invalidates altered receipt", async () => {
  const source = await sourceForConfirmedAutomation("email"),
    run = randomUUID(),
    effect = randomUUID(),
    provider = "synthetic-sequence-provider",
    body = "Synthetic sequence reply";
  await db`insert into prospecting_sequence_runs(id,workspace_id,owner_id) values(${run},${W},${U})`;
  await db`insert into prospecting_sequence_effects(id,workspace_id,run_id,kind,status,provider_receipt,sender,finished_at)
    values(${effect},${W},${run},'email','succeeded',${db.json({ messageId: provider, body })},${db.json({ sourceKey: source.account })},clock_timestamp())`;
  await automationProjection(source, effect, provider, body);
  const [occurrence] =
    await db`select o.id,e.id event from inbox_channel_occurrences o join workflow_events e on e.entity_id=o.id where o.conversation_id=${source.conversation} and o.event_key='shared.email.first_response'`;
  expect(occurrence).toBeDefined();
  const check = () =>
    request(
      "/rpc/notification_business_event_check",
      {
        p_event: occurrence!.event,
        p_workflow: source.workflows.get("shared.email.first_response"),
        p_version: 1,
      },
      U,
      fixtureJwt("service_role"),
    );
  expect((await check()).payload).toBe(true);
  // Privileged fixture corruption is not a claimed client capability: even it
  // must invalidate the current private proof before any subsequent effect.
  await db`update prospecting_sequence_effects set provider_receipt=${db.json({ messageId: provider, body: "Altered private receipt" })} where id=${effect}`;
  expect((await check()).payload).toBe(false);
});

it("Inbox account catalogue allows authorized bounded metadata without credentials", async () => {
  const account = await catalogAccount();
  const result = await catalog();
  expect(result.status).toBe(200);
  expect(result.payload).toEqual({
    workspace_id: W,
    channel: "email",
    sources: [{ id: account, label: "catalog@example.invalid" }],
  });
});
it("Inbox account catalogue rejects a missing channel key before enumerating accounts", async () => {
  await catalogAccount();
  await db`delete from job_role_permission_overrides where role_id=${ROLE}
    and permission_key='techsales.inbox.email.view.workspace'`;
  const result = await catalog();
  expect(result.status).toBe(403);
  expect(result.payload).toMatchObject({ code: "42501" });
});
it("Inbox account catalogue preserves explicit deny over another role grant", async () => {
  await catalogAccount();
  const deniedRole = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${deniedRole},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id)
    values(${deniedRole},${U},${W},${A})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${deniedRole},'techsales.inbox.email.view.workspace','deny')`;
  const result = await catalog();
  expect(result.status).toBe(403);
  expect(result.payload).toMatchObject({ code: "42501" });
});
it("Inbox account catalogue rejects an actor from another workspace", async () => {
  await catalogAccount();
  const result = await catalog(F);
  expect(result.status).toBe(403);
  expect(result.payload).toMatchObject({ code: "42501" });
});
it("Inbox account catalogue rejects an inactive member", async () => {
  await catalogAccount();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  const result = await catalog();
  expect(result.status).toBe(403);
  expect(result.payload).toMatchObject({ code: "42501" });
});
it("Inbox account catalogue also requires Workflow view independently of channel rights", async () => {
  await catalogAccount();
  await db`delete from job_role_permission_overrides where role_id=${ROLE}
    and permission_key='system.workflows.view.workspace'`;
  const result = await catalog();
  expect(result.status).toBe(403);
  expect(result.payload).toMatchObject({ code: "42501" });
});

it("Inbox author guard checks five JWT profiles via real PostgREST with empty and absent filters", async () => {
  const missingRole = randomUUID();
  const denyRole = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${missingRole},${W}),(${denyRole},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${missingRole},${N},${W},${W}),(${denyRole},${C},${W},${W})`;
  for (const key of [
    "system.workflows.view.workspace",
    "system.workflows.manage.workspace",
    "system.workflows.create.workspace",
    "system.workflows.update.workspace",
  ]) {
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${missingRole},${key},'grant')`;
  }
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'techsales.inbox.linkedin.view.own','grant')`;
  for (const key of [
    "techsales.inbox.chat.view.workspace",
    "techsales.inbox.email.view.workspace",
    "techsales.inbox.linkedin.view.own",
  ]) {
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${denyRole},${key},'deny')`;
  }
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${D}`;
  const users = new Map([
    [11, U],
    [12, N],
    [13, C],
    [14, F],
    [15, D],
  ]);
  const user = (n: number) => {
    const id = users.get(n);
    if (!id) throw new Error("Unknown disposable guard profile");
    return id;
  };
  const checks = await checkInboxWorkflowGuard(
    async (actor, method, path, body) => {
      const response = await fetch(fixtureHttpBase() + path, {
        method,
        headers: {
          Authorization: `Bearer ${actor === null ? fixtureJwt("service_role") : fixtureJwt("authenticated", user(actor))}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        body: (await response.json().catch(() => null)) as unknown,
      };
    },
    W,
    user,
    true,
  );
  expect(checks).toBe(60);
});
async function createDraft() {
  // Remove only the disposable base fixture; create through the actual author.
  await db`delete from workflows where id=${WF}`;
  const payload = workflowDraftInsert(
    {
      name: "Inbox lifecycle",
      entity: "inbox_channel_occurrences",
      enabled: true,
      trigger: {
        event: "updated",
        notification_event: {
          key: "shared.chat.message_received",
          channel: "chat",
          account_ids: [],
        },
      },
      actions: [{ type: "notify", title: "Atualização disponível", recipients: rules, delivery }],
    },
    U,
    W,
  );
  await withRole(
    "authenticated",
    U,
    (
      tx,
    ) => tx`insert into workflows(id,name,workspace_id,owner_id,entity,enabled,status,trigger,actions,draft_trigger,draft_actions)
    values(${WF},${payload.name},${W},${U},${payload.entity},${payload.enabled},${payload.status},${tx.json(payload.trigger)},${tx.json(payload.actions)},${tx.json(payload.draft_trigger)},${tx.json(payload.draft_actions)})`,
  );
  return payload;
}

async function event(recipient = U, legacy = false, existingConversation?: string) {
  if (!existingConversation) {
    const draft = await createDraft();
    await withRole(
      "authenticated",
      U,
      (tx) => tx`update workflows set
      draft_trigger=${tx.json(workflowDraftFields({ ...draft, trigger: draft.draft_trigger, actions: draft.draft_actions }).draft_trigger)}
      where id=${WF}`,
    );
    await withRole(
      "authenticated",
      U,
      (tx) => tx`update workflows set
      trigger=draft_trigger,actions=draft_actions,status='published',
      published_version=published_version+1,execution_user_id=${U} where id=${WF}`,
    );
    await withRole(
      "authenticated",
      U,
      (tx) => tx`update workflows set
      enabled=true,execution_user_id=${U} where id=${WF}`,
    );
  }

  const conversation = existingConversation ?? randomUUID();
  if (!existingConversation)
    await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status)
      values(${conversation},${W},${W},${recipient},'portable_visitor_01','open')`;
  const produced = await request(
    "/rpc/widget_inbound_commit",
    {
      p_session: conversation,
      p_visitor: "portable_visitor_01",
      p_request: randomUUID(),
      p_body: "Private disposable widget input",
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(produced.status).toBe(200);
  // The legacy producer executes normally. A real read makes room for a fresh
  // Workflow notice without altering preferences, consent or transport limits.
  if (!legacy)
    await db`update notifications set read_at=clock_timestamp()
    where entity='inbox_conversation' and entity_id=${conversation}`;
  const [source] = await db`select o.id,e.id event from inbox_channel_occurrences o
    join workflow_events e on e.entity_id=o.id where o.message_id=${produced.payload}
    and o.event_key='shared.chat.message_received'`;
  if (!source) throw new Error("Real widget producer did not create its canonical event");
  const run = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id)
    select ${run},workspace_id,owner_id,id,${source["event"]},entity,${source["id"]} from workflows where id=${WF}`;
  return { conversation, occurrence: String(source["id"]), run };
}
async function dispatch(input: Awaited<ReturnType<typeof event>>, v2 = false) {
  const result = await request(
    `/rpc/notification_workflow_dispatch${v2 ? "_v2" : ""}`,
    {
      p_workflow: WF,
      p_run: input.run,
      p_version: 1,
      p_entity: "inbox_channel_occurrences",
      p_record: input.occurrence,
      p_rules: rules,
      p_title: "Atualização disponível",
      p_body: null,
      p_step: "1",
      ...(v2 ? { p_delivery: delivery } : {}),
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(result.status).toBe(200);
  return result.payload;
}
async function assertRecipient(recipient: string, allowed: boolean, candidates = 1) {
  const input = await event(recipient);
  const result = await dispatch(input);
  expect(result).toMatchObject({
    candidates,
    sent: allowed ? 1 : 0,
    excluded: allowed ? 0 : candidates,
    duplicate: 0,
  });
  expect(await dispatch(input, true)).toMatchObject({
    candidates,
    sent: 0,
    excluded: allowed ? 0 : candidates,
    duplicate: allowed ? 1 : 0,
  });
  expect(await db`select id from notifications where entity_id=${input.occurrence}`).toHaveLength(
    allowed ? 1 : 0,
  );
  // The current-responsible resolver never nominates a foreign/inactive member.
  // Such a missing source is different from a nominated member denied row access.
  if (candidates === 0) expect(result.issues).toContain("recipient_source_unavailable");
}

it("Inbox blocked version refuses authorized activation without replacing any other control", async () => {
  const draft = await createDraft();
  const [before] = await db`select to_jsonb(w) value from workflows w where id=${WF}`;
  if (!before) throw new Error("Missing workflow for blocked activation test");
  await withInboxAvailabilityLock(db, async () => {
    await expect(
      withRole(
        "authenticated",
        U,
        (tx) => tx`update workflows set
      enabled=false,status='published',execution_user_id=${U},entity='inbox_channel_occurrences',
      published_version=1,trigger=${tx.json(draft.draft_trigger)},actions=${tx.json(draft.draft_actions)}
      where id=${WF}`,
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message:
        "Gatilhos multicanal ainda em revisão: produtores, provas, destinatários e validações precisam ser concluídos antes da ativação.",
    });
  });
  expect(await db`select to_jsonb(w) value from workflows w where id=${WF}`).toEqual([before]);
  // Same actor/configuration succeeds with availability alone removed, through
  // the real producer and dispatcher—not through an authorization bypass.
  const input = await event();
  expect(await dispatch(input)).toMatchObject({ sent: 1, excluded: 0, candidates: 1 });
});

it("Inbox real dispatch allows an active authorized recipient", async () => {
  await expect(assertRecipient(U, true)).resolves.toBeUndefined();
});
it("Inbox exposes only authorized occurrence metadata and denies its private proof column", async () => {
  const input = await event();
  const path = `/inbox_channel_occurrences?select=id,event_key&id=eq.${input.occurrence}`;
  const allowed = await request(path, undefined, U);
  expect(allowed.status).toBe(200);
  expect(allowed.payload).toEqual([
    { id: input.occurrence, event_key: "shared.chat.message_received" },
  ]);
  const missing = await request(path, undefined, N);
  expect(missing.status).toBe(200);
  expect(missing.payload).toEqual([]);
  const proof = await request(
    `/inbox_channel_occurrences?select=id,envelope_id&id=eq.${input.occurrence}`,
    undefined,
    U,
  );
  expect(proof.status).toBe(403);
  expect(proof.payload.code).toBe("42501");
});
it("Inbox private receipt and proof tables remain unavailable through authenticated HTTP", async () => {
  for (const [table, column] of [
    ["inbox_channel_evidence", "id"],
    ["inbox_widget_receipts", "session_id"],
    ["inbox_unipile_envelopes", "account_id"],
    ["gmail_sync_queue", "id"],
    ["notification_business_event_proofs", "event_id"],
  ]) {
    const result = await request(`/${table}?select=${column}`, undefined, U);
    expect(result.status, table).toBe(403);
    expect(result.payload.code, table).toBe("42501");
  }
});
it("Gmail assigned Inbox own recipient receives and opens a real notice without account configuration access", async () => {
  const recipientRole = randomUUID();
  await db`delete from user_job_roles where user_id=${U} and workspace_id=${W}`;
  await db`insert into job_roles(id,workspace_id) values(${recipientRole},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id)
    values(${recipientRole},${U},${W},${A})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${recipientRole},'techsales.inbox.email.view.own','grant')`;
  const account = randomUUID(),
    conversation = randomUUID(),
    message = randomUUID();
  // The mailbox owner is authorized for background sync. The assigned Inbox
  // recipient gets no account-management role or key, even temporarily.
  const accountRole = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${accountRole},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id)
    values(${accountRole},${A},${W},${A})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${accountRole},'techsales.email_accounts.view.own','grant'),
      (${W},${accountRole},'techsales.email_accounts.update.own','grant')`;
  const providerId = `gmail_ci_${randomUUID().replaceAll("-", "")}`;
  await db`insert into email_accounts(id,workspace_id,owner_id,provider,status,email,history_id)
    values(${account},${W},${A},'gmail','connected','disposable@example.invalid','100')`;
  await db`insert into email_threads(id,workspace_id,owner_id,assigned_to,account_id,provider_thread_id)
    values(${conversation},${W},${A},${U},${account},'disposable_provider_thread')`;
  await withRole(
    "authenticated",
    C,
    (tx) => tx`update workflows set
    execution_user_id=${C},entity='inbox_channel_occurrences',
    trigger=${tx.json({ event: "updated", notification_event: { key: "shared.email.message_received", channel: "email", account_ids: [] } })},
    actions=${tx.json([{ type: "notify", title: "Atualização disponível", recipients: rules, delivery }])}
    where id=${WF}`,
  );
  const [clock] = await db`select clock_timestamp()::text occurred`;
  const service = fixtureJwt("service_role");
  const queued = await request(
    "/rpc/gmail_sync_enqueue",
    {
      p_workspace: W,
      p_account: account,
      p_expected_history: "100",
      p_next_history: "101",
      p_provenance: "incremental",
      p_ids: [providerId],
    },
    U,
    service,
  );
  expect(queued.status, JSON.stringify(queued.payload)).toBe(200);
  const lease = randomUUID();
  const claimed = await request(
    "/rpc/gmail_sync_claim",
    {
      p_workspace: W,
      p_account: account,
      p_token: lease,
    },
    U,
    service,
  );
  expect(claimed.status).toBe(200);
  const item = claimed.payload.find(
    (row: { provider_message_id: string }) => row.provider_message_id === providerId,
  );
  expect(item).toBeDefined();
  await db`insert into email_messages(id,workspace_id,owner_id,account_id,thread_id,
    provider_message_id,direction,received_at,body_text)
    values(${message},${W},${A},${account},${conversation},${providerId},'inbound',
      ${String(clock!["occurred"])},'Disposable private message body')`;
  // Models recovery after message persistence but before queue acknowledgement.
  const finish = await request(
    "/rpc/gmail_sync_finish",
    {
      p_workspace: W,
      p_account: account,
      p_id: item.id,
      p_token: lease,
      p_outcome: "existing",
    },
    U,
    service,
  );
  expect(finish.status).toBe(200);
  expect(finish.payload).toBe(true);
  const [source] = await db`select o.id,e.id event from inbox_channel_occurrences o
    join workflow_events e on e.entity_id=o.id
    where o.message_id=${message} and o.event_key='shared.email.message_received'`;
  expect(source).toBeDefined();
  await db`update notifications set read_at=clock_timestamp()
    where entity='inbox_conversation' and entity_id=${conversation}`;
  const run = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id)
    select ${run},workspace_id,owner_id,id,${String(source!["event"])},entity,${String(source!["id"])}
    from workflows where id=${WF}`;
  const input = { conversation, occurrence: String(source!["id"]), run };
  expect(await dispatch(input, true)).toMatchObject({ sent: 1, candidates: 1, excluded: 0 });
  const notices = await db`select id,link from notifications where entity_id=${input.occurrence}`;
  expect(notices).toHaveLength(1);
  expect(notices[0]!.link).toBe(`/inbox/email?conversation=${conversation}`);
  const accountRead = await request(`/email_accounts?select=id&id=eq.${account}`, undefined, U);
  expect(accountRead.status).toBe(200);
  expect(accountRead.payload).toEqual([]);
  const workflowRead = await request(`/workflows?select=id&id=eq.${WF}`, undefined, U);
  expect(workflowRead.status).toBe(200);
  expect(workflowRead.payload).toEqual([]);
  const threadRead = await request(`/email_threads?select=id&id=eq.${conversation}`, undefined, U);
  expect(threadRead.status).toBe(200);
  expect(threadRead.payload).toEqual([{ id: conversation }]);
  const noticeRead = await request(
    `/notifications?select=id&id=eq.${String(notices[0]!.id)}`,
    undefined,
    U,
  );
  expect(noticeRead.status).toBe(200);
  expect(noticeRead.payload).toEqual([{ id: notices[0]!.id }]);
  await db`update email_threads set assigned_to=${N} where id=${conversation}`;
  const revokedRead = await request(
    `/notifications?select=id&id=eq.${String(notices[0]!.id)}`,
    undefined,
    U,
  );
  expect(revokedRead.status).toBe(200);
  expect(revokedRead.payload).toEqual([]);
});
it("Inbox real dispatch excludes a recipient without the permission key", async () => {
  await expect(assertRecipient(N, false)).resolves.toBeUndefined();
});
it("Inbox real dispatch excludes an explicitly denied recipient", async () => {
  const deniedRole = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${deniedRole},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${deniedRole},${N},${W},${W})`;
  const grantedRole = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${grantedRole},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${grantedRole},${N},${W},${W})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${grantedRole},'techsales.inbox.chat.view.workspace','grant'),(${W},${deniedRole},'techsales.inbox.chat.view.workspace','deny')`;
  await expect(assertRecipient(N, false)).resolves.toBeUndefined();
});
it("Inbox real dispatch excludes another workspace recipient", async () => {
  await expect(assertRecipient(F, false, 0)).resolves.toBeUndefined();
});
it("Inbox real dispatch excludes an inactive recipient", async () => {
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${ROLE},${N},${W},${W})`;
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${N}`;
  await expect(assertRecipient(N, false, 0)).resolves.toBeUndefined();
});
it("Inbox real v2 dispatch creates one intent and conversation href and replays without new effects", async () => {
  const input = await event();
  expect(await dispatch(input, true)).toMatchObject({ sent: 1, candidates: 1, duplicate: 0 });
  expect(await dispatch(input, true)).toMatchObject({ sent: 0, duplicate: 1 });
  const notices = await db`select link from notifications where entity_id=${input.occurrence}`;
  expect(notices).toEqual([{ link: `/inbox/chat?conversation=${input.conversation}` }]);
  expect(
    await db`select id from notification_delivery_intents where run_id=${input.run}`,
  ).toHaveLength(1);
});
it("Inbox legacy producer and real Workflow dispatch reuse exactly one unread notice", async () => {
  const input = await event(U, true);
  expect(await dispatch(input)).toMatchObject({ sent: 0, duplicate: 1 });
  expect(await db`select id from notifications where user_id=${U}`).toHaveLength(1);
});
it("Inbox real dispatch revalidates executor revocation", async () => {
  const input = await event();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE}
    and permission_key='system.workflows.manage.workspace'`;
  const result = await request(
    "/rpc/notification_workflow_dispatch",
    {
      p_workflow: WF,
      p_run: input.run,
      p_version: 1,
      p_entity: "inbox_channel_occurrences",
      p_record: input.occurrence,
      p_rules: rules,
      p_title: "Atualização disponível",
      p_body: null,
      p_step: "1",
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(result.status).toBe(403);
  expect(await db`select id from notifications where entity_id=${input.occurrence}`).toHaveLength(
    0,
  );
});

it("Inbox two real concurrent Workflow dispatches reuse one unread notice with exact counters", async () => {
  const first = await event();
  // Use two real messages/events in the same conversation. A duplicate run for
  // one event is correctly rejected by the canonical run uniqueness constraint.
  const second = await event(U, false, first.conversation);
  const results = await Promise.all([dispatch(first), dispatch(second)]);
  expect(results.map((value) => value.sent).sort()).toEqual([0, 1]);
  expect(results.map((value) => value.duplicate).sort()).toEqual([0, 1]);
  expect(results.map((value) => value.candidates)).toEqual([1, 1]);
  expect(
    await db`select id from notifications where entity='inbox_channel_occurrences'
    and entity_id in (${first.occurrence},${second.occurrence}) and read_at is null`,
  ).toHaveLength(1);
});

async function resumeEvent(parent: string, patch: Record<string, unknown> = {}) {
  const [root] = await db`select * from workflow_events where id=${parent}`;
  if (!root) throw new Error("Missing synthetic parent event");
  const id = randomUUID();
  const row = {
    id,
    workspace_id: W,
    owner_id: root.owner_id,
    entity: root.entity,
    entity_id: root.entity_id,
    event_type: "updated",
    before: root.before,
    after: { ...(root.after as Record<string, unknown>), __wf_state: { cursor: 1 } },
    notification_event_key: root.notification_event_key,
    notification_parent_event_id: parent,
    resume_workflow_id: WF,
    workflow_version: 1,
    resume_cursor: 1,
    ...patch,
  };
  await withRole("service_role", null, (tx) => tx`insert into workflow_events ${tx(row)}`);
  return id;
}
it("Inbox valid resumptions retain private root ancestry and current workflow authorization", async () => {
  const source = await event();
  const [run] = await db`select event_id from workflow_runs where id=${source.run}`;
  const child = await resumeEvent(String(run!.event_id));
  const checked = await request(
    "/rpc/notification_business_event_check",
    { p_event: child, p_workflow: WF, p_version: 1 },
    U,
    fixtureJwt("service_role"),
  );
  expect(checked.status, JSON.stringify(checked.payload)).toBe(200);
  expect(checked.payload).toBe(true);
  const current = async () =>
    (
      await request(
        "/rpc/notification_business_event_check",
        { p_event: child, p_workflow: WF, p_version: 1 },
        U,
        fixtureJwt("service_role"),
      )
    ).payload;
  const grants = await db`select permission_key,effect from job_role_permission_overrides
    where workspace_id=${W} and role_id=${ROLE} and permission_key like 'techsales.inbox.chat.view.%'`;
  expect(grants.length).toBeGreaterThan(0);
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE}
    and permission_key like 'techsales.inbox.chat.view.%'`;
  expect(await current()).toBe(false);
  for (const grant of grants)
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},${String(grant.permission_key)},${String(grant.effect)})`;
  expect(await current()).toBe(true);
  await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE}
    and permission_key like 'techsales.inbox.chat.view.%'`;
  expect(await current()).toBe(false);
  for (const grant of grants)
    await db`update job_role_permission_overrides set effect=${String(grant.effect)}
    where workspace_id=${W} and role_id=${ROLE} and permission_key=${String(grant.permission_key)}`;
  expect(await current()).toBe(true);
  await db`update workspace_members set workspace_id=${B} where workspace_id=${W} and user_id=${U}`;
  expect(await current()).toBe(false);
  await db`update workspace_members set workspace_id=${W} where workspace_id=${B} and user_id=${U}`;
  expect(await current()).toBe(true);
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect(await current()).toBe(false);
  await db`update workspace_members set status='active' where workspace_id=${W} and user_id=${U}`;
  expect(await current()).toBe(true);
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set published_version=2 where id=${WF}`,
  );
  const stale = await request(
    "/rpc/notification_business_event_check",
    { p_event: child, p_workflow: WF, p_version: 1 },
    U,
    fixtureJwt("service_role"),
  );
  expect(stale.payload).toBe(false);
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set published_version=1,enabled=false where id=${WF}`,
  );
  expect(await current()).toBe(false);
  await withRole("authenticated", U, (tx) => tx`update workflows set enabled=true where id=${WF}`);
  expect(await current()).toBe(false); // The original root predates the new activation cutoff.
});
it("Inbox forged continuation metadata and parent fail atomically without new proof", async () => {
  const source = await event();
  const [run] = await db`select event_id from workflow_runs where id=${source.run}`;
  const [parent] = await db`select after from workflow_events where id=${String(run!.event_id)}`;
  const before = await db`select count(*)::int count from notification_business_event_proofs`;
  await expect(
    resumeEvent(String(run!.event_id), {
      after: { ...(parent!.after as Record<string, unknown>), channel: "email" },
    }),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    resumeEvent(String(run!.event_id), { notification_parent_event_id: randomUUID() }),
  ).rejects.toMatchObject({ code: "42501" });
  const after = await db`select count(*)::int count from notification_business_event_proofs`;
  expect(after).toEqual(before);
});

it("Inbox scheduled resolver checks the real proof and denies after current executor revocation", async () => {
  const input = await event();
  await dispatch(input, true);
  const [intent] = await db`select id from notification_delivery_intents where run_id=${input.run}`;
  if (!intent) throw new Error("The real v2 dispatch did not create its initial intent");
  const resolve = () =>
    db.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
      const [result] =
        await tx`select techerp_api.notification_schedule_recipients(${intent["id"]},'{"kind":"source_responsible"}') recipients`;
      if (!result) throw new Error("Missing scheduled resolution result");
      return result["recipients"] as unknown;
    });
  expect(await resolve()).toEqual([U]);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE}
    and permission_key='system.workflows.manage.workspace'`;
  expect(await resolve()).toEqual([]);
});

it("Inbox real Slack dispatch queues exactly once and replay creates no duplicate", async () => {
  const input = await event();
  await withRole("authenticated", U, async (tx) => {
    await tx`update workflows set actions='[{"type":"send_slack","text":"Atualização disponível"}]' where id=${WF}`;
    const [integration] = await tx`select id from slack_integrations where workspace_id=${W}`;
    if (!integration) throw new Error("Missing disposable Slack integration");
    await tx`select notification_slack_settings_save(${W},${tx.json({ enabled: true, daily_limit: 10, integration_id: String(integration["id"]), template_version: "neutral-v1" })},0)`;
  });
  const call = () =>
    request(
      "/rpc/notification_workflow_slack_dispatch",
      {
        p_workspace: W,
        p_workflow: WF,
        p_run: input.run,
        p_step_path: "1",
        p_version: 1,
      },
      U,
      fixtureJwt("service_role"),
    );
  const first = await call();
  expect(first.status).toBe(200);
  expect(first.payload).toMatchObject({ result: "queued" });
  const second = await call();
  expect(second.status).toBe(200);
  expect(second.payload).toMatchObject({
    result: "duplicate",
    deliveryId: first.payload.deliveryId,
  });
  expect(
    await db`select id from workflow_deliveries where notification_slack_intent_id is not null`,
  ).toHaveLength(1);
});

it("Inbox real draft cycle pauses/reactivates, discards edits and rejects invalid live placeholders atomically", async () => {
  await event();
  await withRole("authenticated", U, (tx) => tx`update workflows set enabled=false where id=${WF}`);
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set enabled=true,execution_user_id=${U} where id=${WF}`,
  );
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update workflows set draft_trigger=trigger,draft_actions=actions where id=${WF}`,
  );
  const [before] = await db`select to_jsonb(w) value from workflows w where id=${WF}`;
  if (!before) throw new Error("Missing published workflow");
  for (const values of [
    { trigger: {}, actions: [] },
    { entity: "deals" },
    { draft_trigger: {}, draft_actions: [] },
  ]) {
    await expect(
      withRole(
        "authenticated",
        U,
        (tx) => tx`update workflows set
      trigger=coalesce(${tx.json(values)}->'trigger',trigger),actions=coalesce(${tx.json(values)}->'actions',actions),
      entity=coalesce(${tx.json(values)}->>'entity',entity),draft_trigger=coalesce(${tx.json(values)}->'draft_trigger',draft_trigger),
      draft_actions=coalesce(${tx.json(values)}->'draft_actions',draft_actions) where id=${WF}`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await db`select to_jsonb(w) value from workflows w where id=${WF}`).toEqual([before]);
  }
});

async function replyFixture() {
  const account = await senderAccount(),
    conversation = randomUUID();
  await db`insert into email_threads(id,workspace_id,owner_id,assigned_to,account_id,provider_thread_id)
    values(${conversation},${W},${U},${U},${account},'synthetic-reply-thread')`;
  await db`insert into email_messages(workspace_id,owner_id,account_id,thread_id,provider_message_id,direction,body_text)
    values(${W},${U},${account},${conversation},'synthetic-reply-parent','inbound','Synthetic metadata source only')`;
  return { conversationId: conversation, workspace: W, actor: U, accountId: account };
}
it("Gmail reply boundary allows the authorized active owner and preserves exact thread identity", async () => {
  const input = await replyFixture();
  await expect(resolveGmailReply(ownedServiceClient(U), input)).resolves.toEqual({
    conversationId: input.conversationId,
    accountId: input.accountId,
    providerThreadId: "synthetic-reply-thread",
    providerMessageId: "synthetic-reply-parent",
  });
});
it("Gmail reply boundary rejects a missing permission", async () => {
  const input = await replyFixture();
  await expect(resolveGmailReply(ownedServiceClient(N), { ...input, actor: N })).rejects.toThrow();
});
it("Gmail reply boundary preserves explicit deny over thread sending grant", async () => {
  const input = await replyFixture();
  await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE}
    and permission_key='techsales.inbox.email.create.workspace'`;
  await expect(resolveGmailReply(ownedServiceClient(U), input)).rejects.toThrow();
});
it("Gmail reply boundary rejects a foreign workspace", async () => {
  const input = await replyFixture();
  await expect(
    resolveGmailReply(ownedServiceClient(F), { ...input, actor: F, workspace: B }),
  ).rejects.toThrow();
});
it("Gmail reply boundary rejects an inactive member", async () => {
  const input = await replyFixture();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await expect(resolveGmailReply(ownedServiceClient(U), input)).rejects.toThrow();
});
it("Gmail reply boundary rejects a divergent account and a disconnected original account", async () => {
  const input = await replyFixture();
  await expect(
    resolveGmailReply(ownedServiceClient(U), { ...input, accountId: randomUUID() }),
  ).rejects.toThrow("divergente");
  await db`update email_accounts set status='disconnected' where id=${input.accountId}`;
  await expect(resolveGmailReply(ownedServiceClient(U), input)).rejects.toThrow();
});

it("Inbox reviewed release SQL enables real runtime while preserving every authorization control", async () => {
  await withInboxAvailabilityLock(
    db,
    async () => {
      const [guard] =
        await db`select tgenabled from pg_trigger where tgname='inbox_runtime_release_guard'`;
      expect(guard?.tgenabled).toBe("O");
    },
    true,
  );
  expect(
    await db`select oid from pg_trigger where tgname='inbox_runtime_release_guard'`,
  ).toHaveLength(0);
  const source = await event();
  expect(await dispatch(source)).toMatchObject({ candidates: 1, sent: 1 });
});
