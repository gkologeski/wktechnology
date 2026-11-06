// Real GoTrue/PostgREST acceptance. No remote URL, secret output or production write.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const container = "supabase_db_techerp-permissions-20261023";
const out = resolve(process.env.STAGE7_OUTPUT ?? ".verification/hiring-stage7");
mkdirSync(out, { recursive: true });
const config = JSON.parse(readFileSync(process.env.STAGE7_STATUS_FILE, "utf8"));
if (config.API_URL !== "http://127.0.0.1:54521" || !config.SERVICE_ROLE_KEY || !config.ANON_KEY)
  throw Error("Only the explicitly isolated local endpoint is allowed");
const context = execFileSync(
  docker,
  ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
  { encoding: "utf8" },
).trim();
if (!context.startsWith("unix://")) throw Error("Local Docker socket required");
function sql(text) {
  const r = spawnSync(
    docker,
    [
      "--host",
      context,
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
    ],
    { input: text, encoding: "utf8", maxBuffer: 32 << 20 },
  );
  if (r.status !== 0) throw Error(r.stderr);
  return r.stdout.trim();
}
const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const guard = `DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness') OR EXISTS(SELECT 1 FROM auth.users WHERE email NOT LIKE '%@techerp-test.invalid') THEN RAISE EXCEPTION 'Isolation failed';END IF;END $$;`;
sql(guard);
if (process.argv.includes("--migrate")) {
  const { readdirSync } = await import("node:fs");
  const files = readdirSync("drizzle/migrations")
    .filter((f) => f >= "0308_" && f < "0334_" && f.endsWith(".sql"))
    .sort();
  sql(
    "BEGIN;" +
      guard +
      files.map((f) => readFileSync("drizzle/migrations/" + f, "utf8")).join("\n") +
      "NOTIFY pgrst,'reload schema';COMMIT;",
  );
  writeFileSync(
    out + "/schema.json",
    JSON.stringify(
      {
        files,
        hash: createHash("sha256")
          .update(files.map((f) => readFileSync("drizzle/migrations/" + f)).join("\n"))
          .digest("hex"),
      },
      null,
      2,
    ),
  );
  console.log("Isolated hiring schema applied");
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const previous =
  process.argv.includes("--resume") && existsSync(out + "/credentials.private.json")
    ? JSON.parse(readFileSync(out + "/credentials.private.json", "utf8"))
    : null;
const runId = previous?.runId ?? randomUUID(),
  W = previous?.workspaceId ?? randomUUID(),
  B = previous?.otherWorkspaceId ?? randomUUID(),
  password = previous?.accounts.operator.password ?? randomBytes(30).toString("base64url");
const users = {};
for (const name of [
  "operator",
  "manager",
  "ceo",
  "worker",
  "missing",
  "denied",
  "inactive",
  "foreign",
]) {
  const email = `stage7-${runId.slice(0, 8)}-${name}@techerp-test.invalid`;
  const created = previous?.accounts[name]
    ? await admin.auth.admin.getUserById(previous.accounts[name].id)
    : await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "[STAGE7] " + name },
      });
  if (created.error) throw created.error;
  const client = createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  users[name] = { id: created.data.user.id, email, client, session: login.data.session };
}
const O = users.operator.id,
  M = users.manager.id,
  C = users.ceo.id;
// Trusted bootstrap only: identities/workspaces, never certify a business action as service_role.
sql(`BEGIN;${guard}
INSERT INTO workspaces(id,name,slug,created_by) VALUES(${q(W)},'[STAGE7] Hiring integrated',${q("stage7-" + runId)},${q(O)}),(${q(B)},'[STAGE7] Other tenant',${q("stage7-other-" + runId)},${q(users.foreign.id)}) ON CONFLICT(id) DO NOTHING;
${Object.entries(users)
  .filter(([name]) => name !== "worker")
  .map(
    ([name, u]) =>
      `UPDATE profiles SET active_workspace_id=${q(name === "foreign" ? B : W)},full_name=${q("[STAGE7] " + name)} WHERE id=${q(u.id)}; INSERT INTO workspace_members(workspace_id,user_id,role,status,invited_by) VALUES(${q(name === "foreign" ? B : W)},${q(u.id)},${q(["operator", "manager", "ceo", "foreign"].includes(name) ? "admin" : "member")},${q(name === "inactive" ? "inactive" : "active")},${q(O)}) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status;`,
  )
  .join("\n")}
COMMIT;`);
const credentials = {
  runId,
  workspaceId: W,
  otherWorkspaceId: B,
  apiURL: config.API_URL,
  accounts: Object.fromEntries(
    Object.entries(users).map(([n, u]) => [n, { id: u.id, email: u.email, password }]),
  ),
};
writeFileSync(out + "/credentials.private.json", JSON.stringify(credentials), { mode: 0o600 });
const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: "passed" });
    console.log("PASS " + name);
  } catch (e) {
    results.push({ name, status: "failed", message: e.message });
    writeFileSync(
      out + "/results.json",
      JSON.stringify({ runId, workspaceId: W, results, complete: false }, null, 2),
    );
    throw e;
  }
}
async function rpc(user, name, args) {
  const r = await users[user].client.rpc(name, args);
  if (r.error) throw Error(`${name}: ${r.error.message}`);
  return r.data;
}
async function insert(table, row) {
  const r = await users.operator.client
    .from(table)
    .insert(row)
    .select(
      table === "ats_candidates"
        ? "id,full_name"
        : table === "ats_applications"
          ? "id,status"
          : table === "contracts"
            ? "id,status,role"
            : table === "projects"
              ? "id,name"
              : "*",
    )
    .single();
  if (r.error) throw Error(`${table}: ${r.error.message}`);
  return r.data;
}
async function update(table, id, row) {
  const r = await users.operator.client
    .from(table)
    .update(row)
    .eq("id", id)
    .select(
      table === "ats_applications"
        ? "id,status,stage_value"
        : table === "contracts"
          ? "id,status,role"
          : table === "projects"
            ? "id,name"
            : "*",
    )
    .single();
  if (r.error) throw Error(`${table}: ${r.error.message}`);
  return r.data;
}
const ids = previous?.ids ?? {
  area: randomUUID(),
  entity: randomUUID(),
  role: randomUUID(),
  job: randomUUID(),
  candidate: randomUUID(),
  application: randomUUID(),
};
credentials.ids = ids;
writeFileSync(out + "/credentials.private.json", JSON.stringify(credentials), { mode: 0o600 });
await test("real login yields separate verified identities", async () => {
  for (const u of Object.values(users)) {
    const r = await u.client.auth.getUser();
    assert.equal(r.data.user?.id, u.id);
  }
});
await test("bootstrap grants no access across tenants", async () => {
  await assert.rejects(() => rpc("foreign", "hiring_model_context", { w: W }));
});
// Fixed fixture catalog data; approval and employment decisions below always use real user JWTs.
sql(`BEGIN;${guard}
SELECT set_config('request.jwt.claim.sub',${q(O)},true),set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO user_groups(id,workspace_id,name) VALUES(${q(ids.area)},${q(W)},'[STAGE7] Technical') ON CONFLICT(id) DO NOTHING;
INSERT INTO legal_entities(id,workspace_id,created_by,code,name,cnpj,active) VALUES(${q(ids.entity)},${q(W)},${q(O)},'STAGE7','[STAGE7] WK fictitious','00000000000001',true) ON CONFLICT(id) DO NOTHING;
INSERT INTO job_roles(id,workspace_id,owner_id,name) VALUES(${q(ids.role)},${q(W)},${q(O)},'[STAGE7] Outsourcing developer') ON CONFLICT(id) DO NOTHING;
COMMIT;`);
await test("area approval configured through authenticated RPC", () =>
  rpc("operator", "hiring_area_policy_save", {
    p_ws: W,
    p_area: ids.area,
    p_manager: M,
    p_ceo: C,
    p_manager_delegate: null,
    p_ceo_delegate: null,
  }));
// Internal path first establishes all real boundaries before extending the client flow.
const existingJob = await users.operator.client
  .from("ats_jobs")
  .select("*")
  .eq("id", ids.job)
  .maybeSingle();
const job =
  existingJob.data ??
  (await insert("ats_jobs", {
    id: ids.job,
    workspace_id: W,
    owner_id: O,
    title: "[STAGE7] Internal developer",
    employment_type: "pj",
    hiring_role_id: ids.role,
  }));
await rpc("operator", "hiring_demand_save", {
  p_ws: W,
  p_job: job.id,
  p_revision: job.hiring_revision,
  p_purpose: "internal",
  p_area: ids.area,
  p_regime: "pj",
  p_billing: "not_applicable",
});
const current = JSON.parse(sql(`SELECT row_to_json(j) FROM ats_jobs j WHERE id=${q(ids.job)}`));
const request = await rpc("operator", "hiring_demand_request", {
  p_ws: W,
  p_job: ids.job,
  p_revision: current.hiring_revision,
});
await test("CEO cannot skip the manager approval", () =>
  assert.rejects(() =>
    rpc("ceo", "hiring_demand_decide", {
      p_ws: W,
      p_request: request,
      p_decision: "approved",
      p_note: "[STAGE7] out of order",
    }),
  ));
await rpc("manager", "hiring_demand_decide", {
  p_ws: W,
  p_request: request,
  p_decision: "approved",
  p_note: "[STAGE7] Manager approved",
});
await rpc("ceo", "hiring_demand_decide", {
  p_ws: W,
  p_request: request,
  p_decision: "approved",
  p_note: "[STAGE7] CEO approved",
});
await test("internal demand approved with no deal", async () => {
  const j = JSON.parse(sql(`SELECT row_to_json(j) FROM ats_jobs j WHERE id=${q(ids.job)}`));
  assert.equal(j.hiring_approval_status, "approved");
  assert.equal(j.deal_id, null);
});
writeFileSync(
  out + "/state.private.json",
  JSON.stringify({
    ids,
    W,
    B,
    users: Object.fromEntries(
      Object.entries(users).map(([n, u]) => [n, { id: u.id, email: u.email }]),
    ),
  }),
  { mode: 0o600 },
);
writeFileSync(
  out + "/results.json",
  JSON.stringify(
    { runId, workspaceId: W, results, complete: false, stage: "demand-approved" },
    null,
    2,
  ),
);
// Continue through the real ATS/People/Contracts/Projects boundaries.
sql(
  `BEGIN;${guard} UPDATE hiring_workspace_settings SET signature_gate_enabled=true,employment_gate_enabled=true,finance_gate_enabled=true,lifecycle_gate_enabled=true,lifecycle_finance_area_id=${q(ids.area)} WHERE workspace_id=${q(W)};COMMIT;`,
);
const knownCandidate = await users.operator.client
  .from("ats_candidates")
  .select("id")
  .eq("id", ids.candidate)
  .maybeSingle();
if (!knownCandidate.data)
  await insert("ats_candidates", {
    id: ids.candidate,
    workspace_id: W,
    owner_id: O,
    full_name: "[STAGE7] Developer",
    email: users.worker.email,
  });
const knownApplication = await users.operator.client
  .from("ats_applications")
  .select("id,status")
  .eq("id", ids.application)
  .maybeSingle();
if (!knownApplication.data)
  await insert("ats_applications", {
    id: ids.application,
    workspace_id: W,
    owner_id: O,
    candidate_id: ids.candidate,
    job_id: ids.job,
    stage_value: "applied",
    status: "active",
  });
await test("ATS confirmation uses the authenticated canonical hiring guard", () =>
  update("ats_applications", ids.application, {
    stage_value: "hired",
    status: "hired",
    hiring_details: {
      model: "internal",
      employment_type: "pj",
      start_date: "2026-10-01",
      monthly_amount: 5000,
      role_title: "[STAGE7] Developer",
    },
  }));
const keys = [
  "techprojects.projects.view.workspace",
  "techprojects.tasks.view.workspace",
  "techprojects.time_entries.view.own",
  "techprojects.time_entries.create.own",
  "techpeople.people.view.own",
];
let model = await rpc("operator", "hiring_model_context", { w: W });
model =
  model.models.find((m) => m.name === "[STAGE7] Allocated developer")?.id ??
  (await rpc("operator", "hiring_model_save", {
    w: W,
    p_id: null,
    p_revision: 0,
    p_role: ids.role,
    p_name: "[STAGE7] Allocated developer",
    p_keys: keys,
    p_allocation: true,
    p_active: true,
  }));
const admission = {
  w: W,
  p_application: ids.application,
  p_person: null,
  p_model: model,
  p_entity: ids.entity,
  p_start: "2026-10-01",
  p_end: "2027-06-30",
  p_reason: "[STAGE7] Agreed fixture period",
  p_employment: "pj",
  p_hire_date: "2026-10-01",
};
let engagement;
await test("competing API admissions create one person and engagement", async () => {
  const values = await Promise.all([
    rpc("operator", "hiring_employment_admit", admission),
    rpc("operator", "hiring_employment_admit", admission),
  ]);
  assert.equal(values[0], values[1]);
  engagement = values[0];
});
const purchase = await rpc("operator", "hiring_employment_contract", {
  w: W,
  p_engagement: engagement,
  p_contract: null,
  p_options: { monthly_value: 5000, body_html: "[STAGE7] Fictional test agreement" },
});
await test("purchase contract is idempotent and stays separate from client revenue", async () => {
  assert.equal(
    await rpc("operator", "hiring_employment_contract", {
      w: W,
      p_engagement: engagement,
      p_contract: null,
      p_options: {},
    }),
    purchase,
  );
  const contract = (
    await users.operator.client
      .from("contracts")
      .select("role,status,contracting_legal_entity_id")
      .eq("id", purchase)
      .single()
  ).data;
  assert.equal(contract.role, "client");
  assert.ok(previous ? ["draft", "active"].includes(contract.status) : contract.status === "draft");
  assert.equal(contract.contracting_legal_entity_id, ids.entity);
});
await rpc("operator", "contract_transition", { p_contract: purchase, p_status: "active" });
const project = await insert("projects", {
  workspace_id: W,
  owner_id: O,
  name: "[STAGE7] Internal delivery",
  status: "active",
});
const allocation = await rpc("operator", "hiring_allocate", {
  w: W,
  p_engagement: engagement,
  p_project: project.id,
  p_start: "2026-10-01",
  p_end: "2027-06-30",
  p_pct: 100,
  p_reason: "[STAGE7] Approved allocation",
});
const invite = await rpc("operator", "hiring_employment_invite", {
  w: W,
  p_engagement: engagement,
});
await test("specific invite applies only its access model to the real recipient", async () => {
  await rpc("worker", "hiring_accept_invite", { p_token: invite });
  await rpc("worker", "hiring_accept_invite", { p_token: invite });
  const selected = await users.worker.client
    .from("profiles")
    .update({ active_workspace_id: W })
    .eq("id", users.worker.id);
  if (selected.error) throw selected.error;
  const visible = await users.worker.client.from("projects").select("id");
  if (visible.error) throw visible.error;
  assert.deepEqual(
    visible.data.map((p) => p.id),
    [project.id],
  );
});
writeFileSync(
  out + "/state.private.json",
  JSON.stringify({
    ids,
    W,
    B,
    engagement,
    purchase,
    project: project.id,
    allocation,
    person: JSON.parse(
      sql(`SELECT row_to_json(e) FROM hiring_engagements e WHERE id=${q(engagement)}`),
    ).person_id,
    users: Object.fromEntries(
      Object.entries(users).map(([n, u]) => [n, { id: u.id, email: u.email }]),
    ),
  }),
  { mode: 0o600 },
);
writeFileSync(
  out + "/results.json",
  JSON.stringify(
    { runId, workspaceId: W, results, complete: false, stage: "allocated-and-invited" },
    null,
    2,
  ),
);
console.log("Integrated authenticated allocation prepared.");

export {
  sql,
  q,
  guard,
  out,
  config,
  users,
  W,
  B,
  O,
  M,
  C,
  ids,
  runId,
  results,
  rpc,
  insert,
  update,
  test,
  engagement,
  purchase,
  project,
  allocation,
  admin,
};
if (!process.env.STAGE7_CHAIN) process.exitCode = 3;
