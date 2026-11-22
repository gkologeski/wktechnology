/** Uses only reserved synthetic fixtures in the local draft; never a configured provider URL. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../tests/fixtures/inbox/load";
assertDisposableInboxTarget(process.env, process.argv);

const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!key) throw new Error("Local draft service key unavailable: not executed.");
loadDisposableInboxFixtures();
const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
if (key.split(".").length === 3) headers["Authorization"] = `Bearer ${key}`;
const root = "http://127.0.0.1:8001/rest/v1";
let checks = 0;
function pass(label: string) {
  checks++;
  console.log(`PASS ${label}`);
}
function sql(query: string) {
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Local SQL check failed; no private output logged.");
  return result.stdout.trim();
}
async function rpc(name: string, args: Record<string, unknown>) {
  const response = await fetch(`${root}/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  return { status: response.status, ok: response.ok, value: await response.json() };
}
const session = "c0413000-0000-4000-8000-000000000001";
const ws = "fa110000-0000-4000-8000-000000000001";
const request = crypto.randomUUID();
const args = {
  p_session: session,
  p_visitor: "visitor_producer_test_1",
  p_request: request,
  p_body: "Synthetic producer test",
};

async function main() {
  assert.equal(
    sql(
      `SELECT count(*) FROM public.live_chat_sessions WHERE id='${session}' AND workspace_id='${ws}' AND visitor_id='visitor_producer_test_1';`,
    ),
    "1",
  );
  const [first, second] = await Promise.all([
    rpc("widget_inbound_commit", args),
    rpc("widget_inbound_commit", args),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value, second.value);
  pass("concurrent identical visitor retries return the same canonical message UUID");
  assert.equal(
    sql(
      `SELECT count(*) FROM public.inbox_widget_receipts WHERE session_id='${session}' AND request_id='${request}';`,
    ),
    "1",
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM public.inbox_channel_evidence WHERE channel='chat' AND account_id='${ws}' AND provider_id='${request}';`,
    ),
    "1",
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM public.inbox_channel_occurrences o JOIN public.inbox_channel_evidence e ON e.id=o.envelope_id WHERE e.channel='chat' AND e.provider_id='${request}' AND o.event_key='shared.chat.message_received';`,
    ),
    "1",
  );
  pass("one durable receipt, evidence and occurrence are committed together");
  assert.equal(
    (await rpc("widget_inbound_commit", { ...args, p_body: "Altered content" })).value.code,
    "23505",
  );
  pass("same request UUID with a different body is rejected");
  assert.equal(
    (await rpc("widget_inbound_commit", { ...args, p_visitor: "foreign_visitor" })).value.code,
    "42501",
  );
  assert.equal(
    (
      await rpc("widget_inbound_commit", {
        ...args,
        p_session: "c0413000-0000-4000-8000-000000000002",
      })
    ).value.code,
    "42501",
  );
  pass("invalid visitor and foreign session cannot cross the session capability");
  assert.equal(
    (await rpc("widget_inbound_commit", { ...args, p_request: null })).value.code,
    "22023",
  );
  pass("missing request UUID is rejected");
  assert.equal(
    (await rpc("workflow_inbox_sources", { p_workspace: ws, p_channel: "chat" })).ok,
    false,
  );
  pass("service role cannot bypass the authenticated Workflows metadata RPC");
  assert.equal(
    sql(
      `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='techerp_api' AND p.proname IN('notification_source_visible','notification_center_source_visible') AND r.rolname='techerp_api_subject';`,
    ),
    "2",
  );
  pass("both restored original visibility functions retain the RLS subject owner");
  assert.equal(
    sql(
      `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='techerp_api' AND p.proname IN('notification_source_visible','notification_center_source_visible') AND has_function_privilege('authenticated',p.oid,'EXECUTE');`,
    ),
    "0",
  );
  pass("private visibility functions cannot be invoked by ordinary authenticated clients");
  assert.equal(
    sql(
      `SELECT count(*) FROM public.workflows WHERE workspace_id='${ws}' AND entity='inbox_channel_occurrences' AND enabled;`,
    ),
    "0",
  );
  pass("no synthetic workflow activation or external dispatch occurred");
  console.log(
    `${checks} real local checks passed; service-JWT/PostgreSQL only, not the five user-JWT/RLS scenarios.`,
  );
}
await main();
