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
writeFileSync(root + "/order3-review-context-overrides-before.json", JSON.stringify(previous));
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
const beforeRole = must(
  await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", W)
    .eq("user_id", uid)
    .single(),
);
try {
  await set(keys, "deny");
  const issue = await seed("project_reconciliation_issues", {
    workspace_id: W,
    dedupe_key: "[ISO order3 read context]",
    issue_type: "overlap",
    provider: "erp",
    present: true,
    status: "open",
  });
  const foreign = await seed("project_reconciliation_issues", {
    workspace_id: B,
    dedupe_key: "[ISO order3 foreign context]",
    issue_type: "overlap",
    provider: "erp",
    present: true,
    status: "open",
  });
  const refresh = await seed("project_reconciliation_refreshes", { workspace_id: W });
  const context = () => h.rpc("work_reconciliation_reference_workspace");
  const visible = () =>
    h.from("project_reconciliation_issues").select("id").in("id", [issue.id, foreign.id]);
  await check("no grant denies reconciliation references", async () => {
    assert(must(await context()) === null, "implicit reference grant");
    assert(must(await visible()).length === 0, "issues leak");
  });
  await set(["techprojects.reconciliation.view.workspace"]);
  await check("reconciliation configuration still requires administrator", async () =>
    assert(must(await context()) === null, "nonadmin config bypass"),
  );
  await set(["techprojects.reconciliation.view.workspace"], "deny");
  const aliases = keys.filter((k) =>
    /^(techprojects\.(time_entries|timesheet)|techpeople\.timesheet)\.view\.workspace$/.test(k),
  );
  await set(aliases);
  await check("workspace time reader can inspect operational issues", async () => {
    assert(must(await context()) === W, "time context");
    const r = must(await visible());
    assert(
      r.length === 1 && String(r[0].id) === String(issue.id),
      "issue visibility: " + JSON.stringify({ expected: issue.id, rows: r }),
    );
    assert(
      must(await h.from("project_reconciliation_refreshes").select("id").eq("id", refresh.id))
        .length === 1,
      "refresh visibility",
    );
  });
  await set(["techprojects.time_entries.view.workspace"], "deny");
  await check("legacy alias cannot bypass denial of issue references", async () => {
    assert(must(await context()) === null, "alias bypass");
    assert(must(await visible()).length === 0, "issue denial");
  });
  must(
    await admin
      .from("workspace_members")
      .update({ role: "admin" })
      .eq("workspace_id", W)
      .eq("user_id", uid),
  );
  await check("administrator role cannot bypass all applicable denies", async () =>
    assert(must(await context()) === null, "admin bypass"),
  );
  await set(["techprojects.reconciliation.view.workspace"]);
  await check("authorized administrator can inspect selected workspace", async () =>
    assert(must(await context()) === W, "admin grant"),
  );
  await check("inactive and foreign sessions cannot read source issues", async () => {
    for (const i of [2, 3])
      assert(
        must(await clients[i].from("project_reconciliation_issues").select("id").eq("id", issue.id))
          .length === 0,
        "source issue leak",
      );
  });
} finally {
  must(
    await admin
      .from("workspace_members")
      .update({ role: beforeRole.role })
      .eq("workspace_id", W)
      .eq("user_id", uid),
  );
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
    root + "/order3-review-context-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
