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
      k.startsWith("techpeople.timesheet."),
  );
const previous = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((r) => keys.includes(r.permission_key));
writeFileSync(root + "/order3-hours-overrides-before.json", JSON.stringify(previous));
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
  const project = await seed("projects", {
    workspace_id: W,
    owner_id: uid,
    assigned_to: uid,
    name: "[ISO hours]",
    status: "active",
  });
  await seed("project_members", {
    workspace_id: W,
    project_id: project.id,
    user_id: uid,
    role_in_project: "manager",
    can_track_time: true,
  });
  const today = new Date().toISOString().slice(0, 10);
  const own = await seed("project_time_entries", {
    workspace_id: W,
    project_id: project.id,
    user_id: uid,
    entry_date: today,
    description: "[ISO hours own]",
    duration_seconds: 1200,
    entry_kind: "duration",
    source: "manual",
  });
  const other = await seed("project_time_entries", {
    workspace_id: W,
    project_id: project.id,
    user_id: owner,
    entry_date: today,
    description: "[ISO hours other]",
    duration_seconds: 1800,
    entry_kind: "duration",
    source: "manual",
  });
  const rows = () => h.from("project_time_entries").select("id").in("id", [own.id, other.id]);
  await check("project manager without time grant sees no hours", async () =>
    assert(must(await rows()).length === 0, "manager bypass"),
  );
  await set(
    keys.filter((k) =>
      /^(techprojects\.(time_entries|timesheet)|techpeople\.timesheet)\.view\.own$/.test(k),
    ),
  );
  await check("own hours scope excludes another worker", async () => {
    const r = must(await rows());
    assert(r.length === 1 && r[0].id === own.id, "own hours");
  });
  await check("UI capabilities include only visible hours and no create grant", async () => {
    const r = must(await h.rpc("project_time_capabilities", { p_ids: [own.id, other.id] }));
    assert(
      !r.can_create && r.rows.length === 1 && r.rows[0].id === own.id && !r.rows[0].can_delete,
      "time capabilities scope",
    );
  });
  await check("raw update cannot approve hours", async () => {
    const r = await h
      .from("project_time_entries")
      .update({ status: "approved" })
      .eq("id", own.id)
      .select()
      .single();
    assert(r.error, "raw approval bypass");
  });
  await check("view alone cannot start a timer", async () =>
    deny(
      await h.rpc("project_timer_start", {
        p_ws: W,
        p_project: project.id,
        p_tz: "America/Sao_Paulo",
      }),
    ),
  );
  await set(["techprojects.time_entries.view.own"], "deny");
  const aliases = keys.filter((k) =>
    /^(techprojects\.(time_entries|timesheet)|techpeople\.timesheet)\.view\.own$/.test(k),
  );
  await set(aliases, "grant");
  await set(["techprojects.time_entries.view.own"], "deny");
  await check("legacy alias cannot bypass canonical deny", async () =>
    assert(must(await rows()).length === 0, "alias bypass"),
  );
  await set(aliases, "grant");
  await check("equivalent grants restore own scope", async () =>
    assert(must(await rows()).length === 1, "normalized alias"),
  );
  await set(
    keys.filter((k) =>
      /^(techprojects\.(time_entries|timesheet)|techpeople\.timesheet)\.view\.team$/.test(k),
    ),
  );
  await check("explicit team grant allows managed-project hours", async () =>
    assert(must(await rows()).length === 2, "managed team scope"),
  );
  await seed("project_time_approvers", {
    workspace_id: W,
    project_id: project.id,
    user_id: uid,
    role: "approver",
  });
  const canApprove = () =>
    h.rpc("project_time_can_approve", { p_actor: uid, p_project: project.id, p_subject: owner });
  await check("named approver without matrix grant cannot approve", async () =>
    assert(must(await canApprove()) === false, "named bypass"),
  );
  await set(
    keys.filter((k) =>
      /^(techprojects\.(time_entries|timesheet)|techpeople\.timesheet)\.approve\.workspace$/.test(
        k,
      ),
    ),
  );
  await check("named approver and matrix grant can approve", async () =>
    assert(must(await canApprove()) === true, "named grant"),
  );
  await check("approval cannot approve own hours", async () =>
    assert(
      must(
        await h.rpc("project_time_can_approve", {
          p_actor: uid,
          p_project: project.id,
          p_subject: uid,
        }),
      ) === false,
      "self approval",
    ),
  );
  await set(
    keys.filter((k) =>
      /^(techprojects\.(time_entries|timesheet)|techpeople\.timesheet)\.create\.own$/.test(k),
    ),
  );
  await check("authorized manual entry remains usable", async () => {
    const r = must(
      await h
        .from("project_time_entries")
        .insert({
          workspace_id: W,
          project_id: project.id,
          user_id: uid,
          entry_date: today,
          description: "[ISO authorized]",
          duration_seconds: 600,
          entry_kind: "duration",
          source: "manual",
        })
        .select("id")
        .single(),
    );
    fixtures.push(["project_time_entries", r.id]);
  });
  let timer;
  await check("authorized linked worker can start timer", async () => {
    const r = must(
      await h.rpc("project_timer_start", {
        p_ws: W,
        p_project: project.id,
        p_task: null,
        p_description: "[ISO timer]",
        p_billable: true,
        p_tz: "America/Sao_Paulo",
        p_request_id: "order3-hours-" + Date.now(),
      }),
    );
    timer = r.id || r.session?.id;
    assert(timer, "timer response");
    fixtures.push(["project_timer_sessions", timer]);
  });
  await set(["techprojects.time_entries.create.own"], "deny");
  await check("revoked create stops new materialized hours", async () => {
    const r = await h.rpc("project_timer_stop", {
      p_session: timer,
      p_version: 1,
      p_discard: false,
    });
    assert(r.error?.code === "42501", "expected permission denial");
    assert(
      must(await admin.from("project_timer_sessions").select("state").eq("id", timer).single())
        .state === "running",
      "stop did not roll back",
    );
  });
  await check("owner can pause personal timer after revocation", async () =>
    must(await h.rpc("project_timer_pause", { p_session: timer, p_paid: false, p_version: 1 })),
  );
  await check("owner cannot resume without create grant", async () => {
    const r = await h.rpc("project_timer_resume", { p_session: timer, p_version: 2 });
    assert(r.error?.code === "42501", "resume must reject missing grant");
  });
  await check("owner can discard personal unsaved timer", async () =>
    must(await h.rpc("project_timer_stop", { p_session: timer, p_version: 2, p_discard: true })),
  );
  await check("inactive session sees no hours", async () =>
    assert(
      must(await clients[2].from("project_time_entries").select("id").eq("project_id", project.id))
        .length === 0,
      "inactive",
    ),
  );
  await check("foreign tenant sees no hours", async () =>
    assert(
      must(await clients[3].from("project_time_entries").select("id").eq("project_id", project.id))
        .length === 0,
      "foreign",
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
    root + "/order3-hours-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
