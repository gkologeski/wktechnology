// Real GoTrue JWTs; only synthetic, explicitly marked local environment. No outbound sends.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.env.BANKING_ISOLATED_ROOT;
if (!root) throw Error("Explicit isolated root required");
const config = JSON.parse(readFileSync(root + "/status.private.json")),
  accounts = JSON.parse(readFileSync(root + "/hr-accounts.private.json"));
if (
  config.API_URL !== "http://127.0.0.1:54521" ||
  readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-permissions-20261023"
)
  throw Error("Isolated only");
const options = { auth: { persistSession: false, autoRefreshToken: false } },
  admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const must = (r) => {
    if (r.error) throw Error(r.error.message);
    return r.data;
  },
  deny = (r) => {
    if (!r.error) throw Error("Forbidden mutation succeeded");
  },
  assert = (x, m) => {
    if (!x) throw Error(m);
  };
assert(
  must(await admin.from("__isolated_marker").select("label")).some(
    (r) => r.label === "techerp-isolated-harness",
  ),
  "Marker",
);
const clients = [];
for (const account of accounts) {
  const c = createClient(config.API_URL, config.ANON_KEY, options);
  must(await c.auth.signInWithPassword({ email: account.email, password: account.password }));
  clients.push(c);
}
const h = clients[0],
  W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b",
  R = "30000000-0000-4000-8000-0000000000a8",
  owner = "10000000-0000-4000-8000-000000000001",
  uid = accounts[0].id;
const results = [],
  fixtures = [];
const catalog = [];
for (let offset = 0; ; offset += 500) {
  const page = must(
    await admin
      .from("permissions")
      .select("key")
      .order("key")
      .range(offset, offset + 499),
  );
  catalog.push(...page);
  if (page.length < 500) break;
}
const keys = catalog
  .map((r) => r.key)
  .filter((k) => k.startsWith("techcontracts.") || k.startsWith("techprojects."));
const previous = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((r) => keys.includes(r.permission_key));
writeFileSync(root + "/order3-approval-overrides-before.json", JSON.stringify(previous));
const set = async (list, effect = "grant") =>
  must(
    await admin.from("job_role_permission_overrides").upsert(
      list.map((permission_key) => ({
        workspace_id: W,
        role_id: R,
        permission_key,
        effect,
        created_by: owner,
      })),
      { onConflict: "workspace_id,role_id,permission_key" },
    ),
  );
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
};
const seed = async (table, data) => {
  const r = must(await admin.from(table).insert(data).select("*").single());
  fixtures.push([table, r.id]);
  return r;
};
let contract;
try {
  await set(keys, "deny");
  contract = await seed("contracts", {
    workspace_id: W,
    owner_id: uid,
    title: "[ISO Order3 approval]",
  });
  const start = () => h.rpc("contract_approval_start", { p_contract: contract.id });
  const decide = (id, decision = "approved", comment = null) =>
    h.rpc("contract_approval_decide", { p_approval: id, p_decision: decision, p_comment: comment });
  await check("approval start requires explicit permission", async () => deny(await start()));
  await set([
    "techcontracts.contracts.view.own",
    "techcontracts.contracts.update.own",
    "techcontracts.approvals.view.workspace",
    "techcontracts.approvals.manage.workspace",
  ]);
  let chain;
  await check("start is atomic and idempotent", async () => {
    const a = must(await start());
    chain = a.approvals;
    assert(a.started && chain.length === 2, "chain missing");
    const b = must(await start());
    assert(!b.started && b.approvals[0].id === chain[0].id, "duplicate chain");
  });
  await check("chain cannot be shortened", async () =>
    deny(
      await h.rpc("contract_approval_start", {
        p_contract: contract.id,
        p_stages: ["legal"],
        p_reset: true,
      }),
    ),
  );
  await check("direct decision and status update are blocked", async () => {
    deny(await h.from("contract_approvals").update({ status: "approved" }).eq("id", chain[0].id));
    deny(await h.from("contracts").update({ status: "active" }).eq("id", contract.id));
  });
  await check("manage does not imply approve", async () => deny(await decide(chain[0].id)));
  await set(["techcontracts.approvals.approve.workspace"]);
  await check("approval sequence is enforced", async () => deny(await decide(chain[1].id)));
  await check("named approver is enforced", async () => {
    must(
      await admin.from("contract_approvals").update({ approver_id: owner }).eq("id", chain[0].id),
    );
    deny(await decide(chain[0].id));
    must(
      await admin.from("contract_approvals").update({ approver_id: null }).eq("id", chain[0].id),
    );
  });
  await check("rejection requires explanation", async () =>
    deny(await decide(chain[0].id, "rejected", " ")),
  );
  await check("concurrent decisions commit once", async () => {
    const a = await Promise.all([decide(chain[0].id), decide(chain[0].id)]);
    assert(a.filter((r) => !r.error).length === 1, "race");
  });
  await check("final approval moves contract to signature", async () => {
    const a = must(await decide(chain[1].id));
    assert(a.contractStatus === "awaiting_signature", "transition missing");
  });
  await check("restart preserves original decisions", async () => {
    const a = must(
      await h.rpc("contract_approval_start", { p_contract: contract.id, p_reset: true }),
    );
    assert(a.started && a.approvals.every((x) => x.status === "pending"), "restart");
    const old = must(
      await admin
        .from("contract_approvals")
        .select("status,superseded_at")
        .in(
          "id",
          chain.map((x) => x.id),
        ),
    );
    assert(
      old.every((x) => x.status === "approved" && x.superseded_at),
      "history overwritten",
    );
  });
  await check("inactive and foreign workspace cannot act", async () => {
    for (const c of [clients[2], clients[3]])
      deny(await c.rpc("contract_approval_start", { p_contract: contract.id }));
  });
  await check("audit cannot be fabricated directly", async () =>
    deny(
      await h
        .from("contract_events")
        .insert({ workspace_id: W, contract_id: contract.id, event_type: "forged", actor_id: uid }),
    ),
  );
} finally {
  for (const [table, id] of fixtures.reverse()) must(await admin.from(table).delete().eq("id", id));
  for (let offset = 0; offset < keys.length; offset += 100)
    must(
      await admin
        .from("job_role_permission_overrides")
        .delete()
        .eq("workspace_id", W)
        .eq("role_id", R)
        .in("permission_key", keys.slice(offset, offset + 100)),
    );
  if (previous.length) must(await admin.from("job_role_permission_overrides").insert(previous));
  for (const c of clients) await c.auth.signOut();
  writeFileSync(
    root + "/order3-approval-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
