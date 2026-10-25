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
writeFileSync(root + "/order3-esign-overrides-before.json", JSON.stringify(previous));
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
let doc;
try {
  await set(keys, "deny");
  const manage = (a, id = null, data = {}) =>
    h.rpc("contract_esign_manage", { p_action: a, p_id: id, p_data: data });
  const create = () =>
    manage("create", null, {
      title: "[ISO Order3 signing]",
      body: "Documento sintético",
      ordered: true,
      signers: [
        { name: "Pessoa Um", email: "one@example.invalid", sign_order: 1 },
        { name: "Pessoa Dois", email: "two@example.invalid", sign_order: 2 },
      ],
    });
  await check("no grant denies document creation", async () => deny(await create()));
  await set([
    "techcontracts.esign.view.workspace",
    "techcontracts.esign.create.workspace",
    "techcontracts.esign.update.workspace",
    "techcontracts.esign.manage.workspace",
    "techcontracts.esign.delete.workspace",
    "techcontracts.esign_send.manage.workspace",
    "techcontracts.esign_cancel.manage.workspace",
  ]);
  await check("document and signers are created atomically", async () => {
    doc = must(await create());
    fixtures.push(["esign_documents", doc.id]);
    assert(
      must(await admin.from("esign_signers").select("id").eq("document_id", doc.id)).length === 2,
      "missing signers",
    );
  });
  await check("token sharing is a separate permission", async () =>
    deny(await manage("share", doc.id)),
  );
  await set(["techcontracts.esign_share.manage.workspace"]);
  const links = must(await manage("share", doc.id));
  const publicAction = (index, action = "view") =>
    admin.rpc("contract_esign_public", {
      p_token: links[index].public_token,
      p_action: action,
      p_name: "Pessoa Teste",
    });
  await check("direct token and signature reads denied", async () => {
    deny(await h.from("esign_signers").select("public_token").eq("document_id", doc.id));
    deny(await h.from("esign_signers").select("signature_data").eq("document_id", doc.id));
  });
  await check("public draft is unavailable", async () => deny(await publicAction(0)));
  await check("raw status writes are denied", async () =>
    deny(await h.from("esign_documents").update({ status: "sent" }).eq("id", doc.id)),
  );
  await check("send seals the actual content", async () => {
    must(await manage("send", doc.id));
    const d = must(
      await admin
        .from("esign_documents")
        .select("content_hash,sealed_at")
        .eq("id", doc.id)
        .single(),
    );
    assert(d.content_hash?.length === 64 && d.sealed_at, "not sealed");
  });
  await check("sent content and signers cannot be changed", async () => {
    deny(await manage("update", doc.id, { body: "changed" }));
    deny(await manage("add_signer", doc.id, { name: "Extra", email: "extra@example.invalid" }));
    deny(await manage("delete", doc.id));
  });
  await check("public view hides other signer email and all credentials", async () => {
    const a = must(await publicAction(0));
    assert(
      !JSON.stringify(a).includes("public_token") && !JSON.stringify(a).includes("signature_data"),
      "sensitive payload",
    );
    assert(
      a.signers.every((s) => !s.email),
      "other email",
    );
  });
  await check("signature order enforced on direct POST", async () =>
    deny(await publicAction(1, "sign")),
  );
  await check("signature race commits once", async () => {
    const a = await Promise.all([publicAction(0, "sign"), publicAction(0, "sign")]);
    assert(a.filter((r) => !r.error).length === 1, "race");
  });
  await check("expiry blocks signing", async () => {
    must(
      await admin
        .from("esign_documents")
        .update({ expires_at: "2020-01-01T00:00:00Z" })
        .eq("id", doc.id),
    );
    deny(await publicAction(1, "sign"));
    must(await admin.from("esign_documents").update({ expires_at: null }).eq("id", doc.id));
  });
  await check("cancel invalidates pending signer", async () => {
    must(await manage("cancel", doc.id));
    deny(await publicAction(1, "sign"));
    deny(await publicAction(1));
  });
  await check("inactive and foreign users cannot share", async () => {
    for (const c of [clients[2], clients[3]])
      deny(await c.rpc("contract_esign_manage", { p_action: "share", p_id: doc.id, p_data: {} }));
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
    root + "/order3-esign-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
