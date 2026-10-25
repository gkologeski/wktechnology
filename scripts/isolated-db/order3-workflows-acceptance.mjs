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
      k.startsWith("techservice.") ||
      k.startsWith("techfinance.entries.") ||
      k.startsWith("techpeople.people."),
  );
const previous = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((r) => keys.includes(r.permission_key));
writeFileSync(root + "/order3-workflows-overrides-before.json", JSON.stringify(previous));
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
try {
  await set(keys, "deny");
  const person = await seed("people", {
    workspace_id: W,
    owner_id: uid,
    created_by: uid,
    assigned_to: uid,
    full_name: "[ISO workflow person]",
    status: "active",
  });
  const data = {
    workspace_id: W,
    owner_id: uid,
    assigned_to: uid,
    title: "[ISO workflow contract]",
    role: "client",
    document_kind: "main",
    status: "draft",
    metadata: { person_id: person.id },
    __delegation: { kind: "contract_from_person", record: person.id, template: null },
  };
  const create = (p = data) =>
    admin.rpc("contract_create_batch", { p_contract: p, p_skip_existing: true });
  await check("service creation needs explicit source proof", async () => {
    const { __delegation, ...p } = data;
    const r = await create(p);
    assert(r.error?.code === "42501", "missing proof accepted");
  });
  await check("ordinary user cannot invoke workflow termination", async () => {
    const r = await h.rpc("contract_workflow_terminate", {
      p_person: person.id,
      p_actor: uid,
      p_date: "2026-10-24",
    });
    assert(r.error?.code === "42501", "service RPC exposed");
  });
  await set(["techcontracts.contracts.view.own", "techcontracts.contracts.create.own"]);
  await check("contract grant cannot bypass HR source visibility", async () => {
    const r = await create();
    assert(r.error?.code === "42501", "hidden person");
  });
  await set(["techpeople.people.view.own"]);
  let contract;
  await check("delegated hiring creates authorized linked contract", async () => {
    const r = must(await create());
    contract = r.contract;
    fixtures.push(["contracts", contract.id]);
    assert(
      must(await admin.from("contracts").select("metadata,owner_id").eq("id", contract.id).single())
        .metadata.person_id === person.id,
      "source link",
    );
  });
  await check("delegated retry reuses same linked contract", async () =>
    assert(must(await create()).contract.id === contract.id, "duplicate contract"),
  );
  await check("source envelope cannot point to another person", async () => {
    const r = await create({ ...data, metadata: { person_id: owner } });
    assert(r.error?.code === "42501", "forged source");
  });
  await set(["techcontracts.contracts.create.own"], "deny");
  await check("revoked creation blocks service even on retry", async () => {
    const r = await create();
    assert(r.error?.code === "42501", "revoked source");
  });
  await check("inactive source actor cannot delegate", async () => {
    const r = await create({ ...data, owner_id: accounts[2].id });
    assert(r.error?.code === "42501", "inactive delegate");
  });
  await set(["techcontracts.contract_transition.manage.workspace"]);
  const terminate = () =>
    admin.rpc("contract_workflow_terminate", {
      p_person: person.id,
      p_actor: uid,
      p_date: "2026-10-24",
    });
  await check("termination requires actual contract edit scope", async () => {
    const r = await terminate();
    assert(r.error?.code === "42501", "contract edit bypass");
  });
  await set(["techcontracts.contracts.update.own"]);
  await check("authorized offboarding terminates and records actual actor", async () => {
    assert(must(await terminate()).contracts === 1, "termination count");
    const r = must(
      await admin.from("contracts").select("status,ends_at").eq("id", contract.id).single(),
    );
    assert(r.status === "terminated" && r.ends_at === "2026-10-24", "termination state");
    const events = must(
      await admin
        .from("contract_events")
        .select("actor_id,payload")
        .eq("contract_id", contract.id)
        .eq("event_type", "status_changed"),
    );
    assert(
      events.length === 1 &&
        events[0].actor_id === uid &&
        events[0].payload.origin === "workflow_offboarding",
      "audit provenance",
    );
  });
  await set(["techcontracts.audit.view.own"]);
  await check("own audit permission follows contract responsibility", async () => {
    const r = must(await h.from("contract_events").select("id").eq("contract_id", contract.id));
    assert(r.length === 1, "own contract audit");
  });
  await check("offboarding retry leaves terminated contract unchanged", async () =>
    assert(must(await terminate()).contracts === 0, "retry changed history"),
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
    root + "/order3-workflows-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
