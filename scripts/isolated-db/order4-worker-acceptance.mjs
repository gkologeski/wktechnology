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
  await check("account synchronization requires current manage permission", async () =>
    assert(
      must(
        await admin.rpc("sales_account_job_authorize", {
          p_table: "email_accounts",
          p_id: emailAccount,
        }),
      ) === false,
      "sync without manage",
    ),
  );
  await grant(["techsales.email_accounts.manage.own"]);
  await check("account owner can synchronize with explicit permission", async () =>
    assert(
      must(
        await admin.rpc("sales_account_job_authorize", {
          p_table: "email_accounts",
          p_id: emailAccount,
        }),
      ) === true,
      "authorized sync blocked",
    ),
  );
  await check("account job uses source workspace after workspace selection changes", async () => {
    const before = must(
      await admin.from("profiles").select("active_workspace_id").eq("id", u).single(),
    );
    try {
      must(await admin.from("profiles").update({ active_workspace_id: B }).eq("id", u));
      assert(
        must(
          await admin.rpc("sales_account_job_authorize", {
            p_table: "email_accounts",
            p_id: emailAccount,
          }),
        ) === true,
        "selected workspace replaced source",
      );
    } finally {
      must(await admin.from("profiles").update(before).eq("id", u));
    }
  });
  await grant(["techsales.email_accounts.manage.own"], "deny");
  await check("revoked account permission immediately blocks cron synchronization", async () =>
    assert(
      must(
        await admin.rpc("sales_account_job_authorize", {
          p_table: "email_accounts",
          p_id: emailAccount,
        }),
      ) === false,
      "revoked sync allowed",
    ),
  );
  await check("browser cannot invoke background account permission port", async () =>
    blocked(
      await h.rpc("sales_account_job_authorize", { p_table: "email_accounts", p_id: emailAccount }),
    ),
  );
  await check("account permission port rejects arbitrary tables", async () =>
    assert(
      must(await admin.rpc("sales_account_job_authorize", { p_table: "profiles", p_id: u })) ===
        false,
      "arbitrary source",
    ),
  );
  const inactiveAccount = await seed("email_accounts", {
    workspace_id: W,
    owner_id: accounts[2].id,
    provider: "gmail",
    email: "inactive-order4@oauth.example",
    status: "connected",
  });
  await check("inactive owner cannot run account synchronization", async () =>
    assert(
      must(
        await admin.rpc("sales_account_job_authorize", {
          p_table: "email_accounts",
          p_id: inactiveAccount,
        }),
      ) === false,
      "inactive sync allowed",
    ),
  );

  await grant(["techsales.email_accounts.update.own"]);
  await check(
    "account synchronization preserves existing update permission without a new manage grant",
    async () =>
      assert(
        must(
          await admin.rpc("sales_account_job_authorize", {
            p_table: "email_accounts",
            p_id: emailAccount,
          }),
        ) === true,
        "existing account rights regressed",
      ),
  );
  const workflow = await seed("workflows", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO workflow rights]",
    entity: "leads",
    trigger: { event: "created" },
    actions: [],
    enabled: true,
    status: "published",
  });
  const workflowRun = (refs) =>
    admin.rpc("sales_worker_authorize", {
      p_source: "workflows",
      p_id: workflow,
      p_refs: refs ?? [],
    });
  await check("workflow cannot execute for membership alone", async () =>
    assert(must(await workflowRun()) === false, "workflow membership bypass"),
  );
  await grant(["system.workflows.view.own", "system.workflows.manage.own"]);
  await check("workflow management authority permits evaluating its own flow", async () =>
    assert(
      must(await workflowRun([{ table: "leads", id: own }])) === true,
      "authorized workflow blocked",
    ),
  );
  await check("workflow management does not grant editing CRM records", async () =>
    assert(
      must(await workflowRun([{ table: "leads", id: own, action: "update" }])) === false,
      "workflow update escalation",
    ),
  );
  await grant(["techsales.leads.update.own"]);
  await check("workflow may update a record within current own scope", async () =>
    assert(
      must(await workflowRun([{ table: "leads", id: own, action: "update" }])) === true,
      "authorized workflow update blocked",
    ),
  );
  await check("workflow update cannot use historical author after reassignment", async () =>
    assert(
      must(await workflowRun([{ table: "leads", id: away, action: "update" }])) === false,
      "workflow own scope bypass",
    ),
  );
  await check("workflow creation effect requires the destination resource permission", async () =>
    assert(
      must(await workflowRun([{ resource: "techsales.tasks", action: "create" }])) === false,
      "task create escalation",
    ),
  );
  await grant(["techsales.tasks.view.own", "techsales.tasks.create.own"]);
  await check("workflow permits an explicitly authorized task creation effect", async () =>
    assert(
      must(await workflowRun([{ resource: "techsales.tasks", action: "create" }])) === true,
      "authorized task create blocked",
    ),
  );
  await check("workflow effects cannot select an inactive assignee", async () =>
    assert(
      must(
        await workflowRun([
          { resource: "techsales.leads", action: "assign", subject_id: accounts[2].id },
        ]),
      ) === false,
      "inactive destination",
    ),
  );

  await check(
    "workflow notification accepts an active recipient without giving them workflow manage",
    async () =>
      assert(must(await workflowRun([{ member_id: peer }])) === true, "active recipient denied"),
  );
  for (const [name, recipient] of [
    ["inactive", "10000000-0000-4000-8000-000000000005"],
    ["foreign", "10000000-0000-4000-8000-000000000006"],
  ])
    await check(`workflow notification blocks ${name} recipient`, async () =>
      assert(
        must(await workflowRun([{ member_id: recipient }])) === false,
        "recipient escaped workspace",
      ),
    );

  await check("cross-module reader cannot resolve an identity in another workspace", async () =>
    assert(
      must(
        await workflowRun([
          { record_table: "profiles", id: "10000000-0000-4000-8000-000000000006" },
        ]),
      ) === false,
      "foreign profile resolved",
    ),
  );
  await check("cross-module reader accepts a visible active member", async () =>
    assert(
      must(await workflowRun([{ record_table: "profiles", id: peer }])) === true,
      "visible member denied",
    ),
  );
  await check("cross-module reader rejects tables outside its finite read catalog", async () =>
    assert(
      must(await workflowRun([{ record_table: "api_keys", id: own }])) === false,
      "private table resolved",
    ),
  );

  const recordOp = (table, action, id, payload = {}) =>
    admin.rpc("sales_workflow_record", {
      p_workflow: workflow,
      p_table: table,
      p_action: action,
      p_id: id,
      p_payload: payload,
    });
  await check("generic workflow cannot create without destination create permission", async () =>
    blocked(await recordOp("leads", "create", null, { first_name: "[ISO blocked generic]" })),
  );
  await grant(["techsales.leads.create.own"]);
  let generatedLead;
  await check("generic workflow creates through actual actor RLS and forces author", async () => {
    generatedLead = must(
      await recordOp("leads", "create", null, {
        first_name: "[ISO generic actor]",
        owner_id: peer,
      }),
    ).id;
    fixtures.push(["leads", generatedLead]);
    const created = must(
      await admin.from("leads").select("owner_id,workspace_id").eq("id", generatedLead).single(),
    );
    assert(created.owner_id === u && created.workspace_id === W, "source forged");
  });
  await check("generic workflow cannot force another tenant on insert", async () =>
    blocked(
      await recordOp("leads", "create", null, {
        first_name: "[ISO cross workspace]",
        workspace_id: B,
      }),
    ),
  );
  await check("generic workflow update works within actor's current own scope", async () =>
    must(await recordOp("leads", "update", generatedLead, { notes: "[ISO allowed update]" })),
  );
  await check("generic workflow cannot edit a record assigned to another person", async () =>
    blocked(await recordOp("leads", "update", away, { notes: "[ISO forbidden]" })),
  );
  await check("generic workflow cannot forge ownership by updating author", async () =>
    blocked(await recordOp("leads", "update", generatedLead, { owner_id: peer })),
  );
  await check("generic workflow cannot delete without explicit delete permission", async () =>
    blocked(await recordOp("leads", "delete", generatedLead)),
  );
  await check("browser cannot call the delegated workflow record port", async () =>
    blocked(
      await h.rpc("sales_workflow_record", {
        p_workflow: workflow,
        p_table: "leads",
        p_action: "update",
        p_id: generatedLead,
        p_payload: { notes: "forbidden" },
      }),
    ),
  );
  await check("generic workflow rejects tables outside its finite catalog", async () =>
    blocked(await recordOp("profiles", "update", u, { full_name: "forged" })),
  );
  must(await admin.from("workflows").update({ enabled: false }).eq("id", workflow));
  await check("disabled workflow cannot resume or execute its next effect", async () =>
    assert(must(await workflowRun()) === false, "disabled workflow ran"),
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
