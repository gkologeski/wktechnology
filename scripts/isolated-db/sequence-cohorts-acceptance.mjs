import { sequenceHandoff } from "../../src/lib/prospecting/sequences/handoff.server.ts";
import { sequenceOperations } from "../../src/lib/prospecting/sequences/operations.server.ts";
import { processSequenceRun } from "../../src/lib/prospecting/sequences/worker.server.ts";
import { protectSalesClient } from "../../src/lib/access-control/sales-client-projection.ts";
// Real local GoTrue JWT/PostgREST acceptance. No messages or production access.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { prepareSequenceEnrollment } from "../../src/lib/prospecting/sequences/enrollment.server.ts";
import { cohortCandidates } from "../../src/lib/prospecting/sequences/enrollment.ts";
import { newDefinition, newStep } from "../../src/lib/prospecting/sequences/draft.ts";
const root = process.env.BANKING_ISOLATED_ROOT;
if (!root) throw Error("Explicit isolated root required");
const cfg = JSON.parse(readFileSync(root + "/status.private.json"));
if (
  cfg.API_URL !== "http://127.0.0.1:54521" ||
  readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-permissions-20261023"
)
  throw Error("Isolated only");
const accounts = JSON.parse(readFileSync(root + "/hr-accounts.private.json"));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, options);
const must = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const assert = (x, m) => {
  if (!x) throw Error(m);
};
const blocked = (r) => assert(!!r.error, "Unauthorized mutation succeeded");
assert(
  must(await admin.from("__isolated_marker").select("label")).some(
    (x) => x.label === "techerp-isolated-harness",
  ),
  "Marker missing",
);
const clients = [];
for (const account of accounts) {
  const c = createClient(cfg.API_URL, cfg.ANON_KEY, options);
  must(await c.auth.signInWithPassword({ email: account.email, password: account.password }));
  clients.push(protectSalesClient(c));
}
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b",
  O = "10000000-0000-4000-8000-000000000001";
const roles = ["30000000-0000-4000-8000-0000000000a8", "30000000-0000-4000-8000-0000000000a9"];
const keys = [
  "techsales.tasks.view.own",
  "techsales.tasks.update.own",
  "techsales.tasks.create.own",
  "techsales.tasks.assign.own",
  "techsales.activities.view.own",
  "techsales.activities.update.own",
  "system.channels.view.workspace",
  "techsales.inbox.email.view.own",
  "techsales.inbox.email.create.own",
  "techsales.inbox.email.update.own",
  "techsales.inbox.whatsapp.view.own",
  "techsales.inbox.whatsapp.create.own",
  "techsales.inbox.whatsapp.update.own",
  "techsales.activities.create.own",
  ...["view", "create", "update", "manage", "assign"].flatMap((a) =>
    ["own", "team", "workspace"].map((s) => `system.automation.sequences.${a}.${s}`),
  ),
  ...["contacts", "leads"].flatMap((r) =>
    ["own", "team", "workspace"].map((s) => `techsales.${r}.view.${s}`),
  ),
];
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .in("role_id", roles)
    .in("permission_key", keys),
);
const settingsBefore = must(
  await admin.from("sdr_workspace_settings").select("enabled").eq("workspace_id", W).maybeSingle(),
);
const grant = async (role, list, effect = "grant") =>
  must(
    await admin.from("job_role_permission_overrides").upsert(
      list.map((permission_key) => ({
        workspace_id: W,
        role_id: role,
        permission_key,
        effect,
        created_by: O,
      })),
      { onConflict: "workspace_id,role_id,permission_key" },
    ),
  );
const metrics = {},
  fixtures = [],
  bindingAccounts = [],
  results = [],
  tag = "cohort" + crypto.randomUUID().replaceAll("-", "").slice(0, 10),
  actor = accounts[0].id;
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
const seed = async (table, data) => {
  const row = must(
    await admin
      .from(table)
      .insert({ id: crypto.randomUUID(), ...data })
      .select("id")
      .single(),
  );
  fixtures.push([table, row.id]);
  return row.id;
};
const makeVersion = async (definition, creator = clients[0]) => {
  const id = crypto.randomUUID();
  const d = must(
    await creator.rpc("prospecting_sequence_draft_save", {
      p_id: id,
      p_workspace: W,
      p_expected_revision: 0,
      p_name: "[ISO] Cohort " + tag,
      p_definition: definition,
    }),
  );
  fixtures.push(["prospecting_sequence_drafts", id]);
  return must(
    await creator.rpc("prospecting_sequence_version_create", {
      p_id: id,
      p_workspace: W,
      p_expected_revision: d.revision,
    }),
  ).id;
};
const definition = newDefinition();
definition.steps = [
  {
    ...newStep("email"),
    accountId: actor,
    subject: "Consulta",
    body: "Podemos conversar?",
    thread: "new",
  },
  newStep("end"),
];
definition.audience.groups = [
  { logic: "and", filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag }] },
];
let version, run;
const cohortIds = [];
const request = () => ({
  workspaceId: W,
  versionId: version,
  requestId: crypto.randomUUID(),
  consentEvidence: "[ISO] Autorização sintética para teste sem envios.",
});
const servicePrepare = (data, candidates, pActor = actor) =>
  admin.rpc("prospecting_sequence_cohort_prepare", {
    p_workspace: data.workspaceId,
    p_actor: pActor,
    p_version: data.versionId,
    p_request: data.requestId,
    p_consent: data.consentEvidence,
    p_candidates: candidates,
  });
let a, b, c, d, e, f, g, converted;
try {
  for (const role of roles) await grant(role, keys, "deny");
  await grant(roles[0], [
    ...["view", "create", "update", "manage", "assign"].map(
      (a) => `system.automation.sequences.${a}.own`,
    ),
    "techsales.contacts.view.own",
    "techsales.leads.view.own",
  ]);
  const own = { workspace_id: W, owner_id: actor, assigned_to: actor, last_name: tag };
  const email = (n) => `${tag}.${n}@example.invalid`;
  a = await seed("contacts", { ...own, first_name: "Elegível", email: email("same") });
  b = await seed("contacts", {
    ...own,
    first_name: "Duplicado",
    email: email("same").toUpperCase(),
  });
  c = await seed("contacts", { ...own, first_name: "Descadastro", email: email("optout") });
  d = await seed("contacts", { ...own, first_name: "Cliente", email: email("customer") });
  e = await seed("contacts", { ...own, first_name: "Negociação", email: email("open") });
  f = await seed("contacts", { ...own, first_name: "Sem canal" });
  g = await seed("contacts", { ...own, first_name: "Em sequência", email: email("other") });
  await seed("email_unsubscribes", {
    workspace_id: W,
    owner_id: O,
    email: email("optout"),
    token: crypto.randomUUID(),
  });
  await seed("deals", {
    workspace_id: W,
    owner_id: actor,
    assigned_to: actor,
    name: "[ISO] Won " + tag,
    primary_contact_id: d,
    stage: "won",
  });
  await seed("deals", {
    workspace_id: W,
    owner_id: actor,
    assigned_to: actor,
    name: "[ISO] Open " + tag,
    primary_contact_id: e,
    stage: "negotiation",
  });
  const legacy = await seed("sequences", {
    workspace_id: W,
    owner_id: actor,
    name: "[ISO] Legacy " + tag,
    entity: "contacts",
    steps: [],
    enabled: true,
  });
  await seed("sequence_enrollments", {
    workspace_id: W,
    owner_id: actor,
    sequence_id: legacy,
    entity_id: g,
    status: "active",
  });
  converted = await seed("leads", {
    ...own,
    first_name: "Convertido",
    email: email("converted"),
    converted_contact_id: a,
  });
  version = await makeVersion(definition);
  const input = request();
  await check(
    "authenticated application resolves shared filters and prepares held cohort",
    async () => {
      run = await prepareSequenceEnrollment(clients[0], input, admin);
      cohortIds.push(run.id);
      assert(
        run.requested === 7 && run.held === 1 && run.blocked === 6,
        "Unexpected cohort counts: " + JSON.stringify(run),
      );
      for (const reason of [
        "duplicate",
        "opt_out",
        "customer",
        "open_deal",
        "missing_channel",
        "other_sequence",
      ])
        assert(run.reasons[reason] === 1, "Missing exclusion " + reason);
      assert(
        must(
          await admin
            .from("prospecting_sequence_cohorts")
            .select("state")
            .eq("id", run.id)
            .single(),
        ).state === "held",
        "Execution accidentally enabled",
      );
    },
  );
  await check("same request returns same snapshot instead of enrolling twice", async () => {
    const retry = await prepareSequenceEnrollment(clients[0], input, admin);
    assert(retry.id === run.id && retry.held === 1, "Retry duplicated snapshot");
  });
  await check("same version repeated under another request reserves no duplicate", async () => {
    const duplicate = await prepareSequenceEnrollment(clients[0], request(), admin);
    cohortIds.push(duplicate.id);
    assert(
      duplicate.held === 0 && duplicate.reasons.duplicate === 2,
      "Same version duplicate not excluded",
    );
  });
  await check("converted lead cannot bypass a held contact via another email", async () => {
    const stored = must(
      await admin
        .from("leads")
        .select("email,assigned_to,owner_id,deleted_at")
        .eq("id", converted)
        .single(),
    );
    assert(
      stored.email === email("converted"),
      "Converted fixture email changed by a database trigger: " + JSON.stringify(stored),
    );
    const visible = must(
      await clients[0]
        .from("leads")
        .select("id,email,assigned_to")
        .eq("id", converted)
        .maybeSingle(),
    );
    assert(visible, "Converted fixture is not visible to the caller");
    const leadDef = structuredClone(definition);
    leadDef.audience.base = "leads";
    leadDef.audience.groups = [
      { logic: "and", filters: [{ entity: "leads", column: "id", op: "eq", value: converted }] },
    ];
    // id is intentionally not a filterable field; use the real email catalog field instead.
    leadDef.audience.groups[0].filters[0] = {
      entity: "leads",
      column: "email",
      op: "eq",
      value: email("converted"),
    };
    const lv = await makeVersion(leadDef);
    const value = await prepareSequenceEnrollment(
      clients[0],
      { ...request(), versionId: lv },
      admin,
    );
    cohortIds.push(value.id);
    assert(
      value.requested === 1 && value.held === 0 && value.reasons.other_sequence === 1,
      "Converted identity bypassed deduplication: " + JSON.stringify(value),
    );
  });
  await check("reader sees summary without consent text or identity fingerprints", async () => {
    const rows = must(
      await clients[0].rpc("prospecting_sequence_cohort_list", {
        p_workspace: W,
        p_version: version,
      }),
    );
    assert(
      rows.some((x) => x.id === run.id),
      "Summary missing",
    );
    blocked(
      await clients[0]
        .from("prospecting_sequence_cohorts")
        .select("consent_evidence")
        .eq("id", run.id),
    );
    blocked(
      await clients[0]
        .from("prospecting_sequence_cohort_people")
        .select("identity_keys")
        .eq("cohort_id", run.id),
    );
  });
  await check(
    "authenticated and anonymous clients cannot call privileged snapshot writer",
    async () => {
      const data = request();
      for (const client of [clients[0], createClient(cfg.API_URL, cfg.ANON_KEY, options)])
        blocked(
          await client.rpc("prospecting_sequence_cohort_prepare", {
            p_workspace: W,
            p_actor: actor,
            p_version: version,
            p_request: data.requestId,
            p_consent: data.consentEvidence,
            p_candidates: [],
          }),
        );
    },
  );
  await grant(roles[0], ["system.automation.sequences.assign.own"], "deny");
  await check("explicit deny blocks service preparation using existing actor", async () =>
    blocked(await servicePrepare(request(), [])),
  );
  await grant(roles[0], ["system.automation.sequences.assign.own"]);
  await check("inactive and foreign actors are rejected by privileged writer", async () => {
    blocked(await servicePrepare(request(), [], accounts[2].id));
    blocked(await servicePrepare(request(), [], accounts[3].id));
    blocked(await servicePrepare({ ...request(), workspaceId: B }, []));
  });
  await check("missing assign permission and foreign reader cannot access cohorts", async () => {
    blocked(await servicePrepare(request(), [], accounts[1].id));
    assert(
      must(await clients[1].from("prospecting_sequence_cohorts").select("id").eq("id", run.id))
        .length === 0,
      "Unpermitted cohort visible",
    );
    blocked(
      await clients[3].rpc("prospecting_sequence_cohort_list", {
        p_workspace: W,
        p_version: version,
      }),
    );
  });
  await check("snapshot is immutable and direct writes are denied", async () => {
    blocked(
      await clients[0]
        .from("prospecting_sequence_cohorts")
        .update({ state: "running" })
        .eq("id", run.id),
    );
    blocked(
      await clients[0].from("prospecting_sequence_cohort_people").delete().eq("cohort_id", run.id),
    );
  });
  await check("commercial toggles never bypass opt-out or channel validation", async () => {
    const optional = structuredClone(definition);
    optional.audience.excludeCustomers = false;
    optional.audience.excludeOpenDeals = false;
    optional.audience.excludeOtherSequences = false;
    const vv = await makeVersion(optional);
    const value = await prepareSequenceEnrollment(
      clients[0],
      { ...request(), versionId: vv },
      admin,
    );
    cohortIds.push(value.id);
    assert(
      value.held === 4 &&
        value.blocked === 3 &&
        value.reasons.opt_out === 1 &&
        value.reasons.missing_channel === 1,
      "Unsafe opt-out override: " + JSON.stringify(value),
    );
  });
  await check("parallel requests reserve a person once", async () => {
    const person = await seed("contacts", {
      workspace_id: W,
      owner_id: actor,
      assigned_to: actor,
      first_name: "Corrida",
      last_name: tag + "race",
      email: email("race"),
    });
    const def = structuredClone(definition);
    def.audience.groups[0].filters[0].value = tag + "race";
    const vv = await makeVersion(def);
    const replies = await Promise.all([
      prepareSequenceEnrollment(clients[0], { ...request(), versionId: vv }, admin),
      prepareSequenceEnrollment(clients[0], { ...request(), versionId: vv }, admin),
    ]);
    replies.forEach((r) => cohortIds.push(r.id));
    assert(
      replies.reduce((n, r) => n + r.held, 0) === 1 &&
        replies.reduce((n, r) => n + (r.reasons.duplicate || 0), 0) === 1,
      "Race enrolled twice",
    );
  });
  await check(
    "field masking is rechecked before snapshot and masked data is never restored",
    async () => {
      const raw = must(
        await clients[0]
          .from("contacts")
          .select("id,email,whatsapp_e164,mobile_phone,phone")
          .eq("id", a)
          .single(),
      );
      const payload = cohortCandidates(
        [
          {
            sourceType: "contact",
            sourceId: a,
            contactId: a,
            label: "Teste",
            phone: null,
            phones: [raw.whatsapp_e164, raw.mobile_phone, raw.phone],
            values: { "contact.email": raw.email },
          },
        ],
        definition,
      );
      const rule = await seed("field_permission_rules", {
        workspace_id: W,
        owner_id: O,
        resource: "techsales.contacts",
        field: "email",
        mode: "masked",
        role_id: roles[0],
        is_system: false,
      });
      try {
        const stale = request();
        blocked(await servicePrepare(stale, payload));
        assert(
          must(
            await admin
              .from("prospecting_sequence_cohorts")
              .select("id")
              .eq("request_id", stale.requestId),
          ).length === 0,
          "Partial masked snapshot persisted",
        );
        const masked = await prepareSequenceEnrollment(clients[0], request(), admin);
        cohortIds.push(masked.id);
        assert(masked.requested === 7 && masked.held === 0, "A hidden email was used for contact");
      } finally {
        must(await admin.from("field_permission_rules").delete().eq("id", rule));
      }
    },
  );
  await check("server preparation rejects a source outside current row scope", async () => {
    const alien = await seed("contacts", {
      workspace_id: W,
      owner_id: accounts[1].id,
      assigned_to: accounts[1].id,
      first_name: "Outro responsável",
      email: email("alien"),
    });
    const payload = cohortCandidates(
      [
        {
          sourceType: "contact",
          sourceId: alien,
          contactId: alien,
          label: "Outro",
          phone: null,
          phones: [null, null, null],
          values: { "contact.email": email("alien") },
        },
      ],
      definition,
    );
    const result = await servicePrepare(request(), payload);
    assert(result.error?.code === "42501", "Row scope was bypassed");
  });
  await check(
    "a visible version owned by another user still requires matching assign scope",
    async () => {
      await grant(roles[1], [
        "system.automation.sequences.view.own",
        "system.automation.sequences.create.own",
        "system.automation.sequences.manage.own",
      ]);
      const vv = await makeVersion(definition, clients[1]);
      await grant(roles[0], ["system.automation.sequences.view.workspace"]);
      try {
        const result = await servicePrepare({ ...request(), versionId: vv }, []);
        assert(result.error?.code === "42501", "assign.own reached another owner");
      } finally {
        await grant(roles[0], ["system.automation.sequences.view.workspace"], "deny");
        await grant(
          roles[1],
          [
            "system.automation.sequences.view.own",
            "system.automation.sequences.create.own",
            "system.automation.sequences.manage.own",
          ],
          "deny",
        );
      }
    },
  );
  await check(
    "commercial exclusion follows shared identity without exposing hidden CRM rows",
    async () => {
      const visible = await seed("contacts", {
        workspace_id: W,
        owner_id: actor,
        assigned_to: actor,
        first_name: "Visível",
        last_name: tag + "alias",
        email: email("alias"),
      });
      const hidden = await seed("contacts", {
        workspace_id: W,
        owner_id: accounts[1].id,
        assigned_to: accounts[1].id,
        first_name: "Oculto",
        last_name: tag + "hidden",
        email: email("alias"),
      });
      await seed("deals", {
        workspace_id: W,
        owner_id: accounts[1].id,
        assigned_to: accounts[1].id,
        name: "[ISO] Cliente privado " + tag,
        primary_contact_id: hidden,
        stage: "won",
      });
      const def = structuredClone(definition);
      def.audience.groups[0].filters[0].value = tag + "alias";
      const vv = await makeVersion(def);
      const result = await prepareSequenceEnrollment(
        clients[0],
        { ...request(), versionId: vv },
        admin,
      );
      cohortIds.push(result.id);
      assert(
        result.requested === 1 && result.held === 0 && result.reasons.customer === 1,
        "Private customer identity was ignored",
      );
      assert(
        must(await clients[0].from("contacts").select("id").eq("id", hidden)).length === 0,
        "Hidden CRM row was exposed",
      );
    },
  );
  await check("a thousand recipients are prepared in one atomic bounded batch", async () => {
    const bulk = Array.from({ length: 1000 }, (_, i) => ({
      id: crypto.randomUUID(),
      workspace_id: W,
      owner_id: actor,
      assigned_to: actor,
      first_name: "Carga sintética",
      last_name: tag + "bulk",
      email: email("bulk" + i),
    }));
    for (let offset = 0; offset < bulk.length; offset += 100) {
      const rows = must(
        await admin
          .from("contacts")
          .insert(bulk.slice(offset, offset + 100))
          .select("id"),
      );
      rows.forEach((r) => fixtures.push(["contacts", r.id]));
    }
    const def = structuredClone(definition);
    def.audience.groups[0].filters[0].value = tag + "bulk";
    const vv = await makeVersion(def),
      started = Date.now();
    const result = await prepareSequenceEnrollment(
      clients[0],
      { ...request(), versionId: vv },
      admin,
    );
    cohortIds.push(result.id);
    const duration = Date.now() - started;
    assert(
      result.requested === 1000 && result.held === 1000 && result.blocked === 0,
      "Partial or wrong load batch",
    );
    metrics.bulk_duration_ms = duration;
  });
  await check(
    "changed source identity aborts transaction rather than using stale contact data",
    async () => {
      const raw = must(
        await clients[0]
          .from("contacts")
          .select("id,email,whatsapp_e164,mobile_phone,phone")
          .eq("id", a)
          .single(),
      );
      const payload = cohortCandidates(
        [
          {
            sourceType: "contact",
            sourceId: a,
            contactId: a,
            label: "Teste",
            phone: null,
            phones: [raw.whatsapp_e164, raw.mobile_phone, raw.phone],
            values: { "contact.email": raw.email },
          },
        ],
        definition,
      );
      const data = request();
      must(
        await admin
          .from("contacts")
          .update({ email: email("changed") })
          .eq("id", a),
      );
      blocked(await servicePrepare(data, payload));
      assert(
        must(
          await admin
            .from("prospecting_sequence_cohorts")
            .select("id")
            .eq("request_id", data.requestId),
        ).length === 0,
        "Partial snapshot survived",
      );
    },
  );
  await check("runtime starts once and exposes only scoped runs", async () => {
    const def = newDefinition();
    def.audience.groups = [
      {
        logic: "and",
        filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "runtime" }],
      },
    ];
    def.steps = [
      {
        id: crypto.randomUUID(),
        title: "Call",
        type: "call",
        mode: "human",
        assigneeId: actor,
        scriptId: null,
        notes: "Isolated only",
        attempts: 1,
      },
      newStep("end"),
    ];
    await seed("contacts", {
      workspace_id: W,
      owner_id: actor,
      first_name: "Runtime",
      last_name: tag + "runtime",
      phone: "+5548991104003",
    });
    const version = await makeVersion(def);
    const cohort = await prepareSequenceEnrollment(
      clients[0],
      {
        workspaceId: W,
        versionId: version,
        requestId: crypto.randomUUID(),
        consentEvidence: "Synthetic isolated test only",
      },
      admin,
    );
    assert(
      must(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
      ) === 1,
      "Start failed",
    );
    assert(
      must(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
      ) === 0,
      "Start duplicated run",
    );
    const run = must(
      await clients[0]
        .from("prospecting_sequence_runs")
        .select("id,state")
        .eq("version_id", version),
    )[0];
    assert(run?.state === "active", "Run invisible");
    metrics.runtime_run = run.id;
    const operations = await sequenceOperations(clients[0], {
      workspaceId: W,
      versionId: version,
      page: 0,
    });
    assert(
      operations.total === 1 && operations.rows[0].canManage && operations.canStart,
      "Operator view/current capabilities failed",
    );
    assert(!JSON.stringify(operations).includes("lease_token"), "Lease token leaked to UI");
    assert(
      operations.rows[0].person?.label.includes("Runtime"),
      "Current visible person was not linked in the operator panel",
    );
    blocked(
      await clients[3].rpc("prospecting_sequence_capabilities", {
        p_workspace: W,
        p_owners: [actor],
      }),
    );
    const caps = must(
      await clients[1].rpc("prospecting_sequence_capabilities", {
        p_workspace: W,
        p_owners: [actor],
      }),
    );
    assert(!caps.owners[actor].manage, "Peer gained manage capability");
    assert(
      must(await clients[3].from("prospecting_sequence_runs").select("id").eq("id", run.id))
        .length === 0,
      "Foreign run leaked",
    );
    blocked(
      await clients[0]
        .from("prospecting_sequence_runs")
        .update({ state: "completed" })
        .eq("id", run.id),
    );
  });
  await check(
    "runtime control denies missing manage, explicit deny, foreign and inactive actors",
    async () => {
      const args = { p_workspace: W, p_run: metrics.runtime_run, p_action: "pause" };
      for (const index of [1, 2, 3])
        blocked(await clients[index].rpc("prospecting_sequence_control", args));
      await grant(roles[0], ["system.automation.sequences.manage.own"], "deny");
      blocked(await clients[0].rpc("prospecting_sequence_control", args));
      await grant(roles[0], ["system.automation.sequences.manage.own"]);
      assert(
        must(await clients[0].rpc("prospecting_sequence_control", args)) === "paused",
        "Pause failed",
      );
      assert(
        must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).length === 0,
        "Paused run claimed",
      );
      assert(
        must(
          await clients[0].rpc("prospecting_sequence_control", { ...args, p_action: "resume" }),
        ) === "active",
        "Resume failed",
      );
    },
  );
  await check("runtime leases cannot be claimed twice or used by a browser", async () => {
    blocked(await clients[0].rpc("prospecting_sequence_claim", { p_limit: 100 }));
    const pair = await Promise.all([
      admin.rpc("prospecting_sequence_claim", { p_limit: 100 }),
      admin.rpc("prospecting_sequence_claim", { p_limit: 100 }),
    ]);
    const runs = pair.flatMap(must).filter((r) => r.id === metrics.runtime_run);
    assert(runs.length === 1, "Lease duplicated");
    metrics.runtime_lease = runs[0].lease_token;
    blocked(
      await clients[0].rpc("prospecting_sequence_context", {
        p_run: metrics.runtime_run,
        p_lease: metrics.runtime_lease,
      }),
    );
    blocked(
      await admin.rpc("prospecting_sequence_context", {
        p_run: metrics.runtime_run,
        p_lease: crypto.randomUUID(),
      }),
    );
    const ctx = must(
      await admin.rpc("prospecting_sequence_context", {
        p_run: metrics.runtime_run,
        p_lease: metrics.runtime_lease,
      }),
    );
    assert(ctx.person.entity === "contact" && !ctx.signals.replied, "Context unavailable");
    metrics.runtime_step = ctx.definition.steps[0].id;
  });
  await check("runtime effect permission is rechecked and reservation is unique", async () => {
    const args = {
      p_run: metrics.runtime_run,
      p_lease: metrics.runtime_lease,
      p_step: metrics.runtime_step,
    };
    await grant(roles[0], ["techsales.activities.create.own"], "deny");
    blocked(await admin.rpc("prospecting_sequence_effect_begin", args));
    await grant(roles[0], ["techsales.activities.create.own"]);
    const e = must(await admin.rpc("prospecting_sequence_effect_begin", args));
    metrics.runtime_effect = e.id;
    metrics.runtime_token = e.token;
    blocked(await admin.rpc("prospecting_sequence_effect_begin", args));
    blocked(await clients[0].from("prospecting_sequence_effects").select("token").eq("id", e.id));
  });
  await check("runtime receipt survives pause and never advances paused cursor", async () => {
    must(
      await clients[0].rpc("prospecting_sequence_control", {
        p_workspace: W,
        p_run: metrics.runtime_run,
        p_action: "pause",
      }),
    );
    assert(
      must(
        await admin.rpc("prospecting_sequence_effect_finish", {
          p_effect: metrics.runtime_effect,
          p_token: metrics.runtime_token,
          p_provider: "isolated-receipt",
        }),
      ),
      "Receipt lost",
    );
    const run = must(
      await admin
        .from("prospecting_sequence_runs")
        .select("state,cursor")
        .eq("id", metrics.runtime_run)
        .single(),
    );
    assert(run.state === "paused" && run.cursor === 0, "Paused cursor changed");
    const repeat = must(
      await admin.rpc("prospecting_sequence_effect_finish", {
        p_effect: metrics.runtime_effect,
        p_token: metrics.runtime_token,
        p_provider: "isolated-receipt",
      }),
    );
    assert(!repeat, "Receipt replay succeeded");
  });

  await check("runtime resume reconciles a paused receipt without resending", async () => {
    must(
      await clients[0].rpc("prospecting_sequence_control", {
        p_workspace: W,
        p_run: metrics.runtime_run,
        p_action: "resume",
      }),
    );
    // Isolated fault injection: expire only this synthetic run's lease. Never changes user privileges.
    execFileSync(
      "/Applications/Docker.app/Contents/Resources/bin/docker",
      [
        "exec",
        "supabase_db_techerp-permissions-20261023",
        "psql",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `UPDATE public.prospecting_sequence_runs SET lease_until=now()-interval '1 second' WHERE id='${metrics.runtime_run}'::uuid`,
      ],
      { stdio: "pipe" },
    );
    const runs = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 }));
    const run = runs.find((r) => r.id === metrics.runtime_run);
    assert(run?.cursor === 1, "Confirmed effect would be retried");
    const done = must(
      await admin.rpc("prospecting_sequence_transition", {
        p_run: run.id,
        p_lease: run.lease_token,
        p_state: "completed",
        p_cursor: 1,
        p_due: new Date().toISOString(),
        p_reason: "isolated_end",
      }),
    );
    assert(done, "End transition failed");
    blocked(
      await clients[0].rpc("prospecting_sequence_control", {
        p_workspace: W,
        p_run: run.id,
        p_action: "resume",
      }),
    );
  });

  await check("runtime executes a real isolated call task and receipt atomically", async () => {
    const def = newDefinition();
    def.audience.groups = [
      {
        logic: "and",
        filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "task" }],
      },
    ];
    def.steps = [
      {
        id: crypto.randomUUID(),
        title: "[ISO] Phone task",
        type: "call",
        mode: "human",
        assigneeId: actor,
        scriptId: null,
        notes: "No external call",
        attempts: 1,
      },
      newStep("end"),
    ];
    const contact = await seed("contacts", {
      workspace_id: W,
      owner_id: actor,
      first_name: "Task",
      last_name: tag + "task",
      phone: "+5548991104004",
    });
    const version = await makeVersion(def);
    const cohort = await prepareSequenceEnrollment(
      clients[0],
      {
        workspaceId: W,
        versionId: version,
        requestId: crypto.randomUUID(),
        consentEvidence: "Synthetic local task only",
      },
      admin,
    );
    assert(
      must(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
      ) === 1,
      "Task run not started",
    );
    const claimed = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
      (r) => r.version_id === version,
    );
    assert(claimed, "Task not claimed");
    const result = await processSequenceRun(
      admin,
      claimed,
      {
        prepare: async () => async (effect) => {
          const id = must(
            await admin.rpc("prospecting_sequence_task_effect", {
              p_effect: effect.id,
              p_token: effect.token,
              p_lease: claimed.lease_token,
            }),
          );
          fixtures.push(["activities", id]);
          return { receipt: id, committed: true };
        },
        handoff: async () => {
          throw Error("Unexpected handoff");
        },
      },
      new Date("2026-11-02T13:00:00Z"),
    );
    assert(result.status === "effect_succeeded", "Task execution failed: " + result.status);
    const effects = must(
      await admin
        .from("prospecting_sequence_effects")
        .select("provider_id,status")
        .eq("run_id", claimed.id),
    );
    assert(effects.length === 1 && effects[0].status === "succeeded", "Receipt not atomic");
    const activity = must(
      await admin
        .from("activities")
        .select("id,type,related_contact_id,assigned_to")
        .eq("id", effects[0].provider_id)
        .single(),
    );
    assert(
      activity.type === "call" &&
        activity.related_contact_id === contact &&
        activity.assigned_to === actor,
      "Wrong task linkage",
    );
    const run = must(
      await admin
        .from("prospecting_sequence_runs")
        .select("cursor,state")
        .eq("id", claimed.id)
        .single(),
    );
    assert(run.cursor === 1, "Task cursor not advanced");
    assert(run.state === "waiting_task", "Cadence did not wait for the human task");
    assert(
      must(await admin.rpc("prospecting_sequence_wake_tasks", { p_limit: 100 })) === 0,
      "Unfinished task woke cadence",
    );
    const args = { p_workspace: W, p_run: claimed.id, p_outcome: "answered" };
    const otherContact = await seed("contacts", {
      workspace_id: W,
      owner_id: actor,
      first_name: "Other",
      last_name: tag + "task_relink",
    });
    must(
      await admin
        .from("activities")
        .update({ related_contact_id: otherContact })
        .eq("id", activity.id),
    );
    blocked(await clients[0].rpc("prospecting_sequence_complete_call", args));
    must(
      await admin.from("activities").update({ related_contact_id: contact }).eq("id", activity.id),
    );
    blocked(await clients[3].rpc("prospecting_sequence_complete_call", args));
    blocked(await clients[2].rpc("prospecting_sequence_complete_call", args));
    await grant(roles[0], ["techsales.activities.view.own"]);
    await grant(roles[0], ["techsales.activities.update.own"], "deny");
    blocked(await clients[0].rpc("prospecting_sequence_complete_call", args));
    await grant(roles[0], ["techsales.activities.view.own", "techsales.activities.update.own"]);
    must(await clients[0].rpc("prospecting_sequence_complete_call", args));
    assert(
      must(await admin.rpc("prospecting_sequence_wake_tasks", { p_limit: 100 })) === 1,
      "Completed task did not wake cadence",
    );
    assert(
      must(
        await admin.from("prospecting_sequence_runs").select("state").eq("id", claimed.id).single(),
      ).state === "active",
      "Task completion did not release the wait",
    );
    const nextClaim = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
      (r) => r.id === claimed.id,
    );
    const completedContext = must(
      await admin.rpc("prospecting_sequence_context", {
        p_run: nextClaim.id,
        p_lease: nextClaim.lease_token,
      }),
    );
    assert(
      completedContext.signals.callAnswered && completedContext.signals.callResultKnown,
      "Manual result was not reflected in execution conditions",
    );
  });

  await check("runtime rechecks version ownership scope after activation", async () => {
    const def = newDefinition();
    def.audience.groups = [
      {
        logic: "and",
        filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "scope" }],
      },
    ];
    def.steps = [
      {
        id: crypto.randomUUID(),
        title: "Scope",
        type: "call",
        mode: "human",
        assigneeId: actor,
        scriptId: null,
        notes: "No call",
        attempts: 1,
      },
      newStep("end"),
    ];
    await seed("contacts", {
      workspace_id: W,
      owner_id: actor,
      first_name: "Scope",
      last_name: tag + "scope",
      phone: "+5548991104005",
    });
    await grant(roles[1], [
      "system.automation.sequences.view.own",
      "system.automation.sequences.create.own",
      "system.automation.sequences.manage.own",
    ]);
    const broad = ["view", "manage", "assign"].map(
      (a) => `system.automation.sequences.${a}.workspace`,
    );
    await grant(roles[0], broad);
    const version = await makeVersion(def, clients[1]);
    const cohort = await prepareSequenceEnrollment(
      clients[0],
      {
        workspaceId: W,
        versionId: version,
        requestId: crypto.randomUUID(),
        consentEvidence: "Synthetic version scope test",
      },
      admin,
    );
    assert(
      must(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
      ) === 1,
      "Shared version did not start",
    );
    await grant(roles[0], broad, "deny");
    const claimed = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
      (r) => r.version_id === version,
    );
    assert(claimed, "Missing synthetic run");
    let called = false;
    const out = await processSequenceRun(
      admin,
      claimed,
      {
        prepare: async () => {
          called = true;
          throw Error("Must not prepare");
        },
        handoff: async () => {
          called = true;
        },
      },
      new Date("2026-11-02T13:00:00Z"),
    );
    assert(out.status === "blocked" && !called, "Lost version scope still executed");
    blocked(
      await clients[1].rpc("prospecting_sequence_discard_cohort", {
        p_workspace: W,
        p_cohort: cohort.id,
      }),
    );
  });

  await check(
    "email synthetic receipt commits Inbox, identity and cursor without provider network",
    async () => {
      await grant(roles[0], [
        "system.channels.view.workspace",
        "techsales.inbox.email.view.own",
        "techsales.inbox.email.create.own",
      ]);
      const mailbox = await seed("email_accounts", {
        workspace_id: W,
        owner_id: actor,
        provider: "gmail",
        email: tag + "sender@example.test",
        status: "connected",
      });
      const account = await seed("service_channel_accounts", {
        workspace_id: W,
        channel: "email",
        source_key: mailbox,
        label: "[ISO] Sender",
        enabled: true,
      });
      const contact = await seed("contacts", {
        workspace_id: W,
        owner_id: actor,
        first_name: "Email",
        last_name: tag + "email",
        email: tag + "target@example.test",
      });
      const token = await seed("email_unsubscribes", {
        workspace_id: W,
        owner_id: actor,
        email: tag + "target@example.test",
        token: crypto.randomUUID().replaceAll("-", ""),
        reason: "__token__",
      });
      const def = newDefinition();
      def.audience.groups = [
        {
          logic: "and",
          filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "email" }],
        },
      ];
      def.steps = [
        {
          id: crypto.randomUUID(),
          title: "Email",
          type: "email",
          accountId: account,
          subject: "[ISO] Hello",
          body: "No send",
          thread: "new",
        },
        newStep("end"),
      ];
      const version = await makeVersion(def);
      const cohort = await prepareSequenceEnrollment(
        clients[0],
        {
          workspaceId: W,
          versionId: version,
          requestId: crypto.randomUUID(),
          consentEvidence: "Synthetic receipt, no provider call",
        },
        admin,
      );
      assert(cohort.held === 1, "Reserved unsubscribe token was treated as opt-out");
      must(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
      );
      const run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
        (r) => r.version_id === version,
      );
      assert(run, "Email run missing");
      blocked(
        await clients[0].rpc("prospecting_sequence_delivery_access", {
          p_run: run.id,
          p_lease: run.lease_token,
        }),
      );
      await grant(roles[0], ["system.channels.view.workspace"], "deny");
      blocked(
        await admin.rpc("prospecting_sequence_delivery_access", {
          p_run: run.id,
          p_lease: run.lease_token,
        }),
      );
      await grant(roles[0], ["system.channels.view.workspace"]);
      const access = must(
        await admin.rpc("prospecting_sequence_delivery_access", {
          p_run: run.id,
          p_lease: run.lease_token,
        }),
      );
      assert(access.sourceKey === mailbox, "Wrong email account");
      const effect = must(
        await admin.rpc("prospecting_sequence_effect_begin", {
          p_run: run.id,
          p_lease: run.lease_token,
          p_step: def.steps[0].id,
        }),
      );
      const payload = {
        messageId: "iso-message-" + crypto.randomUUID(),
        threadId: "iso-thread-" + crypto.randomUUID(),
        messageIdHeader: "<isolated@example.test>",
        from: tag + "sender@example.test",
        to: tag + "target@example.test",
        subject: "[ISO] Hello",
        body: "No network used",
      };
      must(
        await admin.rpc("prospecting_sequence_receipt_store", {
          p_effect: effect.id,
          p_token: effect.token,
          p_payload: payload,
        }),
      );
      const pending = must(
        await admin
          .from("prospecting_sequence_runs")
          .select("state,reason,cursor")
          .eq("id", run.id)
          .single(),
      );
      assert(
        pending.state === "paused" &&
          pending.reason === "receipt_projection_pending" &&
          pending.cursor === 1,
        "Receipt was not preserved independently",
      );
      blocked(
        await clients[0]
          .from("prospecting_sequence_effects")
          .select("provider_receipt,sender,target")
          .eq("id", effect.id),
      );
      const constraint = "iso_seq_" + effect.id.replaceAll("-", "").slice(0, 12);
      const ddl = (sql) =>
        execFileSync(
          "/Applications/Docker.app/Contents/Resources/bin/docker",
          [
            "exec",
            "supabase_db_techerp-permissions-20261023",
            "psql",
            "-U",
            "supabase_admin",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
          ],
          { stdio: "pipe" },
        );
      try {
        ddl(
          `ALTER TABLE public.email_messages ADD CONSTRAINT ${constraint} CHECK(id<>'${effect.id}'::uuid) NOT VALID`,
        );
        blocked(
          await admin.rpc("prospecting_sequence_delivery_commit", {
            p_effect: effect.id,
            p_token: effect.token,
            p_payload: payload,
          }),
        );
        const saved = must(
          await admin
            .from("prospecting_sequence_effects")
            .select("provider_id,projection_state")
            .eq("id", effect.id)
            .single(),
        );
        assert(
          saved.provider_id === payload.messageId && saved.projection_state === "pending",
          "Projection failure lost receipt",
        );
        blocked(
          await clients[0].rpc("prospecting_sequence_control", {
            p_workspace: W,
            p_run: run.id,
            p_action: "resume",
          }),
        );
      } finally {
        ddl(`ALTER TABLE public.email_messages DROP CONSTRAINT IF EXISTS ${constraint}`);
      }
      const message = must(
        await admin.rpc("prospecting_sequence_delivery_commit", {
          p_effect: effect.id,
          p_token: effect.token,
          p_payload: payload,
        }),
      );
      const row = must(
        await admin
          .from("email_messages")
          .select("id,thread_id,direction")
          .eq("id", message)
          .single(),
      );
      fixtures.push(["email_threads", row.thread_id], ["email_messages", row.id]);
      const thread = must(
        await admin
          .from("email_threads")
          .select("contact_id,workspace_id")
          .eq("id", row.thread_id)
          .single(),
      );
      assert(
        thread.contact_id === contact && thread.workspace_id === W && row.direction === "outbound",
        "Email identity wrong",
      );
      assert(
        must(
          await admin.rpc("prospecting_sequence_delivery_commit", {
            p_effect: effect.id,
            p_token: effect.token,
            p_payload: payload,
          }),
        ) === message,
        "Receipt retry not idempotent",
      );
      assert(
        must(
          await admin.from("prospecting_sequence_runs").select("cursor").eq("id", run.id).single(),
        ).cursor === 1,
        "Email cursor not committed",
      );
      // A provider auto-reply never becomes a customer response, nor a wake signal.
      await seed("email_messages", {
        workspace_id: W,
        owner_id: actor,
        account_id: mailbox,
        thread_id: row.thread_id,
        direction: "inbound",
        provider_message_id: "auto-" + crypto.randomUUID(),
        from_email: payload.to,
        to_emails: [payload.from],
        in_reply_to: payload.messageIdHeader,
        headers: { "Auto-Submitted": "auto-replied" },
        received_at: new Date().toISOString(),
      });
      const automatic = must(
        await admin.rpc("prospecting_sequence_reply_signals", {
          p_run: run.id,
          p_previous: def.steps[0].id,
        }),
      );
      assert(
        !automatic.replied && !automatic.previousReplied,
        "Automatic email counted as a customer response",
      );
      assert(
        must(await admin.rpc("prospecting_sequence_wake_replies", { p_limit: 100 })) === 0,
        "Automatic email woke cadence",
      );
      await seed("email_messages", {
        workspace_id: W,
        owner_id: actor,
        account_id: mailbox,
        thread_id: row.thread_id,
        direction: "inbound",
        provider_message_id: "reply-" + crypto.randomUUID(),
        from_email: payload.to,
        to_emails: [payload.from],
        in_reply_to: payload.messageIdHeader,
        headers: {},
        received_at: new Date().toISOString(),
      });
      const reply = must(
        await admin.rpc("prospecting_sequence_reply_signals", {
          p_run: run.id,
          p_previous: def.steps[0].id,
        }),
      );
      assert(reply.replied && reply.previousReplied, "Verified reply was not detected");
      const wrongPrevious = must(
        await admin.rpc("prospecting_sequence_reply_signals", {
          p_run: run.id,
          p_previous: crypto.randomUUID(),
        }),
      );
      assert(
        wrongPrevious.replied && !wrongPrevious.previousReplied,
        "Reply leaked across previous-step condition",
      );
      assert(
        !must(
          await admin.rpc("prospecting_sequence_agent_route_allowed", {
            p_workspace: W,
            p_channel: "email",
            p_source: row.thread_id,
            p_agent: crypto.randomUUID(),
          }),
        ),
        "Channel default agent stole human sequence",
      );
      assert(
        must(await admin.rpc("prospecting_sequence_wake_replies", { p_limit: 100 })) === 1,
        "Customer response did not wake cadence",
      );
      const responseRun = must(
        await admin.rpc("prospecting_sequence_claim", { p_limit: 100 }),
      ).find((x) => x.id === run.id);
      assert(responseRun, "Reply run not claimable");
      blocked(
        await clients[0].rpc("prospecting_sequence_handoff", {
          p_run: responseRun.id,
          p_lease: responseRun.lease_token,
          p_mode: "human",
        }),
      );
      await grant(roles[0], [
        "techsales.inbox.email.update.own",
        "techsales.activities.create.own",
        "techsales.tasks.create.own",
        "techsales.tasks.view.own",
        "techsales.tasks.update.own",
      ]);
      must(
        await admin.rpc("prospecting_sequence_handoff", {
          p_run: responseRun.id,
          p_lease: responseRun.lease_token,
          p_mode: "human",
        }),
      );
      const response = await processSequenceRun(
        admin,
        responseRun,
        {
          prepare: async () => {
            throw Error("Reply must not send a campaign step");
          },
          handoff: sequenceHandoff(admin),
        },
        new Date(),
      );
      assert(response.status === "stop", "Reply did not stop without sending");
      const human = must(
        await admin.from("prospecting_sequence_runs").select("state").eq("id", run.id).single(),
      );
      assert(human.state === "human", "Human handoff not confirmed");
      const humanTask = must(
        await admin.from("activities").select("id,related_contact_id").eq("id", run.id).single(),
      );
      assert(humanTask.related_contact_id === contact, "Human task lost customer association");
      fixtures.push(["activities", run.id], ["notifications", run.id]);
      must(await admin.rpc("prospecting_sequence_release_identities", { p_limit: 500 }));
      assert(
        must(
          await admin.from("prospecting_sequence_runs").select("state").eq("id", run.id).single(),
        ).state === "human",
        "Pending human service was released early",
      );
      must(await clients[0].from("activities").update({ completed: true }).eq("id", run.id));
      must(await admin.rpc("prospecting_sequence_release_identities", { p_limit: 500 }));
      assert(
        must(
          await admin.from("prospecting_sequence_runs").select("state").eq("id", run.id).single(),
        ).state === "completed",
        "Completed human service did not close cadence",
      );

      must(
        await admin.from("email_unsubscribes").update({ reason: "user_requested" }).eq("id", token),
      );
      const next = await makeVersion(def);
      const blockedCohort = await prepareSequenceEnrollment(
        clients[0],
        {
          workspaceId: W,
          versionId: next,
          requestId: crypto.randomUUID(),
          consentEvidence: "Synthetic opt-out check",
        },
        admin,
      );
      assert(
        blockedCohort.held === 0 && blockedCohort.reasons.opt_out === 1,
        "Real opt-out was ignored",
      );
    },
  );
  await check("WhatsApp synthetic receipt commits Inbox without invoking Meta", async () => {
    await grant(roles[0], [
      "system.channels.view.workspace",
      "techsales.inbox.whatsapp.view.own",
      "techsales.inbox.whatsapp.create.own",
    ]);
    const account = await seed("service_channel_accounts", {
      workspace_id: W,
      channel: "whatsapp",
      source_key: "999000111222333",
      label: "[ISO] WhatsApp",
      enabled: true,
    });
    const contact = await seed("contacts", {
      workspace_id: W,
      owner_id: actor,
      first_name: "WA",
      last_name: tag + "wa",
      whatsapp_e164: "+5548991104006",
    });
    const agent = await seed("sdr_playbooks", {
      workspace_id: W,
      owner_id: actor,
      name: "[ISO] Sequence agent",
      enabled: true,
    });
    await seed("sdr_agent_versions", {
      workspace_id: W,
      playbook_id: agent,
      version: 1,
      status: "published",
    });
    bindingAccounts.push(account);
    must(
      await admin.from("service_channel_bindings").insert({
        workspace_id: W,
        account_id: account,
        agent_id: agent,
        enabled: true,
        inbound: true,
        campaigns: true,
      }),
    );
    must(
      await admin
        .from("service_channel_accounts")
        .update({ routing_configured: true })
        .eq("id", account),
    );
    must(
      await admin
        .from("sdr_workspace_settings")
        .upsert({ workspace_id: W, enabled: true }, { onConflict: "workspace_id" }),
    );
    const def = newDefinition();
    def.audience.groups = [
      {
        logic: "and",
        filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "wa" }],
      },
    ];
    def.steps = [
      {
        id: crypto.randomUUID(),
        title: "WA",
        type: "whatsapp",
        accountId: account,
        templateName: "isolated_template",
        language: "pt_BR",
        variables: {},
        agentId: agent,
      },
      newStep("end"),
    ];
    const version = await makeVersion(def);
    const cohort = await prepareSequenceEnrollment(
      clients[0],
      {
        workspaceId: W,
        versionId: version,
        requestId: crypto.randomUUID(),
        consentEvidence: "Synthetic receipt, no Meta call",
      },
      admin,
    );
    must(
      await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
    );
    const run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
      (r) => r.version_id === version,
    );
    const effect = must(
      await admin.rpc("prospecting_sequence_effect_begin", {
        p_run: run.id,
        p_lease: run.lease_token,
        p_step: def.steps[0].id,
      }),
    );
    const payload = {
      messageId: "isolated-wamid-" + crypto.randomUUID(),
      from: "+554861365335",
      to: "+5548991104006",
      body: "[ISO] No Meta network",
    };
    const message = must(
      await admin.rpc("prospecting_sequence_delivery_commit", {
        p_effect: effect.id,
        p_token: effect.token,
        p_payload: payload,
      }),
    );
    const row = must(
      await admin
        .from("whatsapp_messages")
        .select("id,conversation_id,is_template,template_name")
        .eq("id", message)
        .single(),
    );
    fixtures.push(["whatsapp_conversations", row.conversation_id], ["whatsapp_messages", row.id]);
    const conversation = must(
      await admin
        .from("whatsapp_conversations")
        .select("contact_id,wa_phone_number_id,workspace_id")
        .eq("id", row.conversation_id)
        .single(),
    );
    assert(
      conversation.contact_id === contact &&
        conversation.wa_phone_number_id === "999000111222333" &&
        row.is_template &&
        row.template_name === "isolated_template",
      "WA account or identity mismatch",
    );
    assert(
      must(await admin.from("prospecting_sequence_runs").select("cursor").eq("id", run.id).single())
        .cursor === 1,
      "WA cursor not committed",
    );
    await grant(roles[0], ["techsales.inbox.whatsapp.update.own"]);
    await seed("whatsapp_messages", {
      workspace_id: W,
      owner_id: actor,
      conversation_id: row.conversation_id,
      direction: "inbound",
      from_number: payload.to,
      to_number: payload.from,
      body: "[ISO] Reply",
      wa_message_id: "iso-inbound-" + crypto.randomUUID(),
      provider: "meta",
      status: "received",
    });
    assert(
      must(
        await admin.rpc("prospecting_sequence_agent_route_allowed", {
          p_workspace: W,
          p_channel: "whatsapp",
          p_source: row.conversation_id,
          p_agent: agent,
        }),
      ),
      "Selected agent was blocked",
    );
    assert(
      !must(
        await admin.rpc("prospecting_sequence_agent_route_allowed", {
          p_workspace: W,
          p_channel: "whatsapp",
          p_source: row.conversation_id,
          p_agent: crypto.randomUUID(),
        }),
      ),
      "Another agent stole the conversation",
    );
    must(await admin.rpc("prospecting_sequence_wake_replies", { p_limit: 100 }));
    const agentRun = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
      (x) => x.id === run.id,
    );
    assert(agentRun, "Agent response did not wake run");
    const result = await processSequenceRun(
      admin,
      agentRun,
      {
        prepare: async () => {
          throw Error("No campaign send expected");
        },
        handoff: sequenceHandoff(admin),
      },
      new Date(),
    );
    assert(result.status === "stop", "Agent handoff failed");
    const associated = must(
      await admin
        .from("whatsapp_conversations")
        .select("sdr_enrollment_id,ai_owner")
        .eq("id", row.conversation_id)
        .single(),
    );
    assert(
      associated.ai_owner === "ai" && associated.sdr_enrollment_id,
      "Agent was not bound to conversation",
    );
    fixtures.push(["sdr_enrollments", associated.sdr_enrollment_id]);
    must(await admin.rpc("prospecting_sequence_release_identities", { p_limit: 500 }));
    assert(
      must(await admin.from("prospecting_sequence_runs").select("state").eq("id", run.id).single())
        .state === "agent",
      "Active agent service was released early",
    );
    must(
      await admin
        .from("sdr_enrollments")
        .update({ status: "paused", cancel_reason: "post_close" })
        .eq("id", associated.sdr_enrollment_id),
    );
    must(await admin.rpc("prospecting_sequence_release_identities", { p_limit: 500 }));
    assert(
      must(await admin.from("prospecting_sequence_runs").select("state").eq("id", run.id).single())
        .state === "completed",
      "Closed selected agent service did not close cadence",
    );

    assert(
      must(
        await admin
          .from("sdr_enrollments")
          .select("playbook_id")
          .eq("id", associated.sdr_enrollment_id)
          .single(),
      ).playbook_id === agent,
      "Wrong agent took over",
    );
    const activities = must(
      await admin.from("activities").select("id").eq("related_contact_id", contact),
    );
    activities.forEach((a) => fixtures.push(["activities", a.id]));
  });

  await check("account pacing and rolling quota defer without creating another send", async () => {
    const mailbox = await seed("email_accounts", {
      workspace_id: W,
      owner_id: actor,
      provider: "gmail",
      email: tag + "quota@example.test",
      status: "connected",
    });
    const account = await seed("service_channel_accounts", {
      workspace_id: W,
      channel: "email",
      source_key: mailbox,
      label: "[ISO] Budget",
      enabled: true,
    });
    for (let i = 0; i < 2; i++)
      await seed("contacts", {
        workspace_id: W,
        owner_id: actor,
        first_name: "Budget",
        last_name: tag + "budget",
        email: tag + "budget" + i + "@example.test",
      });
    const def = newDefinition();
    def.settings.dailyLimit = 1;
    def.settings.minimumIntervalSeconds = 60;
    def.audience.excludeOtherSequences = false;
    def.audience.groups = [
      {
        logic: "and",
        filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "budget" }],
      },
    ];
    def.steps = [
      {
        id: crypto.randomUUID(),
        title: "Budget",
        type: "email",
        accountId: account,
        subject: "No network",
        body: "Synthetic quota",
        thread: "new",
      },
      newStep("end"),
    ];
    const version = await makeVersion(def);
    const cohort = await prepareSequenceEnrollment(
      clients[0],
      {
        workspaceId: W,
        versionId: version,
        requestId: crypto.randomUUID(),
        consentEvidence: "Synthetic quota, no send",
      },
      admin,
    );
    assert(cohort.held === 2, "Quota audience wrong");
    must(
      await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
    );
    const runs = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).filter(
      (r) => r.version_id === version,
    );
    assert(runs.length === 2, "Quota runs missing");
    const one = must(
      await admin.rpc("prospecting_sequence_effect_begin", {
        p_run: runs[0].id,
        p_lease: runs[0].lease_token,
        p_step: def.steps[0].id,
      }),
    );
    const deferred = must(
      await admin.rpc("prospecting_sequence_effect_begin", {
        p_run: runs[1].id,
        p_lease: runs[1].lease_token,
        p_step: def.steps[0].id,
      }),
    );
    assert(
      one.id && deferred.reason === "daily_account_limit" && deferred.deferUntil && !deferred.id,
      "Quota did not defer safely",
    );
    assert(
      must(await admin.from("prospecting_sequence_effects").select("id").eq("run_id", runs[1].id))
        .length === 0,
      "Deferred send was reserved",
    );
    const release = { p_claims: runs.map((r) => ({ id: r.id, token: r.lease_token })) };
    blocked(await clients[0].rpc("prospecting_sequence_release_claims", release));
    assert(
      must(await admin.rpc("prospecting_sequence_release_claims", release)) === 1,
      "In-flight lease was released or unused lease leaked",
    );
    def.settings.dailyLimit = 100;
    const nextVersion = await makeVersion(def);
    const nextCohort = await prepareSequenceEnrollment(
      clients[0],
      {
        workspaceId: W,
        versionId: nextVersion,
        requestId: crypto.randomUUID(),
        consentEvidence: "Synthetic pacing, no send",
      },
      admin,
    );
    must(
      await clients[0].rpc("prospecting_sequence_start", {
        p_workspace: W,
        p_cohort: nextCohort.id,
      }),
    );
    const nextRun = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
      (r) => r.version_id === nextVersion,
    );
    const paced = must(
      await admin.rpc("prospecting_sequence_effect_begin", {
        p_run: nextRun.id,
        p_lease: nextRun.lease_token,
        p_step: def.steps[0].id,
      }),
    );
    assert(
      paced.reason === "account_pacing" && !paced.id,
      "Different sequence bypassed account pacing",
    );
    metrics.paced_run = nextRun.id;
    metrics.paced_lease = nextRun.lease_token;
    execFileSync(
      "/Applications/Docker.app/Contents/Resources/bin/docker",
      [
        "exec",
        "supabase_db_techerp-permissions-20261023",
        "psql",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `UPDATE public.prospecting_sequence_runs SET lease_until=now()-interval '1 second' WHERE id='${runs[0].id}'::uuid`,
      ],
      { stdio: "pipe" },
    );
    must(
      await clients[0].rpc("prospecting_sequence_control", {
        p_workspace: W,
        p_run: runs[0].id,
        p_action: "cancel",
      }),
    );
    must(await admin.rpc("prospecting_sequence_release_identities", { p_limit: 500 }));
    assert(
      must(
        await admin
          .from("prospecting_sequence_identity_releases")
          .select("person_id")
          .eq("person_id", runs[0].cohort_person_id),
      ).length === 0,
      "Cancellation released unresolved delivery identity",
    );
    const anotherVersion = await makeVersion(def);
    const guarded = await prepareSequenceEnrollment(
      clients[0],
      {
        workspaceId: W,
        versionId: anotherVersion,
        requestId: crypto.randomUUID(),
        consentEvidence: "Uncertainty quarantine cannot be bypassed",
      },
      admin,
    );
    assert(
      guarded.reasons.delivery_uncertain === 1 && guarded.held === 1,
      "Disabling other-sequence exclusion bypassed delivery uncertainty",
    );
  });

  await check(
    "role-test identities cannot operate sequences even after their preview session",
    async () => {
      const row = must(
        await admin
          .from("workspace_members")
          .select("is_test_user")
          .eq("workspace_id", W)
          .eq("user_id", actor)
          .single(),
      );
      try {
        must(
          await admin
            .from("workspace_members")
            .update({ is_test_user: true })
            .eq("workspace_id", W)
            .eq("user_id", actor),
        );
        blocked(
          await admin.rpc("prospecting_sequence_context", {
            p_run: metrics.paced_run,
            p_lease: metrics.paced_lease,
          }),
        );
        blocked(
          await clients[0].rpc("prospecting_sequence_control", {
            p_workspace: W,
            p_run: metrics.paced_run,
            p_action: "pause",
          }),
        );
      } finally {
        must(
          await admin
            .from("workspace_members")
            .update({ is_test_user: row.is_test_user })
            .eq("workspace_id", W)
            .eq("user_id", actor),
        );
      }
      must(
        await admin.rpc("prospecting_sequence_context", {
          p_run: metrics.paced_run,
          p_lease: metrics.paced_lease,
        }),
      );
    },
  );

  await check(
    "consecutive waits use their own entry clocks instead of collapsing into one delay",
    async () => {
      const def = newDefinition();
      def.audience.groups = [
        {
          logic: "and",
          filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "timers" }],
        },
      ];
      const wait = () => ({
        id: crypto.randomUUID(),
        title: "Wait",
        type: "wait",
        duration: 24,
        unit: "hours",
        source: "any",
        onReply: "human",
      });
      def.steps = [
        wait(),
        wait(),
        {
          id: crypto.randomUUID(),
          title: "Call",
          type: "call",
          mode: "human",
          assigneeId: actor,
          scriptId: null,
          notes: "No call",
          attempts: 1,
        },
        newStep("end"),
      ];
      await seed("contacts", {
        workspace_id: W,
        owner_id: actor,
        first_name: "Timer",
        last_name: tag + "timers",
        phone: "+5548991104008",
      });
      const version = await makeVersion(def);
      const cohort = await prepareSequenceEnrollment(
        clients[0],
        {
          workspaceId: W,
          versionId: version,
          requestId: crypto.randomUUID(),
          consentEvidence: "Synthetic timer test, no send",
        },
        admin,
      );
      must(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
      );
      let run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
        (r) => r.version_id === version,
      );
      const entered = new Date(run.step_entered_at).getTime();
      const noEffects = {
        prepare: async () => {
          throw Error("No provider expected");
        },
        handoff: async () => {
          throw Error("No handoff expected");
        },
      };
      assert(
        (await processSequenceRun(admin, run, noEffects, new Date(entered))).status === "advance",
        "First timer did not advance",
      );
      let saved = must(
        await admin
          .from("prospecting_sequence_runs")
          .select("cursor,next_run_at,step_entered_at")
          .eq("id", run.id)
          .single(),
      );
      assert(
        saved.cursor === 0 && new Date(saved.next_run_at).getTime() - entered === 86_400_000,
        "First wait clock wrong",
      );
      execFileSync(
        "/Applications/Docker.app/Contents/Resources/bin/docker",
        [
          "exec",
          "supabase_db_techerp-permissions-20261023",
          "psql",
          "-U",
          "supabase_admin",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          `UPDATE public.prospecting_sequence_runs SET next_run_at=now()-interval '1 second' WHERE id='${run.id}'::uuid`,
        ],
        { stdio: "pipe" },
      );
      run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
        (r) => r.version_id === version,
      );
      assert(
        (await processSequenceRun(admin, run, noEffects, new Date(entered + 86_400_000))).status ===
          "advance",
        "Elapsed timer did not release its step",
      );
      execFileSync(
        "/Applications/Docker.app/Contents/Resources/bin/docker",
        [
          "exec",
          "supabase_db_techerp-permissions-20261023",
          "psql",
          "-U",
          "supabase_admin",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          `UPDATE public.prospecting_sequence_runs SET next_run_at=now()-interval '1 second' WHERE id='${run.id}'::uuid`,
        ],
        { stdio: "pipe" },
      );
      run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
        (r) => r.version_id === version,
      );
      assert(
        (await processSequenceRun(admin, run, noEffects, new Date(entered + 86_400_000))).status ===
          "advance",
        "Second timer did not schedule",
      );
      saved = must(
        await admin
          .from("prospecting_sequence_runs")
          .select("cursor,next_run_at")
          .eq("id", run.id)
          .single(),
      );
      assert(
        saved.cursor === 1 && new Date(saved.next_run_at).getTime() - entered === 172_800_000,
        "Two 24-hour waits collapsed into 24 hours",
      );
    },
  );

  await check(
    "sequence tasks use task permissions and wait for their real completion",
    async () => {
      await seed("contacts", {
        workspace_id: W,
        owner_id: actor,
        first_name: "Task",
        last_name: tag + "task",
        phone: "+5548991104098",
      });
      const def = newDefinition();
      def.audience.groups = [
        {
          logic: "and",
          filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "task" }],
        },
      ];
      const task = {
        id: crypto.randomUUID(),
        title: "Follow-up",
        type: "task",
        assigneeId: actor,
        notes: "Isolated only",
        dueDays: 1,
      };
      def.steps = [
        task,
        {
          id: crypto.randomUUID(),
          title: "Call",
          type: "call",
          mode: "human",
          assigneeId: actor,
          scriptId: null,
          notes: "No call",
          attempts: 1,
        },
        newStep("end"),
      ];
      const version = await makeVersion(def);
      const cohort = await prepareSequenceEnrollment(
        clients[0],
        {
          workspaceId: W,
          versionId: version,
          requestId: crypto.randomUUID(),
          consentEvidence: "Synthetic task only",
        },
        admin,
      );
      must(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
      );
      const run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
        (r) => r.version_id === version,
      );
      assert(run, "Task run not claimable");
      const args = { p_run: run.id, p_lease: run.lease_token, p_step: task.id };
      await grant(roles[0], ["techsales.tasks.create.own"], "deny");
      blocked(await admin.rpc("prospecting_sequence_effect_begin", args));
      await grant(roles[0], [
        "techsales.tasks.create.own",
        "techsales.tasks.view.own",
        "techsales.tasks.update.own",
      ]);
      const effect = must(await admin.rpc("prospecting_sequence_effect_begin", args));
      const activity = must(
        await admin.rpc("prospecting_sequence_task_effect", {
          p_effect: effect.id,
          p_token: effect.token,
          p_lease: run.lease_token,
        }),
      );
      fixtures.push(["activities", activity]);
      assert(
        must(
          await admin.from("prospecting_sequence_runs").select("state").eq("id", run.id).single(),
        ).state === "waiting_task",
        "Task did not hold cadence",
      );
      must(
        await clients[0]
          .from("activities")
          .update({ completed: true })
          .eq("id", activity)
          .select("id,completed")
          .single(),
      );
      must(await admin.rpc("prospecting_sequence_wake_tasks", { p_limit: 100 }));
      assert(
        must(
          await admin.from("prospecting_sequence_runs").select("state").eq("id", run.id).single(),
        ).state === "active",
        "Real task completion did not wake cadence",
      );

      // Assignment is checked before reserving a task effect, using the task catalog action.
      def.steps[0].assigneeId = accounts[1].id;
      def.audience.excludeOtherSequences = false;
      const assignedVersion = await makeVersion(def);
      const assignedCohort = await prepareSequenceEnrollment(
        clients[0],
        {
          workspaceId: W,
          versionId: assignedVersion,
          requestId: crypto.randomUUID(),
          consentEvidence: "Synthetic assignment scope",
        },
        admin,
      );
      must(
        await clients[0].rpc("prospecting_sequence_start", {
          p_workspace: W,
          p_cohort: assignedCohort.id,
        }),
      );
      const assignedRun = must(
        await admin.rpc("prospecting_sequence_claim", { p_limit: 100 }),
      ).find((r) => r.version_id === assignedVersion);
      assert(assignedRun, "Assigned task not claimable");
      const assignedArgs = {
        p_run: assignedRun.id,
        p_lease: assignedRun.lease_token,
        p_step: task.id,
      };
      blocked(await admin.rpc("prospecting_sequence_effect_begin", assignedArgs));
      assert(
        must(
          await admin
            .from("prospecting_sequence_effects")
            .select("id")
            .eq("run_id", assignedRun.id),
        ).length === 0,
        "Denied assignment reserved an effect",
      );
      await grant(roles[0], ["techsales.tasks.assign.own"]);
      assert(
        must(await admin.rpc("prospecting_sequence_effect_begin", assignedArgs)).id,
        "Authorized task assignment did not reserve",
      );
    },
  );

  await check(
    "discard releases only safe identities and permanently prevents a cancelled snapshot starting",
    async () => {
      const contact = await seed("contacts", {
        workspace_id: W,
        owner_id: actor,
        first_name: "Release",
        last_name: tag + "release",
        email: tag + "release@example.test",
      });
      const def = structuredClone(definition);
      def.audience.groups[0].filters[0].value = tag + "release";
      const prepare = async (v) =>
        prepareSequenceEnrollment(
          clients[0],
          {
            workspaceId: W,
            versionId: v,
            requestId: crypto.randomUUID(),
            consentEvidence: "Synthetic lifecycle only",
          },
          admin,
        );
      const v = await makeVersion(def),
        c = await prepare(v);
      assert(c.held === 1, "Initial reserve failed");
      const blockedVersion = await makeVersion(def);
      assert(
        (await prepare(blockedVersion)).reasons.other_sequence === 1,
        "Live reserve did not exclude another sequence",
      );
      for (const i of [1, 2, 3])
        blocked(
          await clients[i].rpc("prospecting_sequence_discard_cohort", {
            p_workspace: W,
            p_cohort: c.id,
          }),
        );
      await grant(roles[0], ["system.automation.sequences.manage.own"], "deny");
      blocked(
        await clients[0].rpc("prospecting_sequence_discard_cohort", {
          p_workspace: W,
          p_cohort: c.id,
        }),
      );
      await grant(roles[0], ["system.automation.sequences.manage.own"]);
      must(
        await clients[0].rpc("prospecting_sequence_discard_cohort", {
          p_workspace: W,
          p_cohort: c.id,
        }),
      );
      blocked(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: c.id }),
      );
      const next = await makeVersion(def);
      assert(
        (await prepare(next)).held === 1,
        "Safe cancelled reservation still blocked another version",
      );
      assert(
        (await prepare(v)).reasons.duplicate === 1,
        "Same-version dedup was lost by cancellation",
      );
    },
  );
  await check(
    "fresh open deals and customers stop outreach before any provider or task",
    async () => {
      const company = await seed("companies", {
        workspace_id: W,
        owner_id: actor,
        name: "[ISO] Fresh commercial",
      });
      const contact = await seed("contacts", {
        workspace_id: W,
        owner_id: actor,
        company_id: company,
        first_name: "Fresh",
        last_name: tag + "fresh",
        phone: "+5548991104099",
      });
      const def = newDefinition();
      def.audience.groups = [
        {
          logic: "and",
          filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "fresh" }],
        },
      ];
      def.steps = [
        {
          id: crypto.randomUUID(),
          title: "Call",
          type: "call",
          mode: "human",
          assigneeId: actor,
          scriptId: null,
          notes: "No call",
          attempts: 1,
        },
        newStep("end"),
      ];
      const version = await makeVersion(def);
      const cohort = await prepareSequenceEnrollment(
        clients[0],
        {
          workspaceId: W,
          versionId: version,
          requestId: crypto.randomUUID(),
          consentEvidence: "Synthetic updated business state",
        },
        admin,
      );
      assert(cohort.held === 1, "Fresh initial recipient blocked");
      must(
        await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
      );
      const deal = await seed("deals", {
        workspace_id: W,
        owner_id: actor,
        name: "[ISO] New deal",
        company_id: company,
        primary_contact_id: contact,
        stage: "negotiation",
      });
      let called = false;
      const ports = {
        prepare: async () => {
          called = true;
          throw Error("Must not prepare");
        },
        handoff: async () => {
          called = true;
        },
      };
      for (const [stage, reason] of [
        ["negotiation", "open_deal"],
        ["won", "customer"],
      ]) {
        must(await admin.from("deals").update({ stage }).eq("id", deal));
        const run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
          (r) => r.version_id === version,
        );
        assert(run, "Business run not claimable");
        assert(
          (await processSequenceRun(admin, run, ports, new Date())).status === "stop",
          "Business change did not stop execution",
        );
        const saved = must(
          await admin
            .from("prospecting_sequence_runs")
            .select("state,reason")
            .eq("id", run.id)
            .single(),
        );
        assert(
          saved.state === "blocked" && saved.reason === reason && !called,
          "Commercial exclusion did not protect outreach",
        );
        if (stage === "negotiation")
          must(
            await clients[0].rpc("prospecting_sequence_control", {
              p_workspace: W,
              p_run: run.id,
              p_action: "retry",
            }),
          );
      }
    },
  );

  await check("only a certified unstarted effect can be retried with a fresh nonce", async () => {
    const mailbox = await seed("email_accounts", {
      workspace_id: W,
      owner_id: actor,
      provider: "gmail",
      email: tag + "retry_sender@example.test",
      status: "connected",
    });
    const account = await seed("service_channel_accounts", {
      workspace_id: W,
      channel: "email",
      source_key: mailbox,
      label: "[ISO] Retry",
      enabled: true,
    });
    const contact = await seed("contacts", {
      workspace_id: W,
      owner_id: actor,
      first_name: "Retry",
      last_name: tag + "retry",
      email: tag + "before@example.test",
    });
    const def = newDefinition();
    def.audience.groups = [
      {
        logic: "and",
        filters: [{ entity: "contacts", column: "last_name", op: "eq", value: tag + "retry" }],
      },
    ];
    def.steps = [
      {
        id: crypto.randomUUID(),
        title: "Retry",
        type: "email",
        accountId: account,
        subject: "No send",
        body: "Synthetic retry",
        thread: "new",
      },
      newStep("end"),
    ];
    const version = await makeVersion(def);
    const cohort = await prepareSequenceEnrollment(
      clients[0],
      {
        workspaceId: W,
        versionId: version,
        requestId: crypto.randomUUID(),
        consentEvidence: "Certified no-send protocol test",
      },
      admin,
    );
    must(
      await clients[0].rpc("prospecting_sequence_start", { p_workspace: W, p_cohort: cohort.id }),
    );
    let run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
      (r) => r.version_id === version,
    );
    must(
      await admin
        .from("contacts")
        .update({ email: tag + "after@example.test" })
        .eq("id", contact),
    );
    const effect = must(
      await admin.rpc("prospecting_sequence_effect_begin", {
        p_run: run.id,
        p_lease: run.lease_token,
        p_step: def.steps[0].id,
      }),
    );
    const args = {
      p_effect: effect.id,
      p_token: effect.token,
      p_reason: "source_changed_before_send",
    };
    blocked(await clients[0].rpc("prospecting_sequence_effect_not_started", args));
    assert(
      must(await admin.rpc("prospecting_sequence_effect_not_started", args)),
      "Certified no-send was not recorded",
    );
    assert(
      must(await admin.from("prospecting_sequence_runs").select("state").eq("id", run.id).single())
        .state === "blocked",
      "No-send was incorrectly quarantined as unknown",
    );
    must(
      await clients[0].rpc("prospecting_sequence_control", {
        p_workspace: W,
        p_run: run.id,
        p_action: "retry",
      }),
    );
    run = must(await admin.rpc("prospecting_sequence_claim", { p_limit: 100 })).find(
      (r) => r.id === run.id,
    );
    const retry = must(
      await admin.rpc("prospecting_sequence_effect_begin", {
        p_run: run.id,
        p_lease: run.lease_token,
        p_step: def.steps[0].id,
      }),
    );
    assert(
      retry.id === effect.id &&
        retry.token !== effect.token &&
        retry.source.email === tag + "after@example.test",
      "Retry lost idempotency or used stale recipient",
    );
    assert(
      !must(await admin.rpc("prospecting_sequence_effect_not_started", args)),
      "Old nonce modified retried effect",
    );
  });
} finally {
  const versionIds = must(
    await admin
      .from("prospecting_sequence_versions")
      .select("id")
      .in(
        "draft_id",
        fixtures.filter(([t]) => t === "prospecting_sequence_drafts").map(([, id]) => id),
      ),
  ).map((x) => x.id);
  const cohorts = versionIds.length
    ? must(
        await admin.from("prospecting_sequence_cohorts").select("id").in("version_id", versionIds),
      ).map((x) => x.id)
    : [];
  if (versionIds.length) {
    const runs = must(
      await admin.from("prospecting_sequence_runs").select("id").in("version_id", versionIds),
    ).map((r) => r.id);
    if (runs.length) {
      must(await admin.from("prospecting_sequence_effects").delete().in("run_id", runs));
      must(await admin.from("prospecting_sequence_run_events").delete().in("run_id", runs));
      must(await admin.from("prospecting_sequence_runs").delete().in("id", runs));
    }
  }
  if (cohorts.length) {
    must(await admin.from("prospecting_sequence_cohort_people").delete().in("cohort_id", cohorts));
    must(await admin.from("prospecting_sequence_cohorts").delete().in("id", cohorts));
  }
  if (versionIds.length)
    must(await admin.from("prospecting_sequence_versions").delete().in("id", versionIds));
  if (bindingAccounts.length)
    must(await admin.from("service_channel_bindings").delete().in("account_id", bindingAccounts));
  // Preserve exact reverse dependency order, batching only contiguous same-table fixtures.
  const reversed = [...fixtures].reverse();
  for (let index = 0; index < reversed.length; ) {
    const table = reversed[index][0],
      ids = [];
    while (index < reversed.length && reversed[index][0] === table && ids.length < 150)
      ids.push(reversed[index++][1]);
    if (table === "prospecting_sequence_drafts")
      must(await admin.from("prospecting_sequence_draft_revisions").delete().in("draft_id", ids));
    must(await admin.from(table).delete().in("id", ids));
  }

  must(
    await admin
      .from("job_role_permission_overrides")
      .delete()
      .eq("workspace_id", W)
      .in("role_id", roles)
      .in("permission_key", keys),
  );
  if (before.length) must(await admin.from("job_role_permission_overrides").insert(before));
  if (settingsBefore)
    must(
      await admin
        .from("sdr_workspace_settings")
        .update({ enabled: settingsBefore.enabled })
        .eq("workspace_id", W),
    );
  else must(await admin.from("sdr_workspace_settings").delete().eq("workspace_id", W));
}
if (process.env.SEQUENCE_ACCEPTANCE_REPORT)
  writeFileSync(
    process.env.SEQUENCE_ACCEPTANCE_REPORT,
    JSON.stringify(
      { environment: "isolated", results, metrics: { bulk_duration_ms: metrics.bulk_duration_ms } },
      null,
      2,
    ),
  );
if (results.some((r) => !r.passed)) process.exitCode = 1;
