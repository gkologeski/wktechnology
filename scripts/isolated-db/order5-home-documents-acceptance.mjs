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
  "system.home.export.workspace",
  "system.home.view.workspace",
  ...["techpeople.people", "techpeople.documents"].flatMap((r) =>
    ["own", "team", "workspace"].map((s) => r + ".view." + s),
  ),
];
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((x) => keys.includes(x.permission_key));
writeFileSync(root + "/order5-home-documents-overrides-before.json", JSON.stringify(before));
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

const bulkIds = [];
const compare = async () => {
  const expected = await h
    .from("people_documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", W)
    .eq("status", "expiring");
  must(expected);
  const value = must(await h.rpc("shared_home_expiring_documents"));
  assert(Number(value) === expected.count, "Aggregate differs from canonical RLS");
  return value;
};
try {
  await grant(keys, "deny");
  const own = await seed("people", {
    workspace_id: W,
    owner_id: u,
    full_name: "[ISO Home] own",
    profile_id: u,
    status: "active",
  });
  const managed = await seed("people", {
    workspace_id: W,
    owner_id: peer,
    full_name: "[ISO Home] managed",
    profile_id: peer,
    manager_id: own,
    status: "active",
  });
  const foreign = await seed("people", {
    workspace_id: B,
    owner_id: accounts[3].id,
    full_name: "[ISO Home] foreign",
    profile_id: accounts[3].id,
    status: "active",
  });
  for (const [person, owner, workspace] of [
    [own, u, W],
    [managed, peer, W],
    [foreign, accounts[3].id, B],
  ])
    await seed("people_documents", {
      workspace_id: workspace,
      owner_id: owner,
      person_id: person,
      created_by: owner,
      doc_type: "[ISO Home]",
      status: "expiring",
    });
  await check("document aggregate requires Home permission", async () =>
    blocked(await h.rpc("shared_home_expiring_documents")),
  );
  await grant(["system.home.view.workspace"]);
  await check("Home read permission does not authorize export", async () =>
    blocked(await h.rpc("shared_area_authorize", { r: "system.home", a: "export" })),
  );
  await grant(["system.home.export.workspace"]);
  await check("Home export requires its own current permission", async () =>
    assert(
      must(await h.rpc("shared_area_authorize", { r: "system.home", a: "export" })).workspace === W,
      "Wrong export scope",
    ),
  );
  await grant(["system.home.export.workspace"], "deny");

  await check("missing document or parent rights is restricted rather than zero", async () =>
    assert(
      must(await h.rpc("shared_home_expiring_documents")) === null,
      "Expected restricted aggregate",
    ),
  );
  for (const [label, access] of [
    ["own", ["techpeople.people.view.own", "techpeople.documents.view.own"]],
    ["team", ["techpeople.people.view.team", "techpeople.documents.view.team"]],
    ["workspace", ["techpeople.people.view.workspace", "techpeople.documents.view.workspace"]],
    [
      "own parent with workspace document",
      ["techpeople.people.view.own", "techpeople.documents.view.workspace"],
    ],
    [
      "workspace parent with own document",
      ["techpeople.people.view.workspace", "techpeople.documents.view.own"],
    ],
  ]) {
    await grant(
      keys.filter((k) => k !== "system.home.view.workspace"),
      "deny",
    );
    await grant(access);
    await check("document aggregate preserves " + label + " record scope", compare);
  }
  await grant(
    keys.filter((k) => k !== "system.home.view.workspace"),
    "deny",
  );
  await grant(["techpeople.people.view.workspace"]);
  await check("document revocation suppresses aggregate immediately", async () =>
    assert(
      must(await h.rpc("shared_home_expiring_documents")) === null,
      "Child denial leaked total",
    ),
  );
  await grant(["techpeople.people.view.workspace"], "deny");
  await grant(["techpeople.documents.view.workspace"]);
  await check("parent revocation suppresses aggregate immediately", async () =>
    assert(
      must(await h.rpc("shared_home_expiring_documents")) === null,
      "Parent denial leaked total",
    ),
  );
  await grant(["techpeople.people.view.workspace", "techpeople.documents.view.workspace"]);
  await check("aggregate cannot accept a caller-selected foreign workspace", async () =>
    blocked(await h.rpc("shared_home_expiring_documents", { workspace_id: B })),
  );
  await check("inactive JWT cannot read document totals", async () =>
    blocked(await clients[2].rpc("shared_home_expiring_documents")),
  );
  const anonymous = createClient(cfg.API_URL, cfg.ANON_KEY, opt);
  await check("anonymous client cannot read document totals", async () =>
    blocked(await anonymous.rpc("shared_home_expiring_documents")),
  );
  for (let offset = 0; offset < 1000; offset += 100) {
    const rows = must(
      await admin
        .from("people_documents")
        .insert(
          Array.from({ length: 100 }, (_, i) => ({
            workspace_id: W,
            owner_id: peer,
            created_by: peer,
            person_id: managed,
            doc_type: "[ISO Home perf]",
            status: (offset + i) % 10 === 0 ? "expiring" : "valid",
          })),
        )
        .select("id"),
    );
    bulkIds.push(...rows.map((r) => r.id));
  }
  await check("document aggregate matches RLS over 1000 synthetic documents", compare);
  await check("workspace document aggregate stays below one second", async () => {
    const t = Date.now();
    must(await h.rpc("shared_home_expiring_documents"));
    assert(Date.now() - t < 1000, "Aggregate exceeds budget");
  });
  await grant(["system.home.view.workspace"], "deny");
  await check("Home revocation rejects existing authenticated aggregate calls", async () =>
    blocked(await h.rpc("shared_home_expiring_documents")),
  );
} finally {
  for (let i = 0; i < bulkIds.length; i += 200)
    must(
      await admin
        .from("people_documents")
        .delete()
        .in("id", bulkIds.slice(i, i + 200)),
    );
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
    root + "/order5-home-documents-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
