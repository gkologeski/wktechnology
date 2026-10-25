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
  .filter(
    (k) =>
      k.startsWith("techcontracts.") ||
      k.startsWith("techprojects.") ||
      k.startsWith("techservice."),
  );
const previous = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((r) => keys.includes(r.permission_key));
writeFileSync(root + "/order3-transactions-overrides-before.json", JSON.stringify(previous));
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
  const batch = (services = []) =>
    h.rpc("contract_create_batch", {
      p_contract: {
        workspace_id: W,
        owner_id: uid,
        title: "[ISO Order3 batch]",
        role: "provider",
        document_kind: "main",
        status: "draft",
      },
      p_services: services,
    });
  await set([
    "techcontracts.contracts.view.own",
    "techcontracts.contracts.create.own",
    "techcontracts.contracts.update.own",
  ]);
  const service = {
    name: "[ISO service]",
    type: "one_time",
    status: "pending",
    role: "provider",
    quantity: 1,
    unit_price: 100,
    currency: "BRL",
  };
  await check("service denial rolls back entire contract batch", async () => {
    const before = must(
      await admin.from("contracts").select("id").eq("title", "[ISO Order3 batch]"),
    );
    deny(await batch([service]));
    assert(
      must(await admin.from("contracts").select("id").eq("title", "[ISO Order3 batch]")).length ===
        before.length,
      "partial contract committed",
    );
  });
  await set(["techservice.services.view.own", "techservice.services.create.own"]);
  await check("authorized contract and service commit together", async () => {
    const a = must(await batch([service]));
    contract = a.contract;
    fixtures.push(["contracts", contract.id]);
    assert(a.servicesCreated === 1, "service count");
    const rows = must(
      await admin
        .from("services")
        .select("id,workspace_id,owner_id")
        .eq("contract_id", contract.id),
    );
    for (const r of rows) {
      fixtures.push(["services", r.id]);
      assert(r.workspace_id === W && r.owner_id === uid, "service origin");
    }
  });
  await check("audit annotations require a real change in same transaction", async () =>
    deny(
      await h.rpc("contract_audit_annotate", {
        p_contract: contract.id,
        p_evidence: { fake: true },
      }),
    ),
  );
  await check("settings raw reads and RPCs require resource grants", async () => {
    deny(await h.rpc("project_time_policy_get", { p_ws: W }));
    deny(await h.rpc("project_time_policy_save", { p_ws: W, p_rules: {}, p_note: "[ISO policy]" }));
  });
  await set([
    "techprojects.time_policy.view.workspace",
    "techprojects.time_policy.manage.workspace",
  ]);
  await check("matrix grant permits configuration without admin role", async () => {
    const a = must(await h.rpc("project_time_policy_get", { p_ws: W }));
    assert(a.version !== undefined, "policy missing");
  });
  await check("foreign workspace settings are denied", async () =>
    deny(await h.rpc("project_time_policy_get", { p_ws: B })),
  );
  await check("ordinary user cannot call service delegation RPC", async () =>
    deny(
      await h.rpc("work_delegated_authorize", {
        p_ws: W,
        p_actor: uid,
        p_kind: "service_billing",
        p_record: fixtures.find((f) => f[0] === "services")[1],
      }),
    ),
  );
  await check("service delegation respects resource deny", async () =>
    assert(
      must(
        await admin.rpc("work_delegated_authorize", {
          p_ws: W,
          p_actor: uid,
          p_kind: "service_billing",
          p_record: fixtures.find((f) => f[0] === "services")[1],
        }),
      ) === false,
      "delegation bypass",
    ),
  );
  await check("inactive delegate cannot execute", async () =>
    assert(
      must(
        await admin.rpc("work_delegated_authorize", {
          p_ws: W,
          p_actor: accounts[2].id,
          p_kind: "service_billing",
          p_record: fixtures.find((f) => f[0] === "services")[1],
        }),
      ) === false,
      "inactive delegate",
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
    root + "/order3-transactions-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
