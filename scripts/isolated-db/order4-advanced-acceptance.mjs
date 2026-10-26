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
writeFileSync(root + "/order4-advanced-overrides-before.json", JSON.stringify(before));
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
  await check(
    "projected policy context preserves actor, workspace, team and readonly state",
    async () => {
      const full = must(await h.rpc("sales_access_context"));
      const thin = must(await h.rpc("sales_policy_context", { resources: ["techsales.leads"] }));
      for (const key of ["actor", "workspace", "team", "read_only"])
        assert(
          JSON.stringify(thin[key]) === JSON.stringify(full[key]),
          `context field changed: ${key}`,
        );
    },
  );
  await check(
    "projected policy context contains exactly the caller's requested resource keys",
    async () => {
      const full = must(await h.rpc("sales_access_context"));
      const thin = must(await h.rpc("sales_policy_context", { resources: ["techsales.leads"] }));
      const expected = Object.keys(full.keys ?? {})
        .filter((k) => k.startsWith("techsales.leads."))
        .sort();
      assert(
        JSON.stringify(Object.keys(thin.keys ?? {}).sort()) === JSON.stringify(expected),
        "permission projection broadened or dropped keys",
      );
    },
  );
  await check("invalid resource projections cannot return an authorization context", async () => {
    assert(
      Object.keys(must(await h.rpc("sales_policy_context", { resources: ["x".repeat(101)] })))
        .length === 0,
      "invalid projection allowed",
    );
  });
  for (const table of ["deal_contacts", "proposal_template_services", "segment_members"]) {
    await check(
      `composite association ${table} denies UUID capabilities without a database error`,
      async () => {
        const id = crypto.randomUUID();
        assert(
          must(await h.rpc("sales_record_access", { t: table, i: id, a: "view" })) === false,
          "composite UUID access allowed",
        );
        assert(
          must(await h.rpc("sales_capabilities", { t: table, ids: [id] })).length === 0,
          "composite capability exposed",
        );
      },
    );
  }

  const lead = await seed("leads", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    first_name: "[ISO] advanced source",
  });
  const wf = await seed("workflows", {
    workspace_id: W,
    owner_id: O,
    execution_user_id: u,
    name: "[ISO] authority",
    entity: "leads",
    enabled: true,
    status: "published",
    published_version: 3,
    trigger: { event: "created" },
    actions: [],
  });
  const worker = (refs = []) =>
    admin.rpc("sales_worker_authorize", { p_source: "workflows", p_id: wf, p_refs: refs });
  await check("workflow execution does not inherit the original admin author's powers", async () =>
    assert(must(await worker()) === false, "borrowed admin authority"),
  );
  await grant([
    "system.workflows.view.workspace",
    "system.workflows.manage.workspace",
    "techsales.leads.view.own",
  ]);
  await check("workflow executes under its current authorized publisher", async () =>
    assert(
      must(await worker([{ table: "leads", id: lead }, { workflow_version: 3 }])) === true,
      "publisher denied",
    ),
  );
  await check("workflow stops when its captured version is stale", async () =>
    assert(must(await worker([{ workflow_version: 2 }])) === false, "stale version allowed"),
  );
  await grant(["system.workflows.update.workspace"]);
  await check(
    "browser cannot replace a published workflow executor with another person",
    async () =>
      blocked(await h.from("workflows").update({ execution_user_id: O }).eq("id", wf).select("id")),
  );
  await grant(["system.workflows.update.workspace"]);
  await check("editing executable actions requires a new version", async () =>
    blocked(
      await h
        .from("workflows")
        .update({ actions: [{ type: "notify", message: "test" }] })
        .eq("id", wf)
        .select("id"),
    ),
  );
  const sub = await seed("workflow_subscriptions", {
    workspace_id: W,
    owner_id: W,
    execution_user_id: u,
    name: "[ISO] subscription",
    event_pattern: "iso.test",
    action: { type: "create_ticket" },
    enabled: true,
  });
  const sw = () =>
    admin.rpc("sales_worker_authorize", {
      p_source: "workflow_subscriptions",
      p_id: sub,
      p_refs: [{ table: "leads", id: lead }],
    });
  await check("legacy subscription uses its explicitly assigned human actor", async () =>
    assert(must(await sw()) === true, "subscription denied"),
  );
  await admin
    .from("workflow_subscriptions")
    .update({ execution_user_id: null })
    .eq("id", sub)
    .then(must);
  await check("subscription with no execution actor remains blocked", async () =>
    assert(must(await sw()) === false, "anonymous subscription allowed"),
  );
  await admin
    .from("workflow_subscriptions")
    .update({ execution_user_id: u, enabled: false })
    .eq("id", sub)
    .then(must);
  await check("disabled subscription remains blocked", async () =>
    assert(must(await sw()) === false, "disabled subscription allowed"),
  );
  const report = await seed("custom_reports", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    name: "[ISO] export",
    entity: "leads",
    config: { entity: "leads", groupBy: "source", metric: "count", limit: 100 },
  });
  const schedule = await seed("report_schedules", {
    workspace_id: W,
    owner_id: O,
    execution_user_id: u,
    report_id: report,
    name: "[ISO] export",
    frequency: "daily",
    enabled: true,
    recipients: [],
  });
  const source = (table, query) =>
    admin.rpc("sales_source_query", {
      p_source: "report_schedules",
      p_id: schedule,
      p_table: table,
      p_query: query,
    });
  await check("scheduled export requires the execution actor's report permissions", async () =>
    blocked(await source("leads", { operation: "select", select: "id" })),
  );
  await grant([
    "system.analytics.reports.view.own",
    "system.analytics.reports.update.own",
    "system.analytics.reports.export.own",
    "techsales.leads.export.own",
  ]);
  await check("authorized scheduled export reads only the actor's visible records", async () => {
    const rows = must(
      await source("leads", {
        operation: "select",
        select: "id",
        filters: [{ field: "id", op: "eq", value: lead }],
      }),
    );
    assert(
      rows.data.some((x) => x.id === lead),
      "source missing",
    );
  });
  await check("scheduled export revalidates the exact source set before sending", async () =>
    must(await source("leads", { operation: "authorize_export", record_ids: [lead] })),
  );
  await grant(["techsales.leads.export.own"], "deny");
  await check("export proof is invalidated immediately after permission revocation", async () =>
    blocked(await source("leads", { operation: "authorize_export", record_ids: [lead] })),
  );
  await grant(["techsales.leads.export.own"]);
  await check("background reports cannot read private token columns", async () =>
    blocked(await source("leads", { operation: "select", select: "id,portal_token" })),
  );
  await admin.from("report_schedules").update({ enabled: false }).eq("id", schedule).then(must);
  await check("paused export cannot continue reading data", async () =>
    blocked(await source("leads", { operation: "select", select: "id" })),
  );
  const ev = await seed("workflow_events", {
    workspace_id: W,
    owner_id: u,
    entity: "leads",
    entity_id: lead,
    event_type: "created",
    processed_at: new Date().toISOString(),
  });
  const run = await seed("workflow_runs", {
    workspace_id: W,
    owner_id: u,
    workflow_id: wf,
    event_id: ev,
    entity: "leads",
    entity_id: lead,
    status: "waiting_approval",
  });
  const approval = await seed("workflow_approvals", {
    workspace_id: W,
    owner_id: O,
    workflow_id: wf,
    run_id: run,
    approver_user_id: u,
    entity: "leads",
    entity_id: lead,
    status: "pending",
    title: "[ISO] approval",
    resume_cursor: 1,
    workflow_version: 3,
    event_snapshot: { after: { id: lead }, before: null },
  });
  const approve = (actor = u) =>
    admin.rpc("sales_workflow_approval_decide", {
      p_actor: actor,
      p_id: approval,
      p_decision: "approved",
      p_comment: "[ISO] decision",
    });
  const recipient = () =>
    admin.rpc("sales_workflow_approval_recipient", {
      p_workflow: wf,
      p_user: u,
      p_entity: "leads",
      p_id: lead,
      p_version: 3,
    });
  await check("approval destination requires its own explicit decision permissions", async () =>
    assert(must(await recipient()) === false, "unqualified approver"),
  );
  await grant(["system.workflow_approvals.view.own"]);
  await check("approval read does not imply permission to decide", async () =>
    blocked(await approve()),
  );
  await grant(["system.workflow_approvals.manage.own"]);
  await check("eligible approver is validated with current source access", async () =>
    assert(must(await recipient()) === true, "eligible recipient denied"),
  );
  await check("even an administrator cannot decide for another designated approver", async () =>
    blocked(await approve(O)),
  );
  await check("ordinary clients cannot call the service approval dispatcher", async () =>
    blocked(
      await h.rpc("sales_workflow_approval_decide", {
        p_actor: u,
        p_id: approval,
        p_decision: "approved",
      }),
    ),
  );
  await check("ordinary clients cannot write a decision directly", async () =>
    blocked(
      await h
        .from("workflow_approvals")
        .update({ status: "approved" })
        .eq("id", approval)
        .select("id"),
    ),
  );
  await grant(["techsales.leads.view.own"], "deny");
  await check("approval decision requires current origin read permission", async () =>
    blocked(await approve()),
  );
  await grant(["techsales.leads.view.own"]);
  await admin.from("workflows").update({ published_version: 4 }).eq("id", wf).then(must);
  await check("approval cannot resume a different published version", async () =>
    blocked(await approve()),
  );
  await admin.from("workflows").update({ published_version: 3 }).eq("id", wf).then(must);
  await check(
    "concurrent approval produces exactly one accepted decision and one resume",
    async () => {
      const responses = await Promise.all([approve(), approve()]);
      assert(
        responses.filter((r) => !r.error).length === 1,
        "decision duplicated or denied: " + responses.map((r) => r.error?.message).join(";"),
      );
      const rows = must(
        await admin.from("workflow_events").select("id").eq("resume_workflow_id", wf),
      );
      for (const x of rows) fixtures.push(["workflow_events", x.id]);
      assert(rows.length === 1, "resume duplicated");
    },
  );
  await check("decided approval cannot be replayed", async () => blocked(await approve()));
  const activity = await seed("activities", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    type: "call",
    subject: "[ISO] notification",
  });
  const notify = (recipient) =>
    admin.rpc("sales_notification_allowed", {
      p_actor: O,
      p_recipient: recipient,
      p_table: "activities",
      p_id: activity,
    });
  await check("notification cannot disclose a record the recipient cannot read", async () =>
    assert(must(await notify(u)) === false, "notification leaked"),
  );
  await grant(["techsales.activities.view.own"]);
  await check("notification is permitted only while the recipient can read", async () =>
    assert(must(await notify(u)) === true, "notification denied"),
  );
  await check("notification cannot disclose data to another workspace member", async () =>
    assert(
      must(await notify("10000000-0000-4000-8000-000000000006")) === false,
      "foreign notification",
    ),
  );
  await check("notification cannot disclose data to an inactive member", async () =>
    assert(
      must(await notify("10000000-0000-4000-8000-000000000005")) === false,
      "inactive notification",
    ),
  );
  await check(
    "ordinary clients cannot forge workflow queue snapshots or resume cursors",
    async () =>
      blocked(
        await h.from("workflow_events").insert({
          workspace_id: W,
          owner_id: u,
          entity: "leads",
          entity_id: lead,
          event_type: "created",
          after: { score: 999 },
          resume_workflow_id: wf,
          resume_cursor: 99,
          workflow_version: 3,
        }),
      ),
  );
  const rule = await seed("scoring_rules", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    name: "[ISO] atomic scoring",
    entity: "lead",
    condition: {},
    points: 5,
    enabled: true,
  });
  const expected = must(await admin.from("scoring_rules").select("*").eq("id", rule).single());
  const score = (id = lead, revision = expected) =>
    admin.rpc("sales_scoring_apply", {
      p_rule: rule,
      p_table: "leads",
      p_record: id,
      p_expected: revision,
    });
  await check("automated scoring cannot borrow unrestricted service privileges", async () =>
    blocked(await score()),
  );
  await grant([
    "techsales.prospecting_scoring.view.own",
    "techsales.prospecting_scoring.manage.own",
    "techsales.leads.update.own",
  ]);
  await check("scoring and its audit event commit exactly once under concurrency", async () => {
    const values = await Promise.all([score(), score()]);
    values.forEach(must);
    assert(values.filter((r) => r.data === true).length === 1, "duplicate scoring");
    const actual = must(await admin.from("leads").select("score").eq("id", lead).single());
    assert(actual.score === 5, "score not atomic");
    const audit = must(await admin.from("score_events").select("id").eq("rule_id", rule));
    for (const x of audit) fixtures.push(["score_events", x.id]);
    assert(audit.length === 1, "duplicate audit");
  });
  const scoreFieldRule = await seed("field_permission_rules", {
    workspace_id: W,
    owner_id: O,
    role_id: R,
    resource: "techsales.leads",
    field: "score",
    mode: "readonly",
    is_system: false,
  });
  await check("automated scoring respects a readonly score field", async () =>
    blocked(await score()),
  );
  await admin.from("field_permission_rules").delete().eq("id", scoreFieldRule).then(must);
  const away = await seed("leads", {
    workspace_id: W,
    owner_id: u,
    assigned_to: peer,
    first_name: "[ISO] scoring other assignee",
  });
  await check("scoring cannot modify a record assigned outside its current scope", async () =>
    blocked(await score(away)),
  );
  await check("browser cannot forge scoring history", async () =>
    blocked(
      await h.from("score_events").insert({
        workspace_id: W,
        owner_id: u,
        rule_id: rule,
        entity: "leads",
        entity_id: lead,
        points: 999,
      }),
    ),
  );
  await admin.from("scoring_rules").update({ points: 10 }).eq("id", rule).then(must);
  await check("scoring rejects a stale rule snapshot", async () => blocked(await score()));
  const stage = await seed("stage_entries", {
    workspace_id: W,
    owner_id: u,
    entity: "leads",
    entity_id: lead,
    stage_id: "iso",
    sla_hours: 1,
  });
  const hiddenStage = await seed("stage_entries", {
    workspace_id: W,
    owner_id: u,
    entity: "leads",
    entity_id: away,
    stage_id: "iso",
    sla_hours: 1,
  });
  await check("stage history requires actual visibility of its source record", async () =>
    assert(
      (await ids("stage_entries", [stage, hiddenStage])).join() === [stage].sort().join(),
      "stage source leaked",
    ),
  );
  await check("browser cannot forge technical stage history", async () =>
    blocked(
      await h.from("stage_entries").insert({
        workspace_id: W,
        owner_id: u,
        entity: "leads",
        entity_id: lead,
        stage_id: "iso",
      }),
    ),
  );
  await grant(["system.analytics.insights.view.own", "system.analytics.insights.create.own"]);
  await check("attribution accepts only an authorized related entity", async () => {
    const row = must(
      await h
        .from("attribution_touchpoints")
        .insert({ workspace_id: W, owner_id: u, lead_id: lead, channel: "test" })
        .select("id")
        .single(),
    );
    fixtures.push(["attribution_touchpoints", row.id]);
  });
  await check("attribution cannot link a hidden lead", async () =>
    blocked(
      await h
        .from("attribution_touchpoints")
        .insert({ workspace_id: W, owner_id: u, lead_id: away, channel: "test" }),
    ),
  );
  await check("attribution cannot create records with no source entity", async () =>
    blocked(
      await h
        .from("attribution_touchpoints")
        .insert({ workspace_id: W, owner_id: u, channel: "test" }),
    ),
  );
  const policy = await seed("sla_policies", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO] SLA",
    first_response_mins: 30,
    resolution_mins: 60,
    active: true,
  });
  await check("SLA policy catalog requires its own matrix permission", async () =>
    assert((await ids("sla_policies", [policy])).length === 0, "SLA catalog leaked"),
  );
  await grant(["system.automation.sla.view.own"]);
  await check("SLA policies can be read without permission to edit them", async () => {
    assert((await ids("sla_policies", [policy])).length === 1, "SLA read denied");
    const r = await h
      .from("sla_policies")
      .update({ name: "[ISO] unauthorized" })
      .eq("id", policy)
      .select("id");
    assert(r.error || r.data.length === 0, "SLA edited");
  });
  await check(
    "Conta Azul workspace import requires both integration and financial rights",
    async () =>
      assert(
        must(
          await admin.rpc("sales_contaazul_authorize", {
            p_user: u,
            p_ws: W,
            p_entity: "receivable",
          }),
        ) === false,
        "integration-only import allowed",
      ),
  );
  await check("fully authorized workspace owner may import Conta Azul", async () =>
    assert(
      must(
        await admin.rpc("sales_contaazul_authorize", {
          p_user: O,
          p_ws: W,
          p_entity: "receivable",
        }),
      ) === true,
      "workspace owner denied",
    ),
  );
  await check("Conta Azul rejects inactive execution owners", async () =>
    assert(
      must(
        await admin.rpc("sales_contaazul_authorize", {
          p_user: "10000000-0000-4000-8000-000000000005",
          p_ws: W,
          p_entity: "connection",
        }),
      ) === false,
      "inactive owner allowed",
    ),
  );
  await check("Conta Azul scope verifier is unavailable to ordinary clients", async () =>
    blocked(
      await h.rpc("sales_contaazul_authorize", { p_user: O, p_ws: W, p_entity: "receivable" }),
    ),
  );
  const session = must(await h.auth.getSession()).session;
  const claims = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString(),
  );
  const view = await seed("view_as_sessions", {
    workspace_id: W,
    admin_id: O,
    target_user_id: u,
    mode: "role",
    role_id: R,
    read_only: true,
    nonce: "iso-order4-" + Date.now(),
    session_id: claims.session_id,
    expires_at: new Date(Date.now() + 60000).toISOString(),
  });
  await check("real role-preview session is recognized as read only", async () =>
    assert(must(await h.rpc("is_read_only_view")) === true, "preview not active"),
  );
  await check("role preview cannot manage workflow execution", async () => {
    const r = await h.rpc("sales_area_authorize", { r: "system.workflows", a: "manage" });
    blocked(r);
  });
  await check("role preview cannot publish or alter a workflow", async () => {
    const result = await h.from("workflows").update({ enabled: false }).eq("id", wf).select("id");
    assert(result.error || result.data?.length === 0, "preview changed workflow");
  });
  await admin.from("view_as_sessions").delete().eq("id", view).then(must);
} finally {
  for (const [t, id] of fixtures.reverse()) {
    if (t === "segments") must(await admin.from("segment_members").delete().eq("segment_id", id));
    must(await admin.from(t).delete().eq("id", id));
  }
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
    root + "/order4-advanced-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
