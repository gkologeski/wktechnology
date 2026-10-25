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
      k.startsWith("techfinance.entries."),
  );
const previous = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((r) => keys.includes(r.permission_key));
writeFileSync(root + "/order3-billing-overrides-before.json", JSON.stringify(previous));
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
  await set([
    "techcontracts.contracts.view.own",
    "techservice.services.view.own",
    "techservice.services.update.own",
    "techprojects.projects.view.own",
    "techprojects.milestones.view.own",
    "techprojects.milestones.update.own",
  ]);
  const contract = await seed("contracts", {
    workspace_id: W,
    owner_id: uid,
    assigned_to: uid,
    title: "[ISO billing]",
    role: "provider",
    status: "draft",
    document_kind: "main",
  });
  const makeService = () =>
    seed("services", {
      workspace_id: W,
      owner_id: uid,
      assigned_to: uid,
      contract_id: contract.id,
      name: "[ISO billing]",
      role: "provider",
      type: "one_time",
      status: "pending",
      quantity: 2,
      unit_price: 125,
    });
  const service = await makeService();
  await check("billing denied without billing action", async () =>
    deny(await h.rpc("service_bill_checked", { p_service: service.id, p_mode: "activate" })),
  );
  await set(["techservice.billing.manage.workspace"]);
  await check("billing denied without Finance create", async () =>
    deny(await h.rpc("service_bill_checked", { p_service: service.id, p_mode: "activate" })),
  );
  await set(["techfinance.entries.view.own", "techfinance.entries.create.own"]);
  await check("one-time service invoice and completion atomic", async () => {
    const r = must(
      await h.rpc("service_bill_checked", { p_service: service.id, p_mode: "activate" }),
    );
    assert(r.generated && r.service.status === "completed", "activation");
    const rows = must(
      await admin
        .from("financial_entries")
        .select("id,amount,workspace_id,owner_id")
        .eq("service_id", service.id),
    );
    assert(
      rows.length === 1 &&
        Number(rows[0].amount) === 250 &&
        rows[0].owner_id === uid &&
        rows[0].workspace_id === W,
      "invoice scope/amount",
    );
    for (const row of rows) fixtures.push(["financial_entries", row.id]);
  });
  await check("repeat activation creates no duplicate", async () => {
    const r = must(
      await h.rpc("service_bill_checked", { p_service: service.id, p_mode: "activate" }),
    );
    assert(r.duplicate && !r.generated, "idempotence");
    assert(
      must(await admin.from("financial_entries").select("id").eq("service_id", service.id))
        .length === 1,
      "duplicate invoice",
    );
  });
  const recurring = await seed("services", {
    workspace_id: W,
    owner_id: uid,
    assigned_to: uid,
    contract_id: contract.id,
    name: "[ISO recurring]",
    role: "provider",
    type: "recurring",
    status: "active",
    quantity: 1,
    unit_price: 75,
    cadence: "monthly",
    next_billing_at: new Date().toISOString().slice(0, 10),
  });
  await check("recurring invoice and cursor advance atomic", async () => {
    const before = recurring.next_billing_at;
    const r = must(
      await h.rpc("service_bill_checked", { p_service: recurring.id, p_mode: "tick" }),
    );
    assert(r.generated && r.service.next_billing_at > before, "cursor");
    for (const row of must(
      await admin.from("financial_entries").select("id").eq("service_id", recurring.id),
    ))
      fixtures.push(["financial_entries", row.id]);
  });
  await set(["techservice.billing.manage.workspace"], "deny");
  await check("cron refuses revoked source actor", async () => {
    const r = must(
      await admin.rpc("service_bill_checked", { p_service: recurring.id, p_mode: "tick" }),
    );
    assert(!r.authorized, "service-role bypass");
  });
  const project = await seed("projects", {
    workspace_id: W,
    owner_id: uid,
    assigned_to: uid,
    name: "[ISO milestone billing]",
    role: "provider",
    contract_id: contract.id,
    status: "active",
  });
  const milestone = await seed("project_milestones", {
    workspace_id: W,
    project_id: project.id,
    assigned_to: uid,
    name: "[ISO milestone]",
    billable: true,
    bill_amount: 180,
  });
  await check("milestone denied without billing action", async () =>
    deny(await h.rpc("project_milestone_complete_checked", { p_id: milestone.id })),
  );
  await set(["techprojects.milestone_billing.create.workspace"]);
  await check("milestone invoice and completion atomic", async () => {
    const r = must(await h.rpc("project_milestone_complete_checked", { p_id: milestone.id }));
    assert(r.status === "done" && r.financial_entry_id, "milestone completion");
    fixtures.push(["financial_entries", r.financial_entry_id]);
    const invoice = must(
      await admin
        .from("financial_entries")
        .select("amount,origin_id")
        .eq("id", r.financial_entry_id)
        .single(),
    );
    assert(
      Number(invoice.amount) === 180 && invoice.origin_id === milestone.id,
      "milestone invoice",
    );
  });
  await check("repeat milestone completion keeps single invoice", async () => {
    const a = must(await h.rpc("project_milestone_complete_checked", { p_id: milestone.id }));
    const b = must(await h.rpc("project_milestone_complete_checked", { p_id: milestone.id }));
    assert(a.financial_entry_id === b.financial_entry_id, "duplicate milestone");
  });
  await check("raw mutation cannot clear invoice provenance", async () =>
    deny(
      await h
        .from("project_milestones")
        .update({ financial_entry_id: null })
        .eq("id", milestone.id)
        .select()
        .single(),
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
    root + "/order3-billing-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
