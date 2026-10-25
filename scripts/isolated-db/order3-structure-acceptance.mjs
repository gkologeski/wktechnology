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
writeFileSync(root + "/order3-structure-overrides-before.json", JSON.stringify(previous));
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
let space, list, task;
try {
  await set(keys, "deny");
  space = await seed("project_spaces", {
    workspace_id: W,
    name: "[ISO Order3 space]",
    created_by: uid,
  });
  await check("authorship alone does not grant structural read", async () =>
    assert(
      must(await h.from("project_spaces").select("id").eq("id", space.id)).length === 0,
      "owner bypass",
    ),
  );
  await set([
    "techprojects.spaces.view.own",
    "techprojects.spaces.update.own",
    "techprojects.lists.view.own",
    "techprojects.lists.create.own",
    "techprojects.lists.update.own",
    "techprojects.statuses.view.workspace",
    "techprojects.custom_fields.view.workspace",
  ]);
  await check("own structural read and update work", async () =>
    assert(
      must(
        await h
          .from("project_spaces")
          .update({ name: "[ISO Order3 changed]" })
          .eq("id", space.id)
          .select("id"),
      ).length === 1,
      "own update",
    ),
  );
  await check("creator and tenant are immutable", async () => {
    deny(await h.from("project_spaces").update({ created_by: owner }).eq("id", space.id));
    deny(await h.from("project_spaces").update({ workspace_id: B }).eq("id", space.id));
  });
  await check("list and default statuses are one transaction", async () => {
    list = must(
      await h.rpc("project_list_create_checked", {
        p_data: { spaceId: space.id, name: "[ISO Order3 list]" },
      }),
    );
    fixtures.push(["project_lists", list.id]);
    assert(
      must(await admin.from("project_task_statuses").select("id").eq("list_id", list.id)).length ===
        4,
      "status defaults",
    );
  });
  await check("status creation requires dedicated manage", async () =>
    deny(
      await h
        .from("project_task_statuses")
        .insert({ workspace_id: W, list_id: list.id, name: "Forbidden", category: "todo" }),
    ),
  );
  await set(["techprojects.statuses.manage.workspace"]);
  await check("status management retains parent scope", async () => {
    const row = must(
      await h
        .from("project_task_statuses")
        .insert({
          workspace_id: W,
          list_id: list.id,
          name: "[ISO Order3 status]",
          category: "todo",
        })
        .select("id")
        .single(),
    );
    fixtures.push(["project_task_statuses", row.id]);
  });
  const otherSpace = await seed("project_spaces", {
    workspace_id: W,
    name: "[ISO Order3 other]",
    created_by: owner,
  });
  await check("parent scope cannot be bypassed by creating a list", async () =>
    deny(
      await h.rpc("project_list_create_checked", {
        p_data: { spaceId: otherSpace.id, name: "forbidden" },
      }),
    ),
  );
  const project = await seed("projects", {
    workspace_id: W,
    owner_id: uid,
    name: "[ISO Order3 task parent]",
  });
  task = await seed("project_tasks", {
    workspace_id: W,
    project_id: project.id,
    title: "[ISO Order3 task]",
    assignee_id: uid,
  });
  const foreign = await seed("project_tasks", {
    workspace_id: B,
    project_id: (
      await seed("projects", {
        workspace_id: B,
        owner_id: accounts[3].id,
        name: "[ISO Order3 foreign]",
      })
    ).id,
    title: "[ISO foreign task]",
    assignee_id: accounts[3].id,
  });
  await set(["techprojects.tasks.view.own", "techprojects.tasks.update.own"]);
  await check("checklist editing follows parent task", async () => {
    const row = must(
      await h
        .from("project_task_checklists")
        .insert({ workspace_id: W, task_id: task.id, title: "[ISO checklist]" })
        .select("id")
        .single(),
    );
    fixtures.push(["project_task_checklists", row.id]);
    const updated = must(
      await h
        .from("project_task_checklists")
        .update({ is_done: true })
        .eq("id", row.id)
        .select("done_by,done_at")
        .single(),
    );
    assert(updated.done_by === uid && updated.done_at, "completion attribution");
    deny(await h.from("project_task_checklists").update({ done_by: owner }).eq("id", row.id));
  });
  await check("dependency cannot cross workspaces", async () =>
    deny(
      await h.from("project_task_dependencies").insert({
        workspace_id: W,
        task_id: task.id,
        depends_on_task_id: foreign.id,
        dep_type: "finish_to_start",
      }),
    ),
  );
  await check("inactive and foreign users cannot read structure", async () => {
    for (const c of [clients[2], clients[3]])
      assert(
        must(await c.from("project_spaces").select("id").eq("id", space.id)).length === 0,
        "tenant leak",
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
    root + "/order3-structure-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
