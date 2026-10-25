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
      k.startsWith("techsales.deals."),
  );
const previous = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((r) => keys.includes(r.permission_key));
writeFileSync(root + "/order3-delivery-overrides-before.json", JSON.stringify(previous));
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
  const deal = await seed("deals", {
    workspace_id: W,
    owner_id: uid,
    assigned_to: uid,
    name: "[ISO delivery]",
    stage: "won",
  });
  const project = await seed("projects", {
    workspace_id: W,
    owner_id: uid,
    assigned_to: uid,
    name: "[ISO delivery]",
    deal_id: deal.id,
    delivery_group_key: "qa",
  });
  await check("project creation helper does not grant by role", async () =>
    assert(
      must(await h.rpc("deal_delivery_can_create_project", { _ws: W })) === false,
      "implicit create",
    ),
  );
  await set([
    "techsales.deals.view.own",
    "techprojects.projects.view.own",
    "techprojects.projects.update.own",
    "techprojects.projects.create.own",
  ]);
  await check("project creation helper recognizes explicit matrix grant", async () =>
    assert(
      must(await h.rpc("deal_delivery_can_create_project", { _ws: W })) === true,
      "create grant",
    ),
  );
  await check("legacy visibility helper follows actual record view", async () =>
    assert(
      must(await h.rpc("project_visible_to_current_user", { _project: project.id })) === true,
      "visibility helper",
    ),
  );
  await check("reassignment denied without assign action", async () => {
    const r = await h.rpc("deal_delivery_set_operational_owner", {
      p_project: project.id,
      p_user: owner,
    });
    assert(r.error?.code === "42501", "assign bypass");
  });
  await set(["techprojects.projects.assign.workspace"]);
  await check("reassignment validates active target and changes owner once", async () => {
    const r = must(
      await h.rpc("deal_delivery_set_operational_owner", { p_project: project.id, p_user: owner }),
    );
    assert(r.assigned_to === owner, "assignment");
    assert(
      must(await admin.from("projects").select("assigned_to").eq("id", project.id).single())
        .assigned_to === owner,
      "persisted owner",
    );
  });
  await check("ownership change does not preserve own-scope access", async () => {
    assert(
      must(await h.rpc("project_visible_to_current_user", { _project: project.id })) === false,
      "creator bypass",
    );
    assert(
      must(await h.rpc("project_editable_by_current_user", { _project: project.id })) === false,
      "edit helper bypass",
    );
  });
  await check("foreign tenant cannot reassign source project", async () => {
    const r = await clients[3].rpc("deal_delivery_set_operational_owner", {
      p_project: project.id,
      p_user: accounts[3].id,
    });
    assert(r.error?.code === "42501", "foreign assign");
  });
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
    root + "/order3-delivery-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
