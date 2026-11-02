import { protectSalesClient } from "../../src/lib/access-control/sales-client-projection.ts";
// Real local GoTrue JWT/PostgREST acceptance. No messages or production access.
import { readFileSync, writeFileSync } from "node:fs";
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
  if (cohorts.length) {
    must(await admin.from("prospecting_sequence_cohort_people").delete().in("cohort_id", cohorts));
    must(await admin.from("prospecting_sequence_cohorts").delete().in("id", cohorts));
  }
  if (versionIds.length)
    must(await admin.from("prospecting_sequence_versions").delete().in("id", versionIds));
  for (const [table, id] of fixtures.reverse()) {
    if (table === "prospecting_sequence_drafts")
      must(await admin.from("prospecting_sequence_draft_revisions").delete().eq("draft_id", id));
    must(await admin.from(table).delete().eq("id", id));
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
}
if (process.env.SEQUENCE_ACCEPTANCE_REPORT)
  writeFileSync(
    process.env.SEQUENCE_ACCEPTANCE_REPORT,
    JSON.stringify({ environment: "isolated", results, metrics }, null, 2),
  );
if (results.some((r) => !r.passed)) process.exitCode = 1;
