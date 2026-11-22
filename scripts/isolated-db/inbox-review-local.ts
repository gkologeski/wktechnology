/** INBOX-REVISAO: explicit disposable backend only. Real service-JWT/RPC persistence, no provider calls. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../tests/fixtures/inbox/load";
assertDisposableInboxTarget(process.env, process.argv);
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!key) throw new Error("Not executed: local service credential unavailable.");
loadDisposableInboxFixtures("unipile");
const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
if (key.split(".").length === 3) headers["Authorization"] = `Bearer ${key}`;
const account = "fe110000-0000-4000-8000-000000000001";
const workspace = "fa110000-0000-4000-8000-000000000001";
const prefix = `review_${crypto.randomUUID().replaceAll("-", "")}`;
let checks = 0;
function pass(label: string) {
  checks++;
  console.log(`PASS ${label}`);
}
function sql(query: string) {
  const result = spawnSync(
    "psql",
    [
      "-X",
      "-h",
      "127.0.0.1",
      "-p",
      "8004",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error("Disposable SQL assertion failed; no private output logged.");
  return result.stdout.trim();
}
async function commit(id: string, occurred: string | null, live: boolean, self = false) {
  const response = await fetch("http://127.0.0.1:8001/rest/v1/rpc/unipile_signed_inbound_commit", {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_account: account,
      p_message: id,
      p_chat: prefix,
      p_sender: "disposable_sender",
      p_body: "Disposable test",
      p_envelope_hash: "a".repeat(64),
      p_occurred: occurred,
      p_live: live,
      p_self: self,
    }),
  });
  if (!response.ok)
    throw new Error(`Unipile local commit failed (${response.status}); response withheld.`);
  return await response.json();
}
const oldDate = "2026-11-21T22:00:00Z",
  recentDate = "2026-11-22T00:00:00Z";
const old = `${prefix}_old`,
  recent = `${prefix}_recent`,
  history = `${prefix}_history`,
  self = `${prefix}_self`;
const [first, replay] = await Promise.all([commit(old, oldDate, true), commit(old, oldDate, true)]);
assert.ok(first.accepted && replay.accepted);
assert.equal(
  sql(
    `SELECT count(*) FROM public.linkedin_messages WHERE account_id='${account}' AND provider_message_id='${old}';`,
  ),
  "1",
);
assert.equal(
  sql(
    `SELECT count(*) FROM public.inbox_channel_occurrences WHERE channel='linkedin' AND account_id='${account}' AND event_key='shared.linkedin.message_received' AND message_id IN(SELECT id FROM public.linkedin_messages WHERE provider_message_id='${old}' AND account_id='${account}');`,
  ),
  "1",
);
pass("concurrent replay persists exactly one message and one inbound occurrence");
await commit(recent, recentDate, true);
assert.equal(
  sql(
    `SELECT created_at='${oldDate}'::timestamptz FROM public.linkedin_messages WHERE account_id='${account}' AND provider_message_id='${old}';`,
  ),
  "t",
);
assert.equal(
  sql(
    `SELECT created_at='${recentDate}'::timestamptz FROM public.linkedin_messages WHERE account_id='${account}' AND provider_message_id='${recent}';`,
  ),
  "t",
);
pass(
  "reconnection messages retain provider dates on either side of the proposed cutoff, not envelope time",
);
await commit(history, oldDate, false);
await commit(history, oldDate, true);
assert.equal(
  sql(
    `SELECT provenance FROM public.inbox_unipile_envelopes WHERE account_id='${account}' AND provider_id='${history}';`,
  ),
  "history",
);
assert.equal(
  sql(
    `SELECT count(*) FROM public.inbox_channel_occurrences WHERE message_id IN(SELECT id FROM public.linkedin_messages WHERE account_id='${account}' AND provider_message_id='${history}');`,
  ),
  "0",
);
assert.equal(
  sql(
    `SELECT count(*) FROM public.service_agent_jobs WHERE inbound_message_id IN(SELECT id FROM public.linkedin_messages WHERE account_id='${account}' AND provider_message_id='${history}');`,
  ),
  "0",
);
pass("historical retry cannot promote provenance or create an occurrence/automatic service job");
assert.equal((await commit(self, recentDate, true, true)).reason, "self");
assert.equal(
  sql(
    `SELECT count(*) FROM public.unipile_inbound_messages WHERE account_id='${account}' AND provider_message_id='${self}';`,
  ),
  "0",
);
pass("sent/self is excluded before journal and projection");
assert.equal(
  sql(
    `SELECT last_message_at='${recentDate}'::timestamptz FROM public.linkedin_conversations WHERE account_id='${account}' AND provider_chat_id='${prefix}';`,
  ),
  "t",
);
pass("older backlog does not overwrite latest conversation timestamp");
assert.equal(
  sql(
    `SELECT count(*) FROM public.workflows WHERE workspace_id='${workspace}' AND entity='inbox_channel_occurrences' AND enabled;`,
  ),
  "0",
);
pass("release lock preserved without synthetic activation or dispatch");
console.log(
  `INBOX-REVISAO: ${checks} service-JWT/PostgreSQL checks. Actual cutoff dispatch and five user-JWT scenarios are NOT certified.`,
);
