/** Real local GoTrue sessions + PostgREST/RLS. No SET ROLE, forged JWT, real provider or lock removal. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkInboxDispatchCaller } from "../../tests/fixtures/inbox/dispatch-caller";
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../tests/fixtures/inbox/load";

assertDisposableInboxTarget(process.env, process.argv);
loadDisposableInboxFixtures("unipile");
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!key) throw new Error("Not executed: local service credential missing.");
const base = "http://127.0.0.1:8001";
const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
if (key.split(".").length === 3) headers["Authorization"] = `Bearer ${key}`;
const ws = "fa110000-0000-4000-8000-000000000001";
const account = "fc110000-0000-4000-8000-000000000001";
const thread = "c0422000-0000-4000-8000-000000000001";
const user = (n: number) => `fb110000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const prefix = `central_${crypto.randomUUID().replaceAll("-", "")}`;
let checks = 0;
const pass = (label: string) => {
  checks++;
  console.log(`PASS ${label}`);
};
function sql(query: string) {
  const r = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error("Disposable SQL check failed; private output withheld.");
  return r.stdout.trim();
}
async function api(path: string, body?: unknown, token?: string, method = "POST") {
  const h = { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const r = await fetch(base + path, {
    method,
    headers: h,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = (await r.json().catch(() => null)) as any;
  return { ok: r.ok, value, status: r.status };
}
async function rpc(name: string, body: unknown, token?: string) {
  const r = await api(`/rest/v1/rpc/${name}`, body, token);
  if (!r.ok)
    throw new Error(`Local RPC ${name}: ${r.value?.code ?? "failure"} ${r.value?.message ?? ""}`);
  return r.value as any;
}
async function patch(table: string, id: string, values: unknown) {
  const r = await api(`/rest/v1/${table}?id=eq.${id}`, values, undefined, "PATCH");
  assert.equal(r.ok, true, `patch ${table}`);
}
const sessions = new Map<number, string>();
for (const n of [6, 7, 8, 9, 10]) {
  const email = `central-disposable-${n}@example.invalid`;
  const password = crypto.randomUUID() + crypto.randomUUID();
  const created = await api("/auth/v1/admin/users", {
    id: user(n),
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Central disposable test" },
  });
  if (!created.ok) {
    const updated = await api(`/auth/v1/admin/users/${user(n)}`, { password }, undefined, "PUT");
    assert.equal(updated.ok, true, "local test identity setup");
  }
  const session = await api("/auth/v1/token?grant_type=password", { email, password });
  assert.equal(session.ok, true, "real GoTrue login");
  assert.equal(session.value.user.id, user(n));
  sessions.set(n, session.value.access_token);
}
const setup = spawnSync(
  "psql",
  [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "--single-transaction",
    "-f",
    fileURLToPath(new URL("../../tests/fixtures/inbox/central.sql", import.meta.url)),
  ],
  { encoding: "utf8" },
);
if (setup.status !== 0) throw new Error("Explicit central fixture setup failed; output withheld.");
for (const n of [6, 7, 8, 9, 10])
  await patch("profiles", user(n), {
    active_workspace_id: n === 9 ? "fa110000-0000-4000-8000-000000000002" : ws,
  });
await patch("email_accounts", account, { status: "connected", history_id: "1000" });

const scope = { p_workspace: ws, p_account: account };
const providerId = prefix + "_retry";
await rpc("gmail_sync_enqueue", {
  ...scope,
  p_expected_history: "1000",
  p_next_history: "1001",
  p_provenance: "incremental",
  p_ids: [providerId],
});
const lease = crypto.randomUUID();
const claimed = (await rpc("gmail_sync_claim", { ...scope, p_token: lease })) as Array<{
  id: string;
  provider_message_id: string;
}>;
const q = claimed.find((r) => r.provider_message_id === providerId);
assert.ok(q);
const missing = await api("/rest/v1/rpc/gmail_sync_finish", {
  ...scope,
  p_id: q.id,
  p_token: lease,
  p_outcome: "existing",
});
assert.equal(missing.ok, false);
assert.equal(sql(`SELECT state FROM public.gmail_sync_queue WHERE id='${q.id}'`), "pending");
pass("finish does not mark done before message/proof reconciliation");
const mid = crypto.randomUUID();
const providerTime = "2026-11-22T00:52:00.123Z";
const message = await api("/rest/v1/email_messages", {
  id: mid,
  workspace_id: ws,
  owner_id: user(1),
  account_id: account,
  thread_id: thread,
  provider_message_id: providerId,
  direction: "inbound",
  received_at: providerTime,
  body_text: "Disposable canonical Gmail",
});
assert.equal(message.ok, true);
assert.equal(await rpc("gmail_sync_retry", { ...scope, p_id: q.id, p_token: lease }), true);
const retryLease = crypto.randomUUID();
await rpc("gmail_sync_claim", { ...scope, p_token: retryLease });
assert.equal(
  await rpc("gmail_sync_finish", {
    ...scope,
    p_id: q.id,
    p_token: retryLease,
    p_outcome: "existing",
  }),
  true,
);
assert.equal(
  sql(
    `SELECT count(*) FROM public.inbox_channel_occurrences WHERE message_id='${mid}' AND envelope_id IN(SELECT id FROM public.inbox_channel_evidence WHERE message_id='${mid}')`,
  ),
  "1",
);
assert.equal(
  sql(
    `SELECT occurred_at='${providerTime}'::timestamptz FROM public.inbox_channel_occurrences WHERE message_id='${mid}'`,
  ),
  "t",
);
assert.equal(
  await rpc("gmail_sync_finish", {
    ...scope,
    p_id: q.id,
    p_token: retryLease,
    p_outcome: "existing",
  }),
  false,
);
pass("existing-on-retry yields exactly one evidence/occurrence with provider time");
const occurrence = sql(`SELECT id FROM public.inbox_channel_occurrences WHERE message_id='${mid}'`);
const notice = crypto.randomUUID();
const noticeInsert = await api("/rest/v1/notifications", {
  id: notice,
  workspace_id: ws,
  owner_id: user(1),
  user_id: user(6),
  type: "workflow",
  title: "Disposable central proof",
  body: "Disposable runtime acceptance",
  entity: "inbox_channel_occurrences",
  entity_id: occurrence,
});
assert.equal(
  noticeInsert.ok,
  true,
  `notification seam ${noticeInsert.value?.code ?? ""} ${noticeInsert.value?.message ?? ""}`,
);
assert.equal(
  sql(`SELECT link FROM public.notifications WHERE id='${notice}'`),
  `/inbox/email?conversation=${thread}`,
);
assert.equal(
  sql(
    `SELECT count(*) FROM public.notification_workspace_context WHERE notification_id='${notice}' AND source_id='${occurrence}' AND event_key='shared.email.message_received'`,
  ),
  "1",
);
pass("actual notification insert seam creates exact conversation href and one source context");

for (const [n, label, allowed] of [
  [6, "allowed Inbox own without account configuration", true],
  [7, "missing permission", false],
  [8, "explicit deny", false],
  [9, "other workspace", false],
  [10, "inactive member", false],
] as const) {
  const token = sessions.get(n);
  assert.ok(token);
  const visible = await rpc(
    "workflow_inbox_conversation_visible",
    { p_workspace: ws, p_channel: "email", p_account: account, p_conversation: thread },
    token,
  );
  assert.equal(visible, allowed, label);
  const rows = await api(
    `/rest/v1/email_threads?id=eq.${thread}&select=id`,
    undefined,
    token,
    "GET",
  );
  assert.equal(rows.ok, true);
  assert.equal(rows.value.length, allowed ? 1 : 0);
  assert.equal(
    await rpc(
      "sales_event_reference_access",
      { e: "inbox_channel_occurrences", i: occurrence },
      token,
    ),
    allowed,
  );
  assert.equal(await rpc("notification_center_visible", { p_id: notice }, token), allowed);
  const accounts = await api(
    `/rest/v1/email_accounts?id=eq.${account}&select=id`,
    undefined,
    token,
    "GET",
  );
  assert.equal(accounts.ok, true);
  assert.equal(accounts.value.length, 0, "no configuration access granted");
  const sources = await api(
    "/rest/v1/rpc/workflow_inbox_sources",
    { p_workspace: ws, p_channel: "email" },
    token,
  );
  assert.equal(sources.ok, false, "no Workflow catalogue access granted");
  pass(`real GoTrue/PostgREST ${label}: exact thread/ref counts and no settings/catalogue`);
}
const token = sessions.get(6);
assert.ok(token);
for (const n of [6, 7, 8, 9, 10]) {
  const caller = sessions.get(n);
  assert.ok(caller);
  await checkInboxDispatchCaller(
    async (name, body) => api(`/rest/v1/rpc/${name}`, body, caller),
    { workspace: ws, workflow: crypto.randomUUID(), run: crypto.randomUUID(), occurrence },
    async () =>
      sql(`SELECT json_build_array(
      (SELECT count(*) FROM public.notifications),
      (SELECT count(*) FROM public.notification_delivery_intents),
      (SELECT count(*) FROM public.notification_slack_intents),
      (SELECT count(*) FROM public.workflow_deliveries))`)
        .split(/[^0-9]+/)
        .filter(Boolean)
        .map(Number),
  );
  pass(`three actual dispatch RPC ACLs refuse real GoTrue user profile ${n}, zero effects`);
}
await patch("email_accounts", account, { status: "disconnected" });
assert.equal(
  await rpc(
    "workflow_inbox_conversation_visible",
    { p_workspace: ws, p_channel: "email", p_account: account, p_conversation: thread },
    token,
  ),
  false,
);
assert.equal(await rpc("notification_center_visible", { p_id: notice }, token), false);
pass("disconnected account revokes conversation notification access");
await patch("email_accounts", account, { status: "connected" });
await patch("email_threads", thread, { owner_id: user(6), assigned_to: user(7) });
assert.equal(
  await rpc(
    "workflow_inbox_conversation_visible",
    { p_workspace: ws, p_channel: "email", p_account: account, p_conversation: thread },
    token,
  ),
  false,
);
pass("own scope does not keep access after reassignment even when previous agent owns thread");
await patch("email_threads", thread, { owner_id: user(1), assigned_to: user(6) });
// These assertions exercise the actual legacy message INSERT trigger, not a
// notification INSERT seam and not a positive published Workflow dispatch.
for (const [n, allowed] of [
  [6, true],
  [7, false],
  [8, false],
  [9, false],
  [10, false],
] as const) {
  const conversation = crypto.randomUUID();
  const created = await api("/rest/v1/email_threads", {
    id: conversation,
    workspace_id: ws,
    owner_id: user(1),
    account_id: account,
    provider_thread_id: prefix + `_legacy_${n}`,
    assigned_to: user(n),
  });
  assert.equal(created.ok, true);
  const bodies = Array.from({ length: allowed ? 6 : 1 }, () => ({
    id: crypto.randomUUID(),
    workspace_id: ws,
    owner_id: user(1),
    account_id: account,
    thread_id: conversation,
    provider_message_id: prefix + crypto.randomUUID(),
    direction: "inbound",
    body_text: "Disposable concurrent legacy producer",
  }));
  const results = await Promise.all(bodies.map((body) => api("/rest/v1/email_messages", body)));
  assert.equal(
    results.every((result) => result.ok),
    true,
    `legacy trigger must not break ingestion: ${results
      .filter((result) => !result.ok)
      .map((result) => `${result.status}/${result.value?.code ?? "no-code"}`)
      .join(",")}`,
  );
  assert.equal(
    sql(`SELECT count(*) FROM public.notifications WHERE workspace_id='${ws}'
    AND user_id='${user(n)}' AND entity='inbox_conversation' AND entity_id='${conversation}'`),
    allowed ? "1" : "0",
    "only the current active authorized assignee is notified",
  );
  if (allowed) {
    assert.equal(
      sql(`SELECT link FROM public.notifications WHERE entity='inbox_conversation'
      AND entity_id='${conversation}' AND user_id='${user(n)}'`),
      `/inbox/email?conversation=${conversation}`,
    );
    assert.equal(
      sql(`SELECT count(*) FROM public.notification_workspace_context c
      JOIN public.notifications n ON n.id=c.notification_id WHERE n.entity_id='${conversation}'
      AND c.source_table='email_threads' AND c.source_id='${conversation}'`),
      "1",
    );
  }
  pass(
    `actual legacy message trigger profile ${n}: exact ${allowed ? 1 : 0} notices/context; concurrent reuse`,
  );
}
const unassigned = crypto.randomUUID();
assert.equal(
  (
    await api("/rest/v1/email_threads", {
      id: unassigned,
      workspace_id: ws,
      owner_id: user(1),
      account_id: account,
      provider_thread_id: prefix + "_unassigned",
      assigned_to: null,
    })
  ).ok,
  true,
);
assert.equal(
  (
    await api("/rest/v1/email_messages", {
      id: crypto.randomUUID(),
      workspace_id: ws,
      owner_id: user(1),
      account_id: account,
      thread_id: unassigned,
      provider_message_id: prefix + "_unassigned_message",
      direction: "inbound",
    })
  ).ok,
  true,
);
assert.equal(
  sql(`SELECT count(*) FROM public.notifications WHERE entity='inbox_conversation'
  AND entity_id='${unassigned}'`),
  "0",
  "no creator/CEO fallback for an unassigned conversation",
);
pass("actual unassigned legacy producer does not notify workspace creator");
assert.equal(
  sql("SELECT tgenabled FROM pg_trigger WHERE tgname='inbox_runtime_release_guard'"),
  "O",
);
assert.equal(
  sql(
    "SELECT count(*) FROM public.workflows WHERE entity='inbox_channel_occurrences' AND (enabled OR status='published')",
  ),
  "0",
);
pass("release lock remains enabled, no synthetic activation");
console.log(
  `INBOX-CENTRAL: ${checks} real local checks. Positive published dispatch/child/cutoff acceptance remains unexecuted while release lock is held.`,
);
