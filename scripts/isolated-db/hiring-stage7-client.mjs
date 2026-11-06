// Synthetic client chain. Only the base harness's explicitly loopback-marked stack.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
process.env.STAGE7_CHAIN = "1";
const { users, W, O, ids, runId, results, out, rpc, insert, update, test, admin, sql, q, guard } =
  await import("./hiring-stage7.mjs");
async function record(table, row, projection = "id") {
  const r = await users.operator.client.from(table).insert(row).select(projection).single();
  if (r.error) throw Error(table + ": " + r.error.message);
  return r.data;
}
const company = await record("companies", {
  workspace_id: W,
  owner_id: O,
  name: "[STAGE7] Fictional customer",
});
const deal = await record("deals", {
  workspace_id: W,
  owner_id: O,
  name: "[STAGE7] Outsourcing sale",
  company_id: company.id,
  stage: "won",
});
const contract = await insert("contracts", {
  workspace_id: W,
  owner_id: O,
  title: "[STAGE7] Fictional commercial agreement",
  number: "STAGE7-" + runId.slice(0, 8),
  role: "provider",
  status: "draft",
  document_kind: "main",
  deal_id: deal.id,
  counterparty_company_id: company.id,
  contracting_legal_entity_id: ids.entity,
  starts_at: "2026-10-01",
  ends_at: "2027-06-30",
  monthly_value: 10000,
  currency: "BRL",
  body_html: "<p>[STAGE7] Synthetic contract, not a real signature.</p>",
});
await rpc("operator", "hiring_contract_select_commercial", { p_ws: W, p_contract: contract.id });
await test("unsigned customer contract keeps delivery in planning and blocks activation", async () => {
  const planned = await rpc("operator", "deal_delivery_create_project", {
    p_deal: deal.id,
    p_operational_owner: O,
  });
  const projectId = planned.results[0].project_id;
  const row = await users.operator.client
    .from("projects")
    .select("id,status")
    .eq("id", projectId)
    .single();
  assert.equal(row.data.status, "planning");
  const r = await users.operator.client
    .from("projects")
    .update({ status: "active" })
    .eq("id", projectId);
  assert.ok(r.error);
  assert.match(r.error.message, /assin|contrato/i);
});
await test("signature evidence is scoped to the selected contract version", async () => {
  const ctx = await rpc("operator", "hiring_contract_signature_context", {
    p_ws: W,
    p_contract: contract.id,
  });
  const pdf = Buffer.from("%PDF-1.4\n[STAGE7] isolated synthetic evidence only\n%%EOF");
  const sha = createHash("sha256").update(pdf).digest("hex");
  const path = W + "/" + contract.id + "/" + randomUUID() + ".pdf";
  await admin.storage.createBucket("contract-signature-evidence", { public: false });
  const upload = await admin.storage.from("contract-signature-evidence").upload(path, pdf, {
    contentType: "application/pdf",
    metadata: { sha256: sha, contract_hash: ctx.hash, actor_id: O },
  });
  if (upload.error) throw upload.error;
  await rpc("operator", "hiring_contract_external_attest", {
    p_ws: W,
    p_contract: contract.id,
    p_hash: ctx.hash,
    p_path: path,
    p_file_hash: sha,
    p_signed_on: "2026-10-01",
    p_reference: "[STAGE7] SYNTHETIC LOCAL ONLY",
    p_note: "[STAGE7] Fictional evidence in isolated environment; no real document attested.",
  });
  await rpc("operator", "contract_transition", { p_contract: contract.id, p_status: "active" });
  const ready = await rpc("operator", "hiring_contract_signature_context", {
    p_ws: W,
    p_contract: contract.id,
  });
  assert.equal(ready.reason, null);
});
let delivery;
await test("won signed deal creates one linked project on repeated API execution", async () => {
  delivery = await rpc("operator", "deal_delivery_create_project", {
    p_deal: deal.id,
    p_operational_owner: O,
  });
  const repeated = await rpc("operator", "deal_delivery_create_project", {
    p_deal: deal.id,
    p_operational_owner: O,
  });
  assert.equal(delivery.results.length, 1);
  assert.equal(repeated.results[0].project_id, delivery.results[0].project_id);
});
const job = await insert("ats_jobs", {
  workspace_id: W,
  owner_id: O,
  title: "[STAGE7] Client developer",
  employment_type: "pj",
  hiring_role_id: ids.role,
  deal_id: deal.id,
});
await rpc("operator", "hiring_demand_save", {
  p_ws: W,
  p_job: job.id,
  p_revision: job.hiring_revision,
  p_purpose: "client",
  p_area: ids.area,
  p_regime: "pj",
  p_billing: "fixed_recurring",
});
const current = JSON.parse(sql(`SELECT row_to_json(j) FROM ats_jobs j WHERE id=${q(job.id)}`));
const request = await rpc("operator", "hiring_demand_request", {
  p_ws: W,
  p_job: job.id,
  p_revision: current.hiring_revision,
});
for (const u of ["manager", "ceo"])
  await rpc(u, "hiring_demand_decide", {
    p_ws: W,
    p_request: request,
    p_decision: "approved",
    p_note: "[STAGE7] client demand approved",
  });
const candidate = await insert("ats_candidates", {
  workspace_id: W,
  owner_id: O,
  full_name: "[STAGE7] Customer professional",
  email: "client-" + runId + "@techerp-test.invalid",
});
const app = await insert("ats_applications", {
  workspace_id: W,
  owner_id: O,
  candidate_id: candidate.id,
  job_id: job.id,
  status: "active",
  stage_value: "applied",
});
await update("ats_applications", app.id, {
  stage_value: "hired",
  status: "hired",
  hiring_details: {
    model: "outsourcing",
    employment_type: "pj",
    start_date: "2026-10-01",
    monthly_amount: 5000,
    role_title: "Developer",
  },
});
const context = await rpc("operator", "hiring_model_context", { w: W });
const args = {
  w: W,
  p_application: app.id,
  p_person: null,
  p_model: context.models.find((m) => m.name === "[STAGE7] Allocated developer").id,
  p_entity: ids.entity,
  p_start: null,
  p_end: "2026-12-31",
  p_reason: "[STAGE7] first allocation period reviewed",
  p_employment: "pj",
  p_hire_date: "2026-10-01",
};
let employment, purchase;
await test("client admission inherits signed commercial entity and dates and is idempotent", async () => {
  const [a, b] = await Promise.all([
    rpc("operator", "hiring_employment_admit", args),
    rpc("operator", "hiring_employment_admit", args),
  ]);
  assert.equal(a, b);
  employment = a;
  const e = JSON.parse(sql(`SELECT row_to_json(e) FROM hiring_engagements e WHERE id=${q(a)}`));
  assert.equal(e.commercial_contract_id, contract.id);
  assert.equal(e.starts_at, "2026-10-01");
  assert.equal(e.ends_at, "2026-12-31");
  assert.equal(e.legal_entity_id, ids.entity);
  purchase = await rpc("operator", "hiring_employment_contract", {
    w: W,
    p_engagement: a,
    p_contract: null,
    p_options: { monthly_value: 5000, body_html: "[STAGE7] Fictional purchase agreement" },
  });
  await rpc("operator", "contract_mutate", {
    p_contract: purchase,
    p_patch: { ends_at: "2027-06-30" },
  });
  await rpc("operator", "contract_transition", { p_contract: purchase, p_status: "active" });
  const allocation = await rpc("operator", "hiring_allocate", {
    w: W,
    p_engagement: a,
    p_project: delivery.results[0].project_id,
    p_start: "2026-10-01",
    p_end: "2026-12-31",
    p_pct: 100,
    p_reason: "[STAGE7] inherited commercial period",
  });
  assert.ok(allocation);
});
await test("existing professional receives a new dated allocation without duplicate person or purchase contract", async () => {
  const person = JSON.parse(
    sql(`SELECT row_to_json(e) FROM hiring_engagements e WHERE id=${q(employment)}`),
  ).person_id;
  const before = sql(`SELECT count(*) FROM people WHERE workspace_id=${q(W)}`);
  const nextJob = await insert("ats_jobs", {
    workspace_id: W,
    owner_id: O,
    title: "[STAGE7] Existing professional next period",
    employment_type: "pj",
    hiring_role_id: ids.role,
    deal_id: deal.id,
  });
  await rpc("operator", "hiring_demand_save", {
    p_ws: W,
    p_job: nextJob.id,
    p_revision: nextJob.hiring_revision,
    p_purpose: "client",
    p_area: ids.area,
    p_regime: "pj",
    p_billing: "fixed_recurring",
  });
  const revision = JSON.parse(
    sql(`SELECT row_to_json(j) FROM ats_jobs j WHERE id=${q(nextJob.id)}`),
  ).hiring_revision;
  const request = await rpc("operator", "hiring_demand_request", {
    p_ws: W,
    p_job: nextJob.id,
    p_revision: revision,
  });
  for (const u of ["manager", "ceo"])
    await rpc(u, "hiring_demand_decide", {
      p_ws: W,
      p_request: request,
      p_decision: "approved",
      p_note: "[STAGE7] reuse professional approved",
    });
  const application = await insert("ats_applications", {
    workspace_id: W,
    owner_id: O,
    candidate_id: candidate.id,
    job_id: nextJob.id,
    status: "active",
    stage_value: "applied",
  });
  await update("ats_applications", application.id, {
    stage_value: "hired",
    status: "hired",
    hiring_details: {
      model: "outsourcing",
      employment_type: "pj",
      start_date: "2027-01-01",
      monthly_amount: 5000,
      role_title: "Developer",
    },
  });
  const next = await rpc("operator", "hiring_employment_admit", {
    ...args,
    p_application: application.id,
    p_person: person,
    p_start: "2027-01-01",
    p_end: "2027-06-30",
    p_reason: "[STAGE7] reuse with next nonoverlapping period",
  });
  assert.equal(
    await rpc("operator", "hiring_employment_contract", {
      w: W,
      p_engagement: next,
      p_contract: purchase,
      p_options: {},
    }),
    purchase,
  );
  await rpc("operator", "hiring_allocate", {
    w: W,
    p_engagement: next,
    p_project: delivery.results[0].project_id,
    p_start: "2027-01-01",
    p_end: "2027-06-30",
    p_pct: 100,
    p_reason: "[STAGE7] nonoverlapping reuse",
  });
  assert.equal(sql(`SELECT count(*) FROM people WHERE workspace_id=${q(W)}`), before);
});
await test("workflow resumes after a failed step without duplicating completed hiring records", async () => {
  const personBefore = sql(`SELECT count(*) FROM people WHERE workspace_id=${q(W)}`);
  const invoke = async (step, payload) => {
    const r = await admin.rpc("hiring_workflow_employment", {
      w: W,
      p_application: app.id,
      p_actor: O,
      p_step: step,
      p_payload: payload,
    });
    if (r.error) throw Error(r.error.message);
    return r.data;
  };
  const person = await invoke("create_person_from_candidate", {});
  assert.equal(person.engagement_id, employment);
  await assert.rejects(() =>
    invoke("create_allocation", {
      project_id: randomUUID(),
      starts_at: "2026-10-01",
      ends_at: "2026-12-31",
      reason: "[STAGE7] injected invalid project step",
    }),
  );
  const retry = await invoke("create_person_from_candidate", {});
  assert.equal(retry.person_id, person.person_id);
  const linked = await invoke("create_contract_document", {});
  assert.equal(linked.id, purchase);
  await invoke("create_allocation", {
    project_id: delivery.results[0].project_id,
    starts_at: "2026-10-01",
    ends_at: "2026-12-31",
    allocation_pct: 100,
    reason: "[STAGE7] retry valid allocation",
  });
  assert.equal(sql(`SELECT count(*) FROM people WHERE workspace_id=${q(W)}`), personBefore);
  assert.equal(
    sql(`SELECT count(*) FROM people_allocations WHERE hiring_engagement_id=${q(employment)}`),
    "1",
  );
  const denied = await users.operator.client.rpc("hiring_workflow_employment", {
    w: W,
    p_application: app.id,
    p_actor: O,
    p_step: "create_person_from_candidate",
    p_payload: {},
  });
  assert.ok(denied.error);
  assert.equal(denied.error.code, "42501");
});
await test("fixed contractual revenue is provisioned then billed only after segregated approval", async () => {
  const cfg = randomUUID();
  // Historical October configuration fixture, not a backdated business mutation.
  sql(`BEGIN;${guard} SELECT set_config('request.jwt.claim.sub',${q(O)},true),set_config('request.jwt.claim.role','authenticated',true);
 SELECT set_config('app.project_billing_flow','on',true);
 INSERT INTO project_billing_configs(id,workspace_id,contract_id,model,currency,params,valid_from,reason,created_by) VALUES(${q(cfg)},${q(W)},${q(contract.id)},'fixed_recurring','BRL','{"amount_source":"contract_monthly"}','2026-10-01','[STAGE7] historical configuration fixture',${q(O)});COMMIT;`);
  const pv = await rpc("operator", "hiring_provision_preview", {
    w: W,
    p_cfg: cfg,
    p_month: "2026-10-01",
    p_tz: "America/Sao_Paulo",
  });
  assert.equal(Number(pv.totals.eligible_revenue), 10000);
  const before = Number(sql(`SELECT count(*) FROM financial_entries WHERE workspace_id=${q(W)}`));
  await rpc("operator", "hiring_provision_close", {
    w: W,
    p_cfg: cfg,
    p_month: "2026-10-01",
    p_hash: pv.hash,
    p_previous: null,
    p_reason: "[STAGE7] revenue close without invoice",
    p_tz: "America/Sao_Paulo",
  });
  assert.equal(
    Number(sql(`SELECT count(*) FROM financial_entries WHERE workspace_id=${q(W)}`)),
    before,
  );
  const measurement = await rpc("operator", "project_measurement_build", {
    p_cfg: cfg,
    p_month: "2026-10-01",
    p_kind: "regular",
    p_tz: "America/Sao_Paulo",
  });
  const hash = sql(`SELECT lines_hash FROM project_measurements WHERE id=${q(measurement)}`);
  await rpc("operator", "project_measurement_submit", { p_id: measurement, p_hash: hash });
  await assert.rejects(() =>
    rpc("operator", "project_measurement_approve", { p_id: measurement, p_hash: hash }),
  );
  await rpc("manager", "project_measurement_approve", { p_id: measurement, p_hash: hash });
  const args = { p_id: measurement, p_hash: hash, p_due: "2026-11-30" };
  const [a, b] = await Promise.all([
    rpc("operator", "project_measurement_generate", args),
    rpc("operator", "project_measurement_generate", args),
  ]);
  assert.equal(a.status, "generated");
  assert.equal(a.financial_entry_id, b.financial_entry_id);
  assert.equal(
    Number(sql(`SELECT count(*) FROM financial_entries WHERE workspace_id=${q(W)}`)),
    before + 1,
  );
  const title = JSON.parse(
    sql(`SELECT row_to_json(f) FROM financial_entries f WHERE id=${q(a.financial_entry_id)}`),
  );
  assert.equal(title.legal_entity_id, ids.entity);
  assert.equal(Number(title.amount), 10000);
});
writeFileSync(
  out + "/client-results.json",
  JSON.stringify(
    {
      runId,
      workspaceId: W,
      results,
      complete: false,
      stage: "signed-client-admission-allocation",
      client: {
        deal: deal.id,
        contract: contract.id,
        project: delivery.results[0].project_id,
        employment,
        purchase,
      },
    },
    null,
    2,
  ),
);
console.log("Client chain passed; extended billing/UI acceptance remains.");
process.exitCode = 3;
