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
const catalog = [];
for (let off = 0; ; off += 500) {
  const p = must(
    await admin
      .from("permissions")
      .select("key")
      .order("key")
      .range(off, off + 499),
  );
  catalog.push(...p);
  if (p.length < 500) break;
}
const keys = catalog
  .map((x) => x.key)
  .filter((k) => k.startsWith("techsales.") || k.startsWith("system."));
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((x) => keys.includes(x.permission_key));
writeFileSync(root + "/order4-workers-overrides-before.json", JSON.stringify(before));
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
try {
  await grant(keys, "deny");
  const campaign = await seed("whatsapp_campaigns", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO worker]",
  });
  const own = await seed("leads", { workspace_id: W, owner_id: u, first_name: "[ISO worker own]" }),
    away = await seed("leads", {
      workspace_id: W,
      owner_id: u,
      assigned_to: peer,
      first_name: "[ISO worker away]",
    }),
    foreign = await seed("leads", {
      workspace_id: B,
      owner_id: accounts[3].id,
      first_name: "[ISO foreign worker]",
    });
  const run = (refs) =>
    admin.rpc("sales_worker_authorize", {
      p_source: "whatsapp_campaigns",
      p_id: campaign,
      p_refs: refs ?? [],
    });
  await check("worker cannot run for membership alone", async () =>
    assert(must(await run()) === false, "worker allowed"),
  );
  await grant([
    "techsales.marketing.campaigns.view.own",
    "techsales.marketing.campaigns.update.own",
  ]);
  await check("editing a campaign does not grant dispatch", async () =>
    assert(must(await run()) === false, "dispatch permission absent"),
  );
  await grant(["techsales.campaign_dispatch.manage.own", "techsales.leads.view.own"]);
  await check("authorized worker can use its own visible recipient", async () =>
    assert(must(await run([{ table: "leads", id: own }])) === true, "authorized worker blocked"),
  );
  await check("worker cannot use historical author to reach another assignee", async () =>
    assert(must(await run([{ table: "leads", id: away }])) === false, "recipient leaked"),
  );
  await check("worker cannot reach a foreign workspace recipient", async () =>
    assert(must(await run([{ table: "leads", id: foreign }])) === false, "foreign recipient"),
  );
  await check("worker cannot use an arbitrary reference table", async () =>
    assert(must(await run([{ table: "auth.users", id: own }])) === false, "table injection"),
  );
  await grant(["techsales.campaign_dispatch.manage.own"], "deny");
  await check("revocation takes effect on next dispatch", async () =>
    assert(must(await run()) === false, "revoked permission ignored"),
  );
  await check("browser cannot enter worker service port", async () =>
    blocked(
      await h.rpc("sales_worker_authorize", { p_source: "whatsapp_campaigns", p_id: campaign }),
    ),
  );
  await check("worker cannot authorize arbitrary source tables", async () =>
    assert(
      must(await admin.rpc("sales_worker_authorize", { p_source: "contacts", p_id: own })) ===
        false,
      "source injection",
    ),
  );
  const inactive = await seed("whatsapp_campaigns", {
    workspace_id: W,
    owner_id: accounts[2].id,
    name: "[ISO inactive worker]",
  });
  await check("inactive actor cannot dispatch", async () =>
    assert(
      must(
        await admin.rpc("sales_worker_authorize", {
          p_source: "whatsapp_campaigns",
          p_id: inactive,
        }),
      ) === false,
      "inactive worker",
    ),
  );
  await grant([
    "system.integrations.view.own",
    "system.integrations.create.own",
    "system.integrations.update.own",
    "system.integrations.manage.own",
  ]);
  await check("authorized configuration saves private reference through narrow port", async () => {
    const r = await h.rpc("sales_configure_integration", {
      p_provider: "iso4-test",
      p_status: "disconnected",
      p_config: { test: true },
      p_credential_ref: null,
    });
    const id = must(r);
    fixtures.push(["integrations", id]);
    assert(!!id, "missing integration");
  });
  await check("raw credential writes stay blocked", async () =>
    blocked(
      await h
        .from("integrations")
        .update({ credentials_secret_ref: "forged" })
        .eq("provider", "iso4-test"),
    ),
  );
  await check("Slack port rejects an arbitrary destination", async () =>
    blocked(await h.rpc("sales_configure_slack", { p_url: "https://evil.example/steal" })),
  );
  const oauth = {
    email: "qa-order4@oauth.example",
    access_token: "synthetic-access-not-valid",
    refresh_token: "synthetic-refresh-not-valid",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    scopes: ["synthetic"],
  };
  await check("OAuth callback rejects missing current account permission", async () =>
    assert(
      must(
        await admin.rpc("sales_source_authorize", {
          p_actor: u,
          p_ws: W,
          p_resource: "techsales.email_accounts",
          p_actions: ["create"],
        }),
      ) === false,
      "OAuth permission bypass",
    ),
  );
  await grant(["techsales.email_accounts.view.own", "techsales.email_accounts.create.own"]);
  let emailAccount;
  await check("OAuth callback saves only the signed source owner/workspace", async () => {
    emailAccount = must(
      await admin.rpc("sales_save_google_account", {
        p_actor: u,
        p_ws: W,
        p_kind: "gmail",
        p_payload: { ...oauth, owner_id: peer, workspace_id: B },
      }),
    );
    fixtures.push(["email_accounts", emailAccount]);
    const row = must(
      await admin
        .from("email_accounts")
        .select("owner_id,workspace_id")
        .eq("id", emailAccount)
        .single(),
    );
    assert(row.owner_id === u && row.workspace_id === W, "forged OAuth source");
  });
  await check("create permission alone cannot reconnect an existing account", async () =>
    blocked(
      await admin.rpc("sales_save_google_account", {
        p_actor: u,
        p_ws: W,
        p_kind: "gmail",
        p_payload: oauth,
      }),
    ),
  );
  await grant(["techsales.email_accounts.update.own"]);
  await check("authorized reconnect preserves refresh token if Google omits it", async () => {
    must(
      await admin.rpc("sales_save_google_account", {
        p_actor: u,
        p_ws: W,
        p_kind: "gmail",
        p_payload: { ...oauth, refresh_token: null },
      }),
    );
    assert(
      must(
        await admin.from("email_accounts").select("refresh_token").eq("id", emailAccount).single(),
      ).refresh_token === oauth.refresh_token,
      "refresh lost",
    );
  });
  await check("browser cannot call the credential persistence port", async () =>
    blocked(
      await h.rpc("sales_save_google_account", {
        p_actor: u,
        p_ws: W,
        p_kind: "gmail",
        p_payload: oauth,
      }),
    ),
  );
  await check("OAuth callback cannot change to a foreign workspace", async () =>
    blocked(
      await admin.rpc("sales_save_google_account", {
        p_actor: u,
        p_ws: B,
        p_kind: "gmail",
        p_payload: oauth,
      }),
    ),
  );
  await check("OAuth callback rejects inactive owner", async () =>
    blocked(
      await admin.rpc("sales_save_google_account", {
        p_actor: accounts[2].id,
        p_ws: W,
        p_kind: "gmail",
        p_payload: oauth,
      }),
    ),
  );
  await grant(["techsales.email_accounts.update.own"], "deny");
  await check("OAuth revocation applies again at credential persistence", async () =>
    blocked(
      await admin.rpc("sales_save_google_account", {
        p_actor: u,
        p_ws: W,
        p_kind: "gmail",
        p_payload: oauth,
      }),
    ),
  );
} finally {
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
    root + "/order4-workers-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
