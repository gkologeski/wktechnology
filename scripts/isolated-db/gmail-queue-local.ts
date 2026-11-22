/** Real PostgREST/service-JWT checks on this draft only. No external Gmail calls or login creation. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../tests/fixtures/inbox/load";
assertDisposableInboxTarget(process.env, process.argv);
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("Local draft service key unavailable; tests not executed.");
loadDisposableInboxFixtures();
const root = "http://127.0.0.1:8001/rest/v1";
const headers: Record<string, string> = { apikey: serviceKey, "Content-Type": "application/json" };
if (serviceKey.split(".").length === 3) headers["Authorization"] = `Bearer ${serviceKey}`;
const ws = "fa110000-0000-4000-8000-000000000001";
const account = "fc110000-0000-4000-8000-000000000001";
const scope = { p_workspace: ws, p_account: account };
const prefix = `test_${crypto.randomUUID().replaceAll("-", "")}`;
let checks = 0;
function pass(label: string) {
  checks++;
  console.log(`PASS ${label}`);
}
function sql(query: string) {
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Local fixture SQL failed; no credentials logged.");
  return result.stdout.trim();
}
async function patchAccount(values: Record<string, unknown>) {
  const response = await fetch(
    `${root}/email_accounts?id=eq.${account}&email=eq.queue-a%40example.invalid`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(values),
    },
  );
  if (!response.ok) throw new Error("Local synthetic account update failed.");
}
async function raw(name: string, args: Record<string, unknown>) {
  const response = await fetch(`${root}/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  return { ok: response.ok, value: await response.json() };
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const result = await raw(name, args);
  if (!result.ok)
    throw new Error(`Local RPC ${name} failed with code ${result.value?.code ?? "unknown"}`);
  return result.value as T;
}
type Item = {
  id: string;
  provider_message_id: string;
  provenance: string;
  preexisting: boolean;
  history_from: string;
  history_to: string;
};
async function rows(ids: string[]) {
  const query = new URLSearchParams({
    account_id: `eq.${account}`,
    provider_message_id: `in.(${ids.join(",")})`,
    select: "id,provider_message_id,provenance,preexisting,history_from,history_to,state",
  });
  const response = await fetch(`${root}/gmail_sync_queue?${query}`, { headers });
  assert.equal(response.ok, true);
  return (await response.json()) as Item[];
}
async function main() {
  // Fixed IDs are loaded explicitly from tests/fixtures/inbox only after isolation preflight.
  await patchAccount({ history_id: "100", status: "error" });
  const ids = Array.from({ length: 55 }, (_, i) => `${prefix}_${i}`);
  const enqueue = {
    ...scope,
    p_expected_history: "100",
    p_next_history: "200",
    p_provenance: "incremental",
    p_ids: ids,
  };
  assert.equal(await rpc<number>("gmail_sync_enqueue", enqueue), 55);
  assert.equal(sql(`SELECT history_id FROM public.email_accounts WHERE id='${account}';`), "200");
  assert.equal((await rows(ids)).length, 55);
  pass("55 IDs durable before cursor, including beyond 25");
  assert.equal(
    await rpc<number>("gmail_sync_enqueue", {
      ...enqueue,
      p_expected_history: "200",
      p_next_history: "201",
    }),
    0,
  );
  assert.ok((await rows(ids)).every((r) => r.history_from === "100" && r.history_to === "200"));
  pass("replay preserves the original history boundary without duplicate IDs");
  const stale = await raw("gmail_sync_enqueue", enqueue);
  assert.equal(stale.ok, false);
  assert.equal(stale.value.code, "40001");
  pass("stale concurrent cursor rejected");
  const invalid = await raw("gmail_sync_enqueue", {
    ...enqueue,
    p_expected_history: "201",
    p_next_history: "999",
    p_ids: [`${prefix}_valid`, "invalid/path"],
  });
  assert.equal(invalid.ok, false);
  assert.equal(sql(`SELECT history_id FROM public.email_accounts WHERE id='${account}';`), "201");
  assert.equal((await rows([`${prefix}_valid`])).length, 0);
  pass("failed enqueue neither advances cursor nor persists a partial batch");

  const tokens = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const [first, second] = await Promise.all(
    tokens
      .slice(0, 2)
      .map((token) => rpc<Item[]>("gmail_sync_claim", { ...scope, p_token: token })),
  );
  assert.ok(first && second);
  assert.equal(first.length, 25);
  assert.equal(second.length, 25);
  assert.equal(new Set([...first, ...second].map((r) => r.id)).size, 50);
  pass("two concurrent workers claim disjoint batches of 25");
  const third = await rpc<Item[]>("gmail_sync_claim", { ...scope, p_token: tokens[2] });
  assert.equal(third.length, 5);
  assert.equal(
    (await rpc<Item[]>("gmail_sync_claim", { ...scope, p_token: crypto.randomUUID() })).length,
    0,
  );
  pass("remaining five IDs retained; leased IDs are not reprocessed concurrently");
  const failed = first[12];
  assert.ok(failed);
  assert.equal(
    await rpc<boolean>("gmail_sync_retry", { ...scope, p_id: failed.id, p_token: tokens[0] }),
    true,
  );
  for (const [batch, token] of [
    [first, tokens[0]],
    [second, tokens[1]],
    [third, tokens[2]],
  ] as const) {
    for (const item of batch) {
      if (item.id === failed.id) continue;
      assert.equal(
        await rpc<boolean>("gmail_sync_finish", {
          ...scope,
          p_id: item.id,
          p_token: token,
          p_outcome: "skipped",
        }),
        true,
      );
    }
  }
  const retryToken = crypto.randomUUID();
  const retry = await rpc<Item[]>("gmail_sync_claim", { ...scope, p_token: retryToken });
  assert.equal(retry.length, 1);
  assert.equal(retry[0]?.id, failed.id);
  assert.equal(retry[0]?.provenance, "incremental");
  pass("failure in the middle remains pending and is reclaimed without source mutation");
  const unproven = await raw("gmail_sync_finish", {
    ...scope,
    p_id: failed.id,
    p_token: retryToken,
    p_outcome: "inserted",
  });
  assert.equal(unproven.ok, false);
  assert.equal(
    await rpc<boolean>("gmail_sync_finish", {
      ...scope,
      p_id: failed.id,
      p_token: crypto.randomUUID(),
      p_outcome: "skipped",
    }),
    false,
  );
  assert.equal(
    await rpc<boolean>("gmail_sync_finish", {
      ...scope,
      p_id: failed.id,
      p_token: retryToken,
      p_outcome: "skipped",
    }),
    true,
  );
  pass("missing message proof or altered lease UUID cannot acknowledge an insert");

  const old = `${prefix}_seed`;
  await patchAccount({ history_id: null });
  await rpc("gmail_sync_enqueue", {
    ...scope,
    p_expected_history: null,
    p_next_history: "300",
    p_provenance: "seed",
    p_ids: [old],
  });
  await rpc("gmail_sync_enqueue", {
    ...scope,
    p_expected_history: "300",
    p_next_history: "400",
    p_provenance: "incremental",
    p_ids: [old],
  });
  assert.equal((await rows([old]))[0]?.provenance, "seed");
  assert.equal((await rows([old]))[0]?.history_to, "300");
  pass("seed retried by incremental discovery is never upgraded into new-message provenance");
  const recovered = `${prefix}_recovery`;
  await rpc("gmail_sync_enqueue", {
    ...scope,
    p_expected_history: "400",
    p_next_history: "500",
    p_provenance: "expired_history",
    p_ids: [recovered],
  });
  await rpc("gmail_sync_enqueue", {
    ...scope,
    p_expected_history: "500",
    p_next_history: "600",
    p_provenance: "incremental",
    p_ids: [recovered],
  });
  assert.equal((await rows([recovered]))[0]?.provenance, "expired_history");
  pass("expired-history/backfill receipt remains historical during retry");
  const residualToken = crypto.randomUUID();
  for (const item of await rpc<Item[]>("gmail_sync_claim", { ...scope, p_token: residualToken })) {
    await rpc("gmail_sync_finish", {
      ...scope,
      p_id: item.id,
      p_token: residualToken,
      p_outcome: "skipped",
    });
  }

  const preexisting = "gmail_queue_fixture_preexisting";
  await rpc("gmail_sync_enqueue", {
    ...scope,
    p_expected_history: "600",
    p_next_history: "700",
    p_provenance: "expired_history",
    p_ids: [preexisting],
  });
  await rpc("gmail_sync_enqueue", {
    ...scope,
    p_expected_history: "700",
    p_next_history: "800",
    p_provenance: "incremental",
    p_ids: [preexisting],
  });
  const previous = (await rows([preexisting]))[0];
  assert.ok(previous);
  assert.equal(previous.preexisting, true);
  assert.equal(previous.provenance, "expired_history");
  const previousToken = crypto.randomUUID();
  for (const item of await rpc<Item[]>("gmail_sync_claim", { ...scope, p_token: previousToken })) {
    assert.equal(
      await rpc<boolean>("gmail_sync_finish", {
        ...scope,
        p_id: item.id,
        p_token: previousToken,
        p_outcome: "existing",
      }),
      true,
    );
  }
  assert.equal(
    sql(
      "SELECT count(*) FROM public.email_messages WHERE account_id='fc110000-0000-4000-8000-000000000001' AND provider_message_id='gmail_queue_fixture_preexisting';",
    ),
    "1",
  );
  pass("preexisting mailbox copy stays historical and is not duplicated by incremental retry");

  const deniedScopes = [
    ["missing permission", { ...scope, p_account: "fc110000-0000-4000-8000-000000000003" }],
    ["explicit deny", { ...scope, p_account: "fc110000-0000-4000-8000-000000000004" }],
    ["foreign workspace", { ...scope, p_workspace: "fa110000-0000-4000-8000-000000000002" }],
    ["inactive owner", { ...scope, p_account: "fc110000-0000-4000-8000-000000000005" }],
  ] as const;
  for (const [label, deniedScope] of deniedScopes) {
    for (const [name, args] of [
      [
        "gmail_sync_enqueue",
        {
          p_expected_history: "600",
          p_next_history: "700",
          p_provenance: "incremental",
          p_ids: [],
        },
      ],
      ["gmail_sync_claim", { p_token: crypto.randomUUID() }],
      ["gmail_sync_finish", { p_id: failed.id, p_token: retryToken, p_outcome: "skipped" }],
      ["gmail_sync_retry", { p_id: failed.id, p_token: retryToken }],
    ] as const) {
      const result = await raw(name, { ...deniedScope, ...args });
      assert.equal(result.ok, false);
      assert.equal(result.value.code, "42501");
      pass(`${name} rejects ${label} using current SQL authorization`);
    }
  }
  await patchAccount({ status: "disconnected" });
  const disconnected = await raw("gmail_sync_claim", { ...scope, p_token: crypto.randomUUID() });
  assert.equal(disconnected.ok, false);
  assert.equal(disconnected.value.code, "42501");
  pass("disconnected account cannot drain pending IDs");
  await patchAccount({ status: "error" });
  assert.equal(
    sql(
      "SELECT has_table_privilege('anon','public.gmail_sync_queue','SELECT') OR has_table_privilege('authenticated','public.gmail_sync_queue','SELECT');",
    ),
    "f",
  );
  pass("private queue is unreadable by anon and authenticated roles");
  console.log(
    `GMAIL-FILA: ${checks} real local checks passed; no Gmail request, message send or external effect.`,
  );
}
try {
  await main();
} finally {
  await patchAccount({ status: "error" });
}
