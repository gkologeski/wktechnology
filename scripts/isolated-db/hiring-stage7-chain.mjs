// Run the authenticated stage-7 scenarios in a marker-guarded local stack only.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
process.env.STAGE7_CHAIN = "1";
const {
  sql,
  q,
  guard,
  out,
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
  test,
  engagement,
  purchase,
  project,
  allocation,
} = await import("./hiring-stage7.mjs");
const deniedRole = randomUUID(),
  allowSet = randomUUID();
// Trusted synthetic role/catalog setup. Every assertion below uses its own GoTrue JWT.
sql(`BEGIN;${guard} SELECT set_config('request.jwt.claim.sub',${q(O)},true),set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO job_roles(id,workspace_id,owner_id,name) VALUES(${q(deniedRole)},${q(W)},${q(O)},'[STAGE7] explicit deny');
INSERT INTO user_job_roles(user_id,owner_id,role_id,is_primary,workspace_id) VALUES(${q(users.denied.id)},${q(O)},${q(deniedRole)},true,${q(W)});
INSERT INTO permission_sets(id,owner_id,workspace_id,module,name) VALUES(${q(allowSet)},${q(O)},${q(W)},'techpeople','[STAGE7] allow plus deny');
INSERT INTO permission_set_items(set_id,permission_key) VALUES(${q(allowSet)},'techpeople.lifecycle.manage.workspace'),(${q(allowSet)},'techpeople.lifecycle.view.workspace');
INSERT INTO user_permission_sets(user_id,owner_id,set_id,workspace_id) VALUES(${q(users.denied.id)},${q(O)},${q(allowSet)},${q(W)});
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) VALUES(${q(W)},${q(deniedRole)},'techpeople.lifecycle.manage.workspace','deny',${q(O)});COMMIT;`);
const payload = {
  allocation,
  date: "2027-06-30",
  reason: "[STAGE7] isolated end-allocation acceptance",
};
let snapshot;
await test("real JWT lifecycle allowed active operator", async () => {
  snapshot = await rpc("operator", "hiring_lifecycle_preview", {
    w: W,
    eid: engagement,
    k: "end_allocation",
    p: payload,
  });
  assert.equal(snapshot.engagement.id, engagement);
});
for (const [u, label] of [
  ["missing", "missing permission"],
  ["denied", "explicit deny despite allow"],
  ["foreign", "foreign tenant"],
  ["inactive", "inactive membership"],
]) {
  await test("real JWT lifecycle rejects " + label, async () => {
    const r = await users[u].client.rpc("hiring_lifecycle_preview", {
      w: W,
      eid: engagement,
      k: "end_allocation",
      p: payload,
    });
    assert.ok(r.error);
    assert.equal(r.error.code, "42501");
  });
}
await test("specific invitation assigns only the selected job role", async () => {
  const roles = JSON.parse(
    sql(
      `SELECT coalesce(json_agg(role_id),'[]') FROM user_job_roles WHERE user_id=${q(users.worker.id)} AND workspace_id=${q(W)}`,
    ),
  );
  assert.deepEqual(roles, []);
  const grants = JSON.parse(
    sql(
      `SELECT json_agg(json_build_object('role',v.role_id,'set',g.set_id)) FROM hiring_access_grants g JOIN hiring_engagements e ON e.id=g.engagement_id JOIN hiring_access_model_versions v ON v.id=e.model_version_id WHERE g.engagement_id=${q(engagement)} AND g.revoked_at IS NULL`,
    ),
  );
  assert.equal(grants.length, 1);
  assert.equal(grants[0].role, ids.role);
});
const task = await insert("project_tasks", {
  workspace_id: W,
  project_id: project.id,
  title: "[STAGE7] authenticated time entry",
  assignee_id: users.worker.id,
});
let entry;
await test("allocated worker records time through checked API", async () => {
  entry = await rpc("worker", "project_time_entry_insert_checked", {
    p_ws: W,
    p_payload: {
      project_id: project.id,
      task_id: task.id,
      entry_date: "2026-10-20",
      mode: "interval",
      start_time: "09:00",
      end_time: "10:00",
      timezone: "America/Sao_Paulo",
      description: "[STAGE7] isolated work",
      billable: true,
    },
    p_source: "manual",
  });
  assert.equal(entry.duration_seconds, 3600);
});
await test("worker cannot create time in another workspace", async () => {
  const r = await users.worker.client.rpc("project_time_entry_insert_checked", {
    p_ws: B,
    p_payload: {
      project_id: project.id,
      task_id: task.id,
      entry_date: "2026-10-20",
      mode: "duration",
      duration_seconds: 3600,
    },
    p_source: "manual",
  });
  assert.ok(r.error);
  assert.equal(r.error.code, "42501");
});
await test("monthly cost provision closes prior month without creating a payable", async () => {
  const person = JSON.parse(
    sql(`SELECT row_to_json(e) FROM hiring_engagements e WHERE id=${q(engagement)}`),
  ).person_id;
  await rpc("operator", "project_rate_create", {
    p_ws: W,
    p_kind: "cost",
    p_scope: "person",
    p_target: { person_id: person },
    p_unit: "month",
    p_proration: "full_month",
    p_currency: "BRL",
    p_amount: 5000,
    p_from: "2026-10-01",
    p_to: null,
    p_reason: "[STAGE7] reviewed synthetic monthly cost",
    p_confirm_retroactive: true,
  });
  const before = Number(sql(`SELECT count(*) FROM financial_entries WHERE workspace_id=${q(W)}`));
  const preview = await rpc("operator", "hiring_provision_preview", {
    w: W,
    p_cfg: purchase,
    p_month: "2026-10-01",
    p_tz: "America/Sao_Paulo",
  });
  assert.equal(preview.kind, "cost");
  assert.equal(Number(preview.totals.known_estimated_cost), 5000);
  const args = {
    w: W,
    p_cfg: purchase,
    p_month: "2026-10-01",
    p_hash: preview.hash,
    p_previous: null,
    p_reason: "[STAGE7] isolated monthly close",
    p_tz: "America/Sao_Paulo",
  };
  const close = await rpc("operator", "hiring_provision_close", args);
  assert.ok(close);
  assert.equal(
    Number(sql(`SELECT count(*) FROM financial_entries WHERE workspace_id=${q(W)}`)),
    before,
  );
  await assert.rejects(
    () => rpc("operator", "hiring_provision_close", { ...args, p_month: "2026-11-01" }),
    /mês encerrado/,
  );
});
const request = randomUUID();
await test("lifecycle request retries have one effect and two sequential approvals", async () => {
  const args = {
    w: W,
    eid: engagement,
    k: "end_allocation",
    p: payload,
    expected: snapshot,
    request_id: request,
  };
  const a = await rpc("operator", "hiring_lifecycle_request", args);
  assert.equal(await rpc("operator", "hiring_lifecycle_request", args), a);
  await assert.rejects(() =>
    rpc("ceo", "hiring_lifecycle_decide", {
      w: W,
      req: request,
      accept: true,
      reason: "[STAGE7] premature CEO",
    }),
  );
  await rpc("manager", "hiring_lifecycle_decide", {
    w: W,
    req: request,
    accept: true,
    reason: "[STAGE7] manager accepted",
  });
  await rpc("ceo", "hiring_lifecycle_decide", {
    w: W,
    req: request,
    accept: true,
    reason: "[STAGE7] CEO accepted",
  });
  const applied = await rpc("operator", "hiring_lifecycle_apply", { w: W, req: request });
  assert.deepEqual(
    await rpc("operator", "hiring_lifecycle_apply", { w: W, req: request }),
    applied,
  );
  const count = sql(`SELECT count(*) FROM project_time_entries WHERE id=${q(entry.id)}`);
  assert.equal(count, "1");
});
writeFileSync(
  out + "/results.json",
  JSON.stringify(
    {
      runId,
      workspaceId: W,
      results,
      complete: false,
      stage: "internal-permissions-time-lifecycle",
    },
    null,
    2,
  ),
);
console.log(
  "Internal authenticated chain passed; client/finance and UI acceptance still required.",
);
process.exitCode = 3;
