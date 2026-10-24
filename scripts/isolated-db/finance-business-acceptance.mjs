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
      k.startsWith("techfinance.") ||
      k.startsWith("techsales.invoices.") ||
      ["techsales.activities.create.own", "techsales.emails.create.own"].includes(k),
  );
const previous = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((r) => keys.includes(r.permission_key));
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
const invoice = (workspace = W, owner_id = uid) =>
  seed("customer_invoices", {
    workspace_id: workspace,
    owner_id,
    invoice_number: "REPLACED-BY-DB",
    amount: 100,
    currency: "BRL",
    status: "draft",
    gateway: "manual",
    due_date: "2026-10-01",
  });
let own, other, foreign, category, policy, run;
try {
  await set(keys, "deny");
  own = await invoice();
  other = await invoice(W, owner);
  foreign = await invoice(B, accounts[3].id);
  category = await seed("financial_categories", {
    workspace_id: W,
    name: "[ISO FINANCE 214]",
    kind: "expense",
  });
  await check("no grant: direct rows and helper denied", async () => {
    assert(must(await h.from("customer_invoices").select("id")).length === 0, "Rows leaked");
    deny(await h.rpc("finance_business_authorize", { _resource: "invoices", _action: "view" }));
  });
  await set([
    "techfinance.invoices.view.own",
    "techfinance.invoices.update.own",
    "techfinance.invoices.create.own",
    "techfinance.invoices.delete.own",
  ]);
  await check("own invoice scope hides other owner and tenant", async () => {
    const rows = must(await h.from("customer_invoices").select("id"));
    assert(
      rows.some((r) => r.id === own.id) &&
        !rows.some((r) => r.id === other.id || r.id === foreign.id),
      "Own scope",
    );
  });
  await check("other owner update returns no affected rows", async () =>
    assert(
      must(
        await h
          .from("customer_invoices")
          .update({ description: "forbidden" })
          .eq("id", other.id)
          .select("id"),
      ).length === 0,
      "Other changed",
    ),
  );
  await check("edit cannot forge settlement", async () =>
    deny(await h.from("customer_invoices").update({ status: "paid" }).eq("id", own.id)),
  );
  await check("provider payload is immutable", async () =>
    deny(await h.from("customer_invoices").update({ external_id: "forged" }).eq("id", own.id)),
  );
  await check("workspace and owner immutable", async () => {
    deny(await h.from("customer_invoices").update({ workspace_id: B }).eq("id", own.id));
    deny(await h.from("customer_invoices").update({ owner_id: owner }).eq("id", own.id));
  });
  await check("atomic unique numbering for concurrent creates", async () => {
    const rows = await Promise.all(
      [1, 2, 3, 4].map(async () => {
        const r = must(
          await h
            .from("customer_invoices")
            .insert({
              workspace_id: W,
              owner_id: uid,
              invoice_number: "ignored",
              amount: 1,
              due_date: "2026-10-01",
              gateway: "manual",
            })
            .select("id,invoice_number")
            .single(),
        );
        fixtures.push(["customer_invoices", r.id]);
        return r;
      }),
    );
    assert(new Set(rows.map((r) => r.invoice_number)).size === 4, "Duplicate numbers");
  });
  await check("read-only permission does not grant export", async () =>
    deny(await h.rpc("finance_business_authorize", { _resource: "invoices", _action: "export" })),
  );
  await set(["techfinance.invoice_settlement.manage.workspace"]);
  await check("explicit manual settlement succeeds and paid conditions lock", async () => {
    must(
      await h
        .from("customer_invoices")
        .update({ status: "paid" })
        .eq("id", own.id)
        .select("id,paid_at")
        .single(),
    );
    deny(await h.from("customer_invoices").update({ amount: 900 }).eq("id", own.id));
    deny(await h.from("customer_invoices").delete().eq("id", own.id));
  });
  await check("payment and fiscal direct insertion denied", async () => {
    deny(
      await h
        .from("customer_payments")
        .insert({ workspace_id: W, invoice_id: own.id, gateway: "manual", amount: 100 }),
    );
    deny(
      await h
        .from("nfse_invoices")
        .insert({ workspace_id: W, invoice_id: own.id, status: "processing" }),
    );
  });
  await set(["techfinance.entries.view.own"]);
  await check("minimal lookup does not grant management or balances", async () => {
    const refs = must(await h.rpc("finance_reference_list", { _resource: "categories" }));
    assert(
      refs.some((r) => r.id === category.id),
      "Lookup missing",
    );
    assert(!("external_ids" in refs[0]), "Unnecessary metadata");
    assert(must(await h.from("financial_categories").select("id")).length === 0, "Catalog leaked");
  });
  await set([
    "techfinance.categories.view.workspace",
    "techfinance.categories.create.workspace",
    "techfinance.categories.update.workspace",
    "techfinance.categories.delete.workspace",
  ]);
  await check("catalog CRUD controlled by action", async () => {
    const r = must(
      await h
        .from("financial_categories")
        .insert({ workspace_id: W, name: "[ISO FINANCE 214 created]", kind: "expense" })
        .select("id")
        .single(),
    );
    fixtures.push(["financial_categories", r.id]);
    must(
      await h
        .from("financial_categories")
        .update({ name: "[ISO FINANCE 214 updated]" })
        .eq("id", r.id)
        .select("id")
        .single(),
    );
    deny(await h.from("financial_categories").update({ parent_id: r.id }).eq("id", r.id));
    must(await h.from("financial_categories").delete().eq("id", r.id).select("id").single());
  });
  await check("catalog deletion sees references hidden from actor", async () => {
    const entry = await seed("financial_entries", {
      workspace_id: W,
      owner_id: owner,
      direction: "payable",
      origin_type: "manual",
      description: "[ISO FINANCE 214 hidden]",
      amount: 3,
      category_id: category.id,
      competence_date: "2026-10-01",
      due_date: "2026-10-01",
    });
    deny(await h.from("financial_categories").delete().eq("id", category.id));
    must(await admin.from("financial_entries").delete().eq("id", entry.id));
  });
  await check("explicit deny overrides catalog grant", async () => {
    await set(["techfinance.categories.update.workspace"], "deny");
    deny(await h.rpc("finance_business_authorize", { _resource: "categories", _action: "update" }));
  });
  await check("inactive, other tenant, nonmember cannot authorize target invoice", async () => {
    for (const c of clients.slice(1)) {
      deny(
        await c.rpc("finance_business_authorize", {
          _resource: "invoices",
          _action: "update",
          _id: own.id,
        }),
      );
    }
  });
  await set([
    "techfinance.legal_entities.view.workspace",
    "techfinance.legal_entities.create.workspace",
    "techfinance.legal_entities.update.workspace",
    "techfinance.legal_entity_groups.view.workspace",
    "techfinance.legal_entity_groups.create.workspace",
    "techfinance.legal_entity_groups.update.workspace",
  ]);
  let entity, group;
  await check("entity creation preserves automatic system group", async () => {
    entity = must(
      await h
        .from("legal_entities")
        .insert({
          workspace_id: W,
          created_by: uid,
          name: "[ISO FINANCE 214 entity]",
          code: "ISO214",
        })
        .select("id")
        .single(),
    );
    fixtures.push(["legal_entities", entity.id]);
  });
  await check("atomic default requires visible active target", async () => {
    must(await h.rpc("finance_set_default_entity", { _id: entity.id }));
    deny(await h.rpc("finance_set_default_entity", { _id: foreign.id }));
    assert(
      must(await h.from("legal_entities").select("is_default").eq("id", entity.id).single())
        .is_default,
      "Default lost",
    );
  });
  await check("settings secrets unavailable via catalog REST", async () =>
    deny(await h.from("legal_entities").select("payments_settings").eq("id", entity.id)),
  );
  await check("group members atomic and cross-tenant rejected", async () => {
    group = must(
      await h
        .from("legal_entity_groups")
        .insert({
          workspace_id: W,
          created_by: uid,
          name: "[ISO FINANCE 214 group]",
          code: "ISO214",
        })
        .select("id")
        .single(),
    );
    fixtures.push(["legal_entity_groups", group.id]);
    must(await h.rpc("finance_set_group_members", { _id: group.id, _members: [entity.id] }));
    deny(await h.rpc("finance_set_group_members", { _id: group.id, _members: [foreign.id] }));
    assert(
      must(
        await h
          .from("legal_entity_group_members")
          .select("legal_entity_id")
          .eq("group_id", group.id),
      ).length === 1,
      "Partial mutation",
    );
  });
  await set([
    "techfinance.dunning.view.own",
    "techfinance.dunning.create.own",
    "techfinance.dunning.update.own",
  ]);
  await check("editing policy does not imply activation", async () =>
    deny(
      await h.from("dunning_policies").insert({
        workspace_id: W,
        owner_id: uid,
        name: "[ISO FINANCE 214]",
        active: true,
        steps: [{ channel: "task", offset_days: 0 }],
      }),
    ),
  );
  await set([
    "techfinance.dunning.manage.workspace",
    "techfinance.invoices.view.workspace",
    "techsales.activities.create.own",
  ]);
  await check("authorized policy and atomic claim, no outbound effect", async () => {
    policy = must(
      await h
        .from("dunning_policies")
        .insert({
          workspace_id: W,
          owner_id: uid,
          name: "[ISO FINANCE 214]",
          active: true,
          is_default: false,
          steps: [{ channel: "task", offset_days: 0 }],
        })
        .select("id")
        .single(),
    );
    fixtures.push(["dunning_policies", policy.id]);
    const inv = await invoice();
    must(await admin.from("customer_invoices").update({ status: "open" }).eq("id", inv.id));
    run = await seed("dunning_runs", {
      workspace_id: W,
      invoice_id: inv.id,
      policy_id: policy.id,
      next_run_at: "2026-01-01T00:00:00Z",
      status: "active",
    });
    const claims = await Promise.all(
      [1, 2].map(() => admin.rpc("finance_dunning_claim", { _run: run.id })),
    );
    const won = claims.map(must).filter(Boolean);
    assert(won.length === 1, "Duplicate claim");
    deny(await h.rpc("finance_dunning_claim", { _run: run.id }));
    must(
      await admin.rpc("finance_dunning_finish", {
        _attempt: won[0].attempt_id,
        _token: won[0].token,
        _result: { status: "error", error: "Synthetic failure, nothing sent" },
      }),
    );
    assert(
      must(await admin.from("dunning_runs").select("status").eq("id", run.id).single()).status ===
        "paused",
      "Uncertain send retried",
    );
  });
  await check("revoked delegation denies service job", async () => {
    await set(["techfinance.dunning.manage.workspace"], "deny");
    assert(
      must(
        await admin.rpc("finance_dunning_allowed", {
          _policy: policy.id,
          _invoice: other.id,
          _channel: "task",
        }),
      ) === false,
      "Revocation ignored",
    );
  });
  await check("NFSe own scope follows visible parent invoice and hides raw", async () => {
    await set(["techfinance.nfse.view.own"]);
    const n = await seed("nfse_invoices", {
      workspace_id: W,
      invoice_id: own.id,
      status: "pending",
      amount: 100,
    });
    assert(
      must(await h.from("nfse_invoices").select("id").eq("id", n.id)).length === 1,
      "Parent scope lost",
    );
    deny(await h.from("nfse_invoices").select("raw").eq("id", n.id));
  });
  await check("legacy timesheet invoice rolls back on unavailable allocation", async () => {
    const before = must(await h.from("customer_invoices").select("id")).length;
    deny(
      await h.rpc("finance_invoice_from_timesheet", {
        _allocation: foreign.id,
        _start: null,
        _end: null,
        _due: "2026-10-31",
        _description: "never created",
      }),
    );
    assert(
      must(await h.from("customer_invoices").select("id")).length === before,
      "Orphan invoice",
    );
  });
  await check("report/export and fiscal helper gates are independent", async () => {
    deny(await h.rpc("finance_business_authorize", { _resource: "reports", _action: "view" }));
    await set(["techfinance.reports.view.workspace", "techfinance.reports.export.workspace"]);
    must(await h.rpc("finance_business_authorize", { _resource: "reports", _action: "export" }));
    deny(await h.rpc("finance_business_authorize", { _resource: "nfse", _action: "update" }));
  });
  await check("browser cannot forge job history or webhook log", async () => {
    deny(await h.from("dunning_runs").update({ history: [] }).eq("id", run.id));
    deny(await h.from("payment_webhook_events").insert({ gateway: "manual", processed: true }));
  });
} finally {
  for (const [table, id] of [...fixtures].reverse()) {
    const r = await admin.from(table).delete().eq("id", id);
    if (r.error) console.log("CLEANUP FAIL", table, r.error.message);
  }
  must(
    await admin
      .from("job_role_permission_overrides")
      .delete()
      .eq("workspace_id", W)
      .eq("role_id", R)
      .in("permission_key", keys),
  );
  if (previous.length) must(await admin.from("job_role_permission_overrides").insert(previous));
  for (const c of clients) await c.auth.signOut();
  writeFileSync(
    root + "/finance-business-acceptance.json",
    JSON.stringify({ results, passed: results.every((r) => r.passed) }, null, 2),
  );
}
if (results.some((r) => !r.passed)) process.exitCode = 1;
