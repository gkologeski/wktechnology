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
writeFileSync(root + "/order3-templates-files-overrides-before.json", JSON.stringify(previous));
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
let createdBucket = false;
let sourcePath;
try {
  if ((await admin.storage.getBucket("contract-imports")).error) {
    must(await admin.storage.createBucket("contract-imports", { public: false }));
    createdBucket = true;
  }
  await set(keys, "deny");
  const make = (patch, extra = {}) =>
    h.rpc("contract_template_save_checked", { p_patch: patch, ...extra });
  await check("template creation denied without grant", async () =>
    deny(await make({ name: "[ISO template]" })),
  );
  await set([
    "techcontracts.contract_templates.view.own",
    "techcontracts.contract_templates.create.own",
    "techcontracts.contract_templates.update.own",
  ]);
  let template;
  await check("template create persists defaults", async () => {
    template = must(await make({ name: "[ISO template]", body_html: "<p>Contrato de teste</p>" }));
    fixtures.push(["contract_templates", template.id]);
    assert(
      template.owner_id === uid && template.workspace_id === W && template.status === "draft",
      "template defaults",
    );
  });
  await check("template update uses contextual scope", async () => {
    const r = must(await make({ name: "[ISO template edited]" }, { p_id: template.id }));
    assert(r.name === "[ISO template edited]", "template update");
  });
  await check("duplicate retains document and new identity", async () => {
    const r = must(await make({}, { p_copy: template.id }));
    fixtures.push(["contract_templates", r.id]);
    assert(
      r.id !== template.id && r.body_html === template.body_html && r.status === "draft",
      "duplicate",
    );
  });
  await check("invalid catalog rolls back template", async () => {
    const before = must(
      await admin.from("contract_templates").select("id").eq("name", "[ISO bad catalog]"),
    );
    deny(
      await make(
        { name: "[ISO bad catalog]" },
        { p_services: ["99999999-0000-4000-8000-000000000999"] },
      ),
    );
    assert(
      must(await admin.from("contract_templates").select("id").eq("name", "[ISO bad catalog]"))
        .length === before.length,
      "partial template",
    );
  });
  const foreign = await seed("contract_templates", {
    workspace_id: B,
    owner_id: accounts[3].id,
    name: "[ISO foreign template]",
  });
  await check("foreign template cannot be cloned", async () =>
    deny(await make({}, { p_copy: foreign.id })),
  );
  await check("protected identity cannot be patched", async () =>
    deny(await make({ owner_id: owner }, { p_id: template.id })),
  );
  await check("arbitrary source path cannot be attached", async () =>
    deny(await make({ source_file_path: "foreign/private.docx" }, { p_id: template.id })),
  );
  await check("source-path existence oracle fails closed", async () =>
    assert(
      must(await h.rpc("work_contract_source_in_use", { p_path: "foreign/private.docx" })) ===
        false,
      "path disclosure",
    ),
  );
  await check("contract source bucket is private", async () => {
    const b = must(await admin.storage.getBucket("contract-imports"));
    assert(b.public === false, "public sensitive bucket");
  });
  const path = (sourcePath = uid + "/order3-source-" + Date.now() + ".txt");
  await set(["techcontracts.imports.manage.workspace"]);
  let uploaded = false;
  await check("authorized user can upload private source", async () => {
    must(
      await h.storage
        .from("contract-imports")
        .upload(path, new Blob(["isolated source"]), { contentType: "text/plain" }),
    );
    uploaded = true;
  });
  await check("own source can be attached", async () => {
    const r = must(await make({ source_file_path: path }, { p_id: template.id }));
    assert(r.source_file_path === path, "source attachment");
  });
  await check("in-use source cannot be deleted", async () => {
    const r = await h.storage.from("contract-imports").remove([path]);
    assert(r.error || r.data?.length === 0, "deleted referenced source");
  });
  await make({ source_file_path: null }, { p_id: template.id });
  if (uploaded) must(await admin.storage.from("contract-imports").remove([path]));
} finally {
  if (sourcePath) must(await admin.storage.from("contract-imports").remove([sourcePath]));
  if (createdBucket) must(await admin.storage.deleteBucket("contract-imports"));
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
    root + "/order3-templates-files-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
