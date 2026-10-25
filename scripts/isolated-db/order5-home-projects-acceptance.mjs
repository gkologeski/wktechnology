// Real JWT/PostgREST acceptance. Synthetic fixtures; no external deliveries.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.env.BANKING_ISOLATED_ROOT;
if (!root) throw Error("Explicit isolated root required");
const cfg = JSON.parse(readFileSync(root + "/status.private.json")),
  accounts = JSON.parse(readFileSync(root + "/hr-accounts.private.json"));
if (
  cfg.API_URL !== "http://127.0.0.1:54521" ||
  readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-permissions-20261023"
)
  throw Error("Isolated only");
const opt = { auth: { persistSession: false, autoRefreshToken: false } },
  admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, opt),
  must = (r) => {
    if (r.error) throw Error(r.error.message);
    return r.data;
  },
  assert = (x, m) => {
    if (!x) throw Error(m);
  },
  blocked = (r) => assert(!!r.error, "Forbidden write succeeded");
assert(
  must(await admin.from("__isolated_marker").select("label")).some(
    (x) => x.label === "techerp-isolated-harness",
  ),
  "Marker",
);
const clients = [];
for (const a of accounts) {
  const c = createClient(cfg.API_URL, cfg.ANON_KEY, opt);
  must(await c.auth.signInWithPassword({ email: a.email, password: a.password }));
  clients.push(c);
}
const h = clients[0],
  W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b",
  R = "30000000-0000-4000-8000-0000000000a8",
  O = "10000000-0000-4000-8000-000000000001",
  u = accounts[0].id,
  peer = accounts[1].id;
const keys = [
  "system.home.view.workspace",
  "system.home.export.workspace",
  ...["tasks", "projects"].flatMap((r) =>
    ["own", "team", "workspace"].map((s) => `techprojects.${r}.view.${s}`),
  ),
];
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((x) => keys.includes(x.permission_key));
const grant = async (list, effect = "grant") =>
  must(
    await admin.from("job_role_permission_overrides").upsert(
      list.map((permission_key) => ({
        workspace_id: W,
        role_id: R,
        permission_key,
        effect,
        created_by: O,
      })),
      { onConflict: "workspace_id,role_id,permission_key" },
    ),
  );
const fixtures = [],
  results = [];
let group;
const seed = async (t, d) => {
  const x = must(await admin.from(t).insert(d).select("id").single());
  fixtures.push([t, x.id]);
  return x.id;
};
const check = async (name, f) => {
  try {
    await f();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
};
const range = { p_from: "2026-01-01T00:00:00Z", p_to: "2027-01-01T00:00:00Z" };
const totals = async (c = h, args = range) => must(await c.rpc("shared_home_project_totals", args));
const compare = async (client = h, workspace = W) => {
  const [t, p] = await Promise.all([
    client
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace)
      .eq("status", "done")
      .gte("updated_at", range.p_from)
      .lte("updated_at", range.p_to),
    client
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace)
      .eq("status", "active"),
  ]);
  must(t);
  must(p);
  const r = await totals(client);
  assert(r.tasks_done === t.count && r.active_projects === p.count, "RLS mismatch");
};
try {
  await grant(keys, "deny");
  await grant(["system.home.view.workspace"]);
  const project = await seed("projects", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    name: "[ISO project totals own]",
    status: "active",
  });
  const otherProject = await seed("projects", {
    workspace_id: W,
    owner_id: peer,
    assigned_to: peer,
    name: "[ISO project totals peer]",
    status: "active",
  });
  const foreignProject = await seed("projects", {
    workspace_id: B,
    owner_id: accounts[3].id,
    name: "[ISO project totals foreign]",
    status: "active",
  });
  for (const [workspace_id, project_id, assignee_id, assignee_ids, status] of [
    [W, project, u, [], "done"],
    [W, otherProject, peer, [], "done"],
    [W, project, null, [u, peer], "done"],
    [W, project, null, [], "done"],
    [B, foreignProject, u, [u], "done"],
  ])
    await seed("project_tasks", {
      workspace_id,
      project_id,
      assignee_id,
      assignee_ids,
      status,
      title: "[ISO project totals task]",
    });
  group = await seed("user_groups", { workspace_id: W, name: "[ISO project totals team]" });
  must(
    await admin.from("user_group_members").insert([
      { group_id: group, user_id: u },
      { group_id: group, user_id: peer },
    ]),
  );
  for (const scope of ["own", "team", "workspace"]) {
    await grant(
      keys.filter((k) => k.startsWith("techprojects.")),
      "deny",
    );
    await grant([`techprojects.tasks.view.${scope}`, `techprojects.projects.view.${scope}`]);
    await check(scope + " matches canonical RLS, array assignees, unassigned and foreign", compare);
  }
  await grant(
    keys.filter((k) => k.startsWith("techprojects.")),
    "deny",
  );
  await check("no project permissions returns authorized zero counts", async () => {
    const r = await totals();
    assert(r.tasks_done === 0 && r.active_projects === 0, "Not zero");
  });
  await grant(["techprojects.tasks.view.workspace", "techprojects.projects.view.own"]);
  await check("independent task and project scopes", compare);
  await grant(["techprojects.tasks.view.workspace"], "deny");
  await check("explicit deny takes effect in existing JWT", compare);
  await grant(["techprojects.tasks.view.own"]);
  must(await admin.from("projects").update({ assigned_to: peer }).eq("id", project));
  await check("project reassignment rechecks responsible", compare);
  const task = fixtures.find(([t]) => t === "project_tasks")[1];
  must(
    await admin
      .from("project_tasks")
      .update({ assignee_id: peer, assignee_ids: [] })
      .eq("id", task),
  );
  await check("task reassignment rechecks all assignees", compare);
  await check("specific timestamp interval excludes current tasks", async () => {
    assert(
      (await totals(h, { p_from: "2000-01-01T00:00:00Z", p_to: "2000-01-02T00:00:00Z" }))
        .tasks_done === 0,
      "Wrong interval",
    );
  });
  await check("inverted interval rejected", async () =>
    blocked(await h.rpc("shared_home_project_totals", { p_from: range.p_to, p_to: range.p_from })),
  );
  await check("null interval rejected", async () =>
    blocked(await h.rpc("shared_home_project_totals", { p_from: null, p_to: range.p_to })),
  );
  await check("anonymous cannot execute", async () =>
    blocked(
      await createClient(cfg.API_URL, cfg.ANON_KEY, opt).rpc("shared_home_project_totals", range),
    ),
  );
  await check("inactive JWT denied", async () =>
    blocked(await clients[2].rpc("shared_home_project_totals", range)),
  );
  await check("foreign account totals match only its own workspace RLS", () =>
    compare(clients[3], B),
  );
  await grant(["system.home.view.workspace"], "deny");
  await grant(["system.home.export.workspace"]);
  await check("export alone does not grant Home view", async () =>
    blocked(await h.rpc("shared_home_project_totals", range)),
  );
  await grant(["system.home.export.workspace"], "deny");
  await check("Home denial revokes existing JWT aggregate", async () =>
    blocked(await h.rpc("shared_home_project_totals", range)),
  );
} finally {
  for (const [t, id] of fixtures.reverse()) must(await admin.from(t).delete().eq("id", id));
  for (const key of keys)
    must(
      await admin
        .from("job_role_permission_overrides")
        .delete()
        .eq("workspace_id", W)
        .eq("role_id", R)
        .eq("permission_key", key),
    );
  if (before.length) must(await admin.from("job_role_permission_overrides").insert(before));
  for (const c of clients) await c.auth.signOut();
  writeFileSync(
    root + "/order5-home-projects-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
