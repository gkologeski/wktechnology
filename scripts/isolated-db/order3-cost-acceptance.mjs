import { workCostTable } from "../../src/lib/access-control/work-cost-projection.ts";
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
writeFileSync(root + "/order3-cost-overrides-before.json", JSON.stringify(previous));
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
let project, member;
try {
  await set(keys, "deny");
  project = await seed("projects", {
    workspace_id: W,
    owner_id: uid,
    name: "[ISO cost boundary]",
    planned_cost: 12345,
  });
  member = await seed("project_members", {
    workspace_id: W,
    project_id: project.id,
    user_id: uid,
    role_in_project: "contributor",
    cost_rate_hour: 123,
    bill_rate_hour: 321,
  });
  await set([
    "techprojects.projects.view.own",
    "techprojects.projects.update.own",
    "techprojects.members.view.workspace",
    "techprojects.members.manage.workspace",
  ]);
  await check("raw confidential cost columns are denied", async () => {
    deny(await h.from("projects").select("planned_cost").eq("id", project.id));
    deny(
      await h.from("project_members").select("cost_rate_hour,bill_rate_hour").eq("id", member.id),
    );
  });
  await check("ordinary project read retains safe fields and masks cost", async () => {
    const a = must(await workCostTable(h, "projects").select("*").eq("id", project.id).single());
    assert(
      a.name === "[ISO cost boundary]" && a.planned_cost === null && !a.financials_visible,
      "unsafe cost",
    );
  });
  await check("ordinary member read masks both rates", async () => {
    const a = must(
      await workCostTable(h, "project_members")
        .select("user_id,cost_rate_hour,bill_rate_hour")
        .eq("id", member.id)
        .single(),
    );
    assert(
      a.user_id === uid && a.cost_rate_hour === null && a.bill_rate_hour === null && !a.id,
      "unsafe rates/projection",
    );
  });
  await check("base edit cannot change costs", async () => {
    deny(await h.from("projects").update({ planned_cost: 1 }).eq("id", project.id));
    deny(await h.from("project_members").update({ cost_rate_hour: 1 }).eq("id", member.id));
  });
  await set(["techprojects.profitability.view.workspace"]);
  await check("cost permission hydrates authorized records", async () => {
    const a = must(await workCostTable(h, "projects").select("*").eq("id", project.id).single());
    const b = must(
      await workCostTable(h, "project_members").select("*").eq("id", member.id).single(),
    );
    assert(
      a.planned_cost === 12345 &&
        a.financials_visible &&
        b.cost_rate_hour === 123 &&
        b.bill_rate_hour === 321,
      "missing costs",
    );
  });
  await check("cost permission does not grant edit", async () =>
    deny(await h.from("projects").update({ planned_cost: 1 }).eq("id", project.id)),
  );
  await set(["techprojects.costs.manage.workspace"]);
  await check("cost management and row edit are both required", async () => {
    assert(
      must(
        await workCostTable(h, "projects")
          .update({ planned_cost: 999 })
          .eq("id", project.id)
          .select("*")
          .single(),
      ).planned_cost === 999,
      "update lost",
    );
  });
  await check("foreign and inactive users cannot hydrate records", async () => {
    for (const c of [clients[2], clients[3]])
      assert(
        must(await c.rpc("work_cost_projection", { r: "techprojects.projects", ids: [project.id] }))
          .length === 0,
        "cost leak",
      );
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
    root + "/order3-cost-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
