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
writeFileSync(root + "/work-core-overrides-before.json", JSON.stringify(previous));
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
const resources = [
  ["contracts", "techcontracts.contracts"],
  ["projects", "techprojects.projects"],
  ["project_tasks", "techprojects.tasks"],
];
const data = (table, w = W, user = uid) => ({
  workspace_id: w,
  ...(table === "project_tasks"
    ? {
        title: "[ISO WORK 216]",
        assignee_id: user,
        project_id: w === B ? all.projects.foreign.id : all.projects.own.id,
      }
    : {
        owner_id: user,
        ...(table === "projects" ? { name: "[ISO WORK 216]" } : { title: "[ISO WORK 216]" }),
      }),
});
const all = {};
try {
  await set(keys, "deny");
  for (const [table, r] of resources) {
    const own = await seed(table, data(table)),
      other = await seed(table, data(table, W, owner)),
      foreign = await seed(table, data(table, B, accounts[3].id));
    all[table] = { own, other, foreign };
    await check(table + ": no grant denies author and all helper capabilities", async () => {
      assert(
        !must(await h.from(table).select("id")).some((x) => x.id === own.id),
        "Authorship bypass",
      );
      assert(
        must(await h.rpc("work_record_access", { r, i: own.id, a: "view" })) === false,
        "Helper bypass",
      );
      assert(
        must(await h.rpc("work_core_capabilities", { r, ids: [own.id, other.id] })).length === 0,
        "Capabilities leak",
      );
    });
    await set([r + ".view.own", r + ".update.own", r + ".delete.own", r + ".create.own"]);
    await check(table + ": own scope hides other owner and workspace", async () => {
      const rows = must(await h.from(table).select("id"));
      assert(
        rows.some((x) => x.id === own.id) &&
          !rows.some((x) => x.id === other.id || x.id === foreign.id),
        "Own scope",
      );
      assert(
        must(
          await h
            .from(table)
            .update(table === "projects" ? { name: "forbidden" } : { title: "forbidden" })
            .eq("id", other.id)
            .select("id"),
        ).length === 0,
        "Other edited",
      );
    });
    await check(table + ": own update and capabilities agree", async () => {
      const rows = must(
        await h
          .from(table)
          .update(
            table === "projects" ? { name: "[ISO WORK updated]" } : { title: "[ISO WORK updated]" },
          )
          .eq("id", own.id)
          .select("id"),
      );
      assert(rows.length === 1, "Own denied");
      const caps = must(
        await h.rpc("work_core_capabilities", { r, ids: [own.id, other.id, foreign.id] }),
      );
      assert(
        caps.length === 1 && caps[0].can_update && caps[0].can_delete && !caps[0].can_assign,
        "Capability mismatch",
      );
    });
    await check(
      table + ": identity/workspace and reassignment are immutable without assign",
      async () => {
        deny(await h.from(table).update({ workspace_id: B }).eq("id", own.id));
        if (table === "project_tasks")
          deny(
            await h
              .from(table)
              .update({ assignee_ids: [owner] })
              .eq("id", own.id),
          );
        else {
          deny(await h.from(table).update({ owner_id: owner }).eq("id", own.id));
          deny(await h.from(table).update({ assigned_to: owner }).eq("id", own.id));
        }
      },
    );
    await set([r + ".view.workspace", r + ".update.workspace"]);
    await check(
      table + ": workspace access stays inside selected tenant; inactive and foreign rejected",
      async () => {
        const rows = must(await h.from(table).select("id"));
        assert(
          rows.some((x) => x.id === other.id) && !rows.some((x) => x.id === foreign.id),
          "Tenant leak",
        );
        for (const c of [clients[2], clients[3]])
          assert(
            !must(await c.from(table).select("id")).some((x) => x.id === own.id),
            "Inactive/foreign leak",
          );
        deny(await h.from(table).insert(data(table, B)));
      },
    );
    await set(
      [r + ".view.workspace", r + ".update.workspace", r + ".view.own", r + ".update.own"],
      "deny",
    );
    const group = await seed("user_groups", {
      workspace_id: W,
      name: "[ISO WORK team " + table + "]",
    });
    must(
      await admin.from("user_group_members").insert([
        { group_id: group.id, user_id: uid },
        { group_id: group.id, user_id: owner },
      ]),
    );
    await set([r + ".view.team", r + ".update.team"]);
    await check(table + ": real team grants read and edit, not a role-name fallback", async () => {
      assert(must(await h.from(table).select("id").eq("id", other.id)).length === 1, "Team read");
      assert(
        must(
          await h
            .from(table)
            .update(
              table === "projects"
                ? { name: "[ISO WORK team " + table + "]" }
                : { title: "[ISO WORK team]" },
            )
            .eq("id", other.id)
            .select("id"),
        ).length === 1,
        "Team update",
      );
      must(await admin.from("user_group_members").delete().eq("group_id", group.id));
      assert(
        must(await h.from(table).select("id").eq("id", other.id)).length === 0,
        "Team revoked",
      );
    });
  }
  await set(keys, "deny");
  await set(["techprojects.tasks.view.own", "techprojects.tasks.update.own"]);
  const multi = await seed("project_tasks", {
    workspace_id: W,
    title: "[ISO WORK multi]",
    project_id: all.projects.own.id,
    assignee_id: owner,
    assignee_ids: [uid],
  });
  await check("secondary task assignee has only their own task scope", async () =>
    assert(
      must(await h.from("project_tasks").select("id").eq("id", multi.id)).length === 1,
      "Secondary lost",
    ),
  );
  await set(["techprojects.projects.view.own", "techcontracts.contracts.view.own"]);
  const f = {
    from: "2026-01-01",
    to: "2026-12-31",
    today: "2026-10-24",
    timezone: "America/Sao_Paulo",
  };
  await check("dashboard project/task IDs exactly match caller RLS", async () => {
    for (const [table, rpc] of [
      ["projects", "project_dash_ds_projects"],
      ["project_tasks", "project_dash_ds_tasks"],
    ]) {
      const direct = must(await h.from(table).select("id"))
        .map((x) => x.id)
        .sort();
      const dash = must(await h.rpc(rpc, { p_view: "all", f }))
        .map((x) => x.id)
        .sort();
      assert(JSON.stringify(direct) === JSON.stringify(dash), table + " mismatch");
    }
  });
  await check(
    "time recorder receives only minimal task references without project/task read",
    async () => {
      await set(keys, "deny");
      await set(["techprojects.time_entries.create.own", "techprojects.timesheet.create.own"]);
      must(
        await admin.from("project_members").insert({
          workspace_id: W,
          project_id: all.projects.own.id,
          user_id: uid,
          role_in_project: "contributor",
        }),
      );
      const refs = must(
        await h.rpc("project_time_task_references", {
          p_project: all.projects.own.id,
          p_search: null,
        }),
      );
      assert(
        refs.some((x) => x.id === all.project_tasks.own.id),
        "Missing task references",
      );
      assert(
        refs.every((x) => Object.keys(x).sort().join(",") === "id,status,title"),
        "Private task fields leaked",
      );
      assert(
        must(await h.from("projects").select("id").eq("id", all.projects.own.id)).length === 0,
        "Full project leaked",
      );
      deny(
        await h.rpc("project_time_task_references", {
          p_project: all.projects.foreign.id,
          p_search: null,
        }),
      );
    },
  );
  await check("time entry retains project/activity labels without full project read", async () => {
    await set(["techprojects.time_entries.view.own", "techprojects.timesheet.view.own"]);
    const e = must(
      await h
        .from("project_time_entries")
        .insert({
          workspace_id: W,
          project_id: all.projects.own.id,
          task_id: all.project_tasks.own.id,
          user_id: uid,
          entry_date: "2026-10-24",
          entry_kind: "duration",
          duration_seconds: 3600,
          timezone: "America/Sao_Paulo",
          source: "manual",
          description: "[ISO WORK labels]",
        })
        .select("id")
        .single(),
    );
    fixtures.push(["project_time_entries", e.id]);
    const labels = must(await h.rpc("project_time_entry_labels", { p_ids: [e.id] }));
    assert(labels.length === 1 && labels[0].project_name && labels[0].task_title, "Labels lost");
    assert(
      must(await clients[3].rpc("project_time_entry_labels", { p_ids: [e.id] })).length === 0,
      "Foreign labels leak",
    );
  });
  await check(
    "time recorder with task-create permission can create activity through minimal parent reference",
    async () => {
      await set(["techprojects.tasks.create.own", "techprojects.tasks.view.own"]);
      const t = must(
        await h.from("project_tasks").insert(data("project_tasks")).select("id").single(),
      );
      fixtures.push(["project_tasks", t.id]);
      assert(
        must(await h.from("projects").select("id").eq("id", all.projects.own.id)).length === 0,
        "Full project granted",
      );
    },
  );
  await set(["techprojects.tasks.view.own", "techprojects.projects.view.own"]);
  await set(["techprojects.tasks.create.own"]);
  await check("create own task succeeds, creating for another user is denied", async () => {
    const row = must(
      await h.from("project_tasks").insert(data("project_tasks")).select("id").single(),
    );
    fixtures.push(["project_tasks", row.id]);
    deny(await h.from("project_tasks").insert(data("project_tasks", W, owner)));
  });
  await check("project creation atomically inserts creator membership", async () => {
    await set(["techprojects.projects.create.own", "techprojects.projects.view.own"]);
    const created = must(await h.from("projects").insert(data("projects")).select("id").single());
    fixtures.push(["projects", created.id]);
    const member = must(
      await admin
        .from("project_members")
        .select("role_in_project")
        .eq("project_id", created.id)
        .eq("user_id", uid)
        .single(),
    );
    assert(member.role_in_project === "manager", "Creator membership missing");
  });
  await check("new cross-workspace contract link is rejected", async () => {
    await set(["techprojects.projects.update.own"]);
    deny(
      await h
        .from("projects")
        .update({ contract_id: all.contracts.foreign.id })
        .eq("id", all.projects.own.id),
    );
  });
} finally {
  if (all.projects?.own)
    must(await admin.from("project_members").delete().eq("project_id", all.projects.own.id));
  for (const [table, id] of [...fixtures].reverse()) {
    if (table === "user_groups")
      must(await admin.from("user_group_members").delete().eq("group_id", id));
    must(await admin.from(table).delete().eq("id", id));
  }
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
    root + "/work-core-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
