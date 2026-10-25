import { execFileSync } from "node:child_process";
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
  ...["entries", "payments"].flatMap((r) =>
    ["own", "team", "workspace"].map((s) => "techfinance." + r + ".view." + s),
  ),
];
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((x) => keys.includes(x.permission_key));
writeFileSync(root + "/order5-home-finance-overrides-before.json", JSON.stringify(before));
const grant = async (list, effect = "grant") => {
  for (let i = 0; i < list.length; i += 100)
    must(
      await admin.from("job_role_permission_overrides").upsert(
        list.slice(i, i + 100).map((permission_key) => ({
          workspace_id: W,
          role_id: R,
          permission_key,
          effect,
          created_by: O,
        })),
        { onConflict: "workspace_id,role_id,permission_key" },
      ),
    );
};
const storageObjects = [],
  createdBuckets = [];
const fixtures = [],
  results = [];
let group;
const seed = async (table, data) => {
  const x = must(await admin.from(table).insert(data).select("id").single());
  fixtures.push([table, x.id]);
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
const ids = async (table, list) =>
  must(await h.from(table).select("id").in("id", list))
    .map((x) => x.id)
    .sort();

let tempAdmin;
const bulkIds = [];
const range = { p_from: "2026-01-01T03:00:00.000Z", p_to: "2026-01-31T02:59:59.999Z" };
const totals = async (client = h, args = range) =>
  must(await client.rpc("shared_home_financial_totals", args));
const compare = async (client = h) => {
  const entries = must(
    await client
      .from("financial_entries")
      .select("id,amount,direction,status")
      .eq("workspace_id", W),
  );
  const payments = must(
    await client
      .from("financial_payments")
      .select("id,amount")
      .eq("workspace_id", W)
      .gte("paid_at", range.p_from)
      .lte("paid_at", range.p_to),
  );
  const expected = {
    receivable_open: entries
      .filter(
        (x) => x.direction === "receivable" && ["open", "partial", "overdue"].includes(x.status),
      )
      .reduce((s, x) => s + Number(x.amount), 0),
    payable_open: entries
      .filter((x) => x.direction === "payable" && ["open", "partial", "overdue"].includes(x.status))
      .reduce((s, x) => s + Number(x.amount), 0),
    payments_in_period: payments.reduce((s, x) => s + Number(x.amount), 0),
  };
  const got = await totals(client);
  for (const k of Object.keys(expected))
    assert(Number(got[k]) === expected[k], "Total differs from canonical RLS: " + k);
  return got;
};
try {
  await grant(keys, "deny");
  await check("finance aggregate requires Home view permission", async () =>
    blocked(await h.rpc("shared_home_financial_totals", range)),
  );
  await grant(["system.home.export.workspace"]);
  await check("Home export alone cannot read dashboard financial totals", async () =>
    blocked(await h.rpc("shared_home_financial_totals", range)),
  );
  await grant(["system.home.view.workspace"]);
  await check("missing financial read permissions returns restricted values", async () =>
    assert(
      Object.values(await totals()).every((v) => v === null),
      "Missing read leaked totals",
    ),
  );
  const entry = async (owner, workspace, direction, amount, assigned) =>
    seed("financial_entries", {
      workspace_id: workspace,
      owner_id: owner,
      assigned_to: assigned ?? owner,
      direction,
      description: "[ISO home finance]",
      amount,
      competence_date: "2026-01-01",
      due_date: "2026-01-31",
    });
  const own = await entry(u, W, "receivable", 1000),
    other = await entry(peer, W, "payable", 2000),
    outsider = await entry("10000000-0000-4000-8000-000000000003", W, "receivable", 3000),
    reassigned = await entry(u, W, "receivable", 5000, peer),
    foreign = await entry(accounts[3].id, B, "receivable", 4000);
  for (const [id, workspace, paid_at, amount, creator] of [
    [own, W, "2026-01-01", 10, u],
    [own, W, "2026-01-31", 20, u],
    [own, W, "2025-12-31", 3, u],
    [own, W, "2026-02-01", 4, u],
    [other, W, "2026-01-10", 30, u],
    [outsider, W, "2026-01-11", 40, u],
    [reassigned, W, "2026-01-12", 50, u],
    [foreign, B, "2026-01-15", 60, accounts[3].id],
    [foreign, W, "2026-01-16", 70, u],
  ])
    await seed("financial_payments", {
      workspace_id: workspace,
      entry_id: id,
      paid_at,
      amount,
      created_by: creator,
    });
  group = await seed("user_groups", { workspace_id: W, name: "[ISO home finance team]" });
  must(
    await admin.from("user_group_members").insert([
      { group_id: group, user_id: u },
      { group_id: group, user_id: peer },
    ]),
  );
  for (const scope of ["own", "team", "workspace"]) {
    await grant(
      keys.filter((k) => k.startsWith("techfinance.")),
      "deny",
    );
    await grant(["techfinance.entries.view." + scope, "techfinance.payments.view." + scope]);
    await check(scope + " totals match canonical RLS including real parent and reassignment", () =>
      compare(),
    );
  }
  await grant(
    keys.filter((k) => k.startsWith("techfinance.")),
    "deny",
  );
  await grant(["techfinance.entries.view.workspace", "techfinance.payments.view.own"]);
  await check("workspace entries plus own payments use parent responsible", () => compare());
  await grant(
    keys.filter((k) => k.startsWith("techfinance.")),
    "deny",
  );
  await grant(["techfinance.entries.view.own", "techfinance.payments.view.workspace"]);
  await check("workspace payments do not bypass own parent entry scope", () => compare());
  await grant(
    keys.filter((k) => k.startsWith("techfinance.")),
    "deny",
  );
  await grant(["techfinance.payments.view.workspace"]);
  await check("payment permission without parent entry view stays restricted", async () =>
    assert((await totals()).payments_in_period === null, "Parent scope bypass"),
  );
  await grant(["techfinance.entries.view.workspace"]);
  await grant(["techfinance.payments.view.workspace"], "deny");
  await check("payment denial hides only payment total", async () => {
    const t = await totals();
    assert(t.payments_in_period === null && t.receivable_open !== null, "Action split failed");
  });
  await grant(["techfinance.payments.view.workspace"]);
  await check("caller cannot select another workspace", async () =>
    blocked(await h.rpc("shared_home_financial_totals", { ...range, workspace_id: B })),
  );
  await check("inverted date range is rejected", async () =>
    blocked(
      await h.rpc("shared_home_financial_totals", { p_from: "2026-02-01", p_to: "2026-01-01" }),
    ),
  );
  await check("null date range is rejected", async () =>
    blocked(await h.rpc("shared_home_financial_totals", { p_from: null, p_to: "2026-01-31" })),
  );
  await check("inactive JWT cannot read financial aggregate", async () =>
    blocked(await clients[2].rpc("shared_home_financial_totals", range)),
  );
  const anon = createClient(cfg.API_URL, cfg.ANON_KEY, opt);
  await check("anonymous caller cannot invoke financial aggregate", async () =>
    blocked(await anon.rpc("shared_home_financial_totals", range)),
  );
  const session = must(await h.auth.getSession()).session,
    claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
  const view = await seed("view_as_sessions", {
    workspace_id: W,
    admin_id: O,
    target_user_id: u,
    mode: "role",
    role_id: R,
    read_only: true,
    nonce: "iso-home-finance-" + Date.now(),
    session_id: claims.session_id,
    expires_at: new Date(Date.now() + 60000).toISOString(),
  });
  await check("read-only View as may read its authorized financial totals", () => compare());
  must(await admin.from("view_as_sessions").delete().eq("id", view));
  const beforeBulk = await totals();
  for (let offset = 0; offset < 1100; offset += 100) {
    const rows = must(
      await admin
        .from("financial_entries")
        .insert(
          Array.from({ length: 100 }, () => ({
            workspace_id: W,
            owner_id: u,
            assigned_to: u,
            direction: "receivable",
            description: "[ISO home finance bulk]",
            amount: 1,
            competence_date: "2026-01-01",
            due_date: "2026-01-31",
          })),
        )
        .select("id"),
    );
    bulkIds.push(...rows.map((x) => x.id));
  }
  await check("aggregate includes all authorized rows beyond REST page limit", async () =>
    assert(
      (await totals()).receivable_open - beforeBulk.receivable_open === 1100,
      "Aggregate truncated",
    ),
  );
  await check("large workspace aggregate stays below one second", async () => {
    const t = Date.now();
    await totals();
    assert(Date.now() - t < 1000, "Aggregate exceeds budget");
  });
  const email = "iso-home-finance-admin-" + crypto.randomUUID() + "@example.invalid",
    password = crypto.randomUUID() + "Aa!";
  const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  tempAdmin = created.user.id;
  must(await admin.from("profiles").update({ active_workspace_id: W }).eq("id", tempAdmin));
  must(
    await admin
      .from("workspace_members")
      .insert({ workspace_id: W, user_id: tempAdmin, role: "admin", status: "active" }),
  );
  const ac = createClient(cfg.API_URL, cfg.ANON_KEY, opt);
  must(await ac.auth.signInWithPassword({ email, password }));
  clients.push(ac);
  await check("workspace administrator uses same workspace aggregate semantics", async () => {
    const t = await totals(ac),
      c = await totals();
    for (const k of Object.keys(t)) assert(t[k] === c[k], "Admin totals mismatch");
  });
  await grant(["system.home.view.workspace"], "deny");
  await check("Home denial revokes aggregate in existing session immediately", async () =>
    blocked(await h.rpc("shared_home_financial_totals", range)),
  );
} finally {
  for (let i = 0; i < bulkIds.length; i += 200)
    must(
      await admin
        .from("financial_entries")
        .delete()
        .in("id", bulkIds.slice(i, i + 200)),
    );
  if (tempAdmin) {
    must(await admin.from("workspace_members").delete().eq("user_id", tempAdmin));
    must(await admin.auth.admin.deleteUser(tempAdmin));
  }

  for (const [bucket, path] of storageObjects)
    must(await admin.storage.from(bucket).remove([path]));
  for (const bucket of createdBuckets) must(await admin.storage.deleteBucket(bucket));
  for (const [t, id] of fixtures.reverse()) must(await admin.from(t).delete().eq("id", id));
  if (group) {
    must(await admin.from("user_group_members").delete().eq("group_id", group));
    must(await admin.from("user_groups").delete().eq("id", group));
  }
  for (let i = 0; i < keys.length; i += 100)
    must(
      await admin
        .from("job_role_permission_overrides")
        .delete()
        .eq("workspace_id", W)
        .eq("role_id", R)
        .in("permission_key", keys.slice(i, i + 100)),
    );
  if (before.length) must(await admin.from("job_role_permission_overrides").insert(before));
  for (const c of clients) await c.auth.signOut();
  writeFileSync(
    root + "/order5-home-finance-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
