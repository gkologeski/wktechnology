import { budgets } from "../../src/lib/performance/budgets.ts";
// Local-only concurrent exercise of real PostgREST/RPCs; never calls an outbound provider.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const root = resolve(repo, ".techerp-isolated.local");
if (readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-empty-local-v1")
  throw Error("Local marker required");
const status = JSON.parse(readFileSync(root + "/status.private.json", "utf8"));
if (status.API_URL !== "http://127.0.0.1:54321") throw Error("Local endpoint required");
const sql = (query) =>
  execFileSync(
    "/Applications/Docker.app/Contents/Resources/bin/docker",
    [
      "exec",
      "-i",
      "supabase_db_techerp-isolated.local",
      "psql",
      "-X",
      "-qtA",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: query,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DOCKER_HOST: `unix://${process.env.HOME}/.docker/run/docker.sock`,
      },
      timeout: 30000,
    },
  ).trim();
sql(
  `DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness') OR EXISTS(SELECT 1 FROM pg_extension WHERE extname IN('pg_net','pg_cron','http')) THEN RAISE EXCEPTION 'Unsafe environment'; END IF; END $$`,
);
const { createClient } = await import(
  resolve(root, "node_modules/@supabase/supabase-js/dist/index.mjs")
);
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const WA = "aaaaaaaa-0000-4000-8000-00000000000a",
  U1 = "10000000-0000-4000-8000-000000000001";
const playbook = randomUUID(),
  campaign = randomUUID(),
  convs = Array.from({ length: 10 }, () => randomUUID()),
  enrolls = convs.map(() => randomUUID()),
  jobs = convs.flatMap(() => Array.from({ length: 3 }, () => randomUUID()));
const results = [];
const assert = (ok, reason) => {
  if (!ok) throw Error(reason);
};
const rpc = async (name, args) => {
  const r = await admin.rpc(name, args);
  if (r.error) throw Error(`${name}: ${r.error.message}`);
  return r.data;
};
const check = async (name, fn) => {
  const start = performance.now();
  try {
    const detail = await fn();
    results.push({ name, passed: true, duration_ms: performance.now() - start, detail });
  } catch (e) {
    results.push({ name, passed: false, duration_ms: performance.now() - start, error: e.message });
  }
};
try {
  sql(`INSERT INTO public.sdr_playbooks(id,workspace_id,owner_id,name,enabled) VALUES('${playbook}','${WA}','${U1}','[ISO] load14',false);
    INSERT INTO public.whatsapp_campaigns(id,workspace_id,owner_id,name) VALUES('${campaign}','${WA}','${U1}','[ISO] load14');`);
  for (let i = 0; i < convs.length; i++)
    sql(`INSERT INTO public.whatsapp_conversations(id,workspace_id,owner_id,contact_phone,twilio_number,ai_owner,ai_version) VALUES('${convs[i]}','${WA}','${U1}','+550000014${String(i).padStart(4, "0")}','+5500000000999','ai',1);
    INSERT INTO public.sdr_enrollments(id,workspace_id,owner_id,playbook_id,conversation_id,status) VALUES('${enrolls[i]}','${WA}','${U1}','${playbook}','${convs[i]}','active');`);
  for (let i = 0; i < jobs.length; i++) {
    const j = Math.floor(i / 3);
    sql(
      `INSERT INTO public.sdr_turn_jobs(id,workspace_id,enrollment_id,conversation_id,conversation_version,idem_key,kind) VALUES('${jobs[i]}','${WA}','${enrolls[j]}','${convs[j]}',1,'load14-${jobs[i]}','follow_up')`,
    );
  }
  await check("campaign-20-concurrent-leases", async () => {
    const values = await Promise.all(
      Array.from({ length: 20 }, () =>
        rpc("wa_campaign_claim_dispatch", { p_campaign: campaign, p_seconds: 300 }),
      ),
    );
    assert(values.filter(Boolean).length === 1, "Campaign claimed twice");
    return { calls: 20, winners: 1 };
  });
  let claimed = [];
  await check("queue-12-workers-one-per-conversation", async () => {
    const batches = await Promise.all(
      Array.from({ length: 12 }, () =>
        rpc("sdr_claim_jobs", { p_limit: 50, p_lease_seconds: 300 }),
      ),
    );
    claimed = batches.flat().filter((j) => jobs.includes(j.id));
    assert(
      claimed.length === 10 &&
        new Set(claimed.map((j) => j.conversation_id)).size === 10 &&
        new Set(claimed.map((j) => j.id)).size === 10,
      "Duplicate or missing claims",
    );
    return { workers: 12, claimed: 10, queued: 20 };
  });
  await check("followup-quota-concurrent-atomic", async () => {
    assert(claimed.length === 10, "Missing claims");
    const responses = await Promise.all(
      claimed.map((j) =>
        rpc("sdr_reserve_followup_quota", { p_job: j.id, p_lease: j.lease_token, p_limit: 3 }),
      ),
    );
    assert(
      responses.filter((r) => r.result === "ok").length === 3 &&
        responses.filter((r) => r.result === "followup_quota").length === 7,
      "Quota exceeded or unexpected outcome",
    );
    return { allowed: 3, blocked: 7 };
  });
  await check("idem-key-duplicate-rejected", async () => {
    const j = claimed[0];
    const r = await admin.from("sdr_turn_jobs").insert({
      workspace_id: WA,
      enrollment_id: j.enrollment_id,
      conversation_id: j.conversation_id,
      conversation_version: 1,
      idem_key: j.idem_key,
      kind: "follow_up",
    });
    assert(r.error?.code === "23505", "Duplicate key accepted");
    return "unique constraint";
  });
  await check("expired-lease-retry-and-stale-commit", async () => {
    const job = claimed[0];
    sql(
      `UPDATE public.sdr_turn_jobs SET lease_until=now()-interval '1 minute' WHERE id='${job.id}'`,
    );
    const retried = (await rpc("sdr_claim_jobs", { p_limit: 50, p_lease_seconds: 300 })).find(
      (j) => j.id === job.id,
    );
    assert(
      retried && retried.attempts === 2 && retried.lease_token !== job.lease_token,
      "Retry did not renew lease",
    );
    const commit = await rpc("sdr_commit_turn", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_evidence: [],
      p_qualification: null,
      p_enrollment: { commercial_stage: "invalid" },
      p_job_patch: { status: "sent" },
    });
    assert(commit === "lease_lost", "Stale writer accepted");
    const read = await admin
      .from("sdr_turn_jobs")
      .select("status,lease_token")
      .eq("id", job.id)
      .single();
    assert(
      read.data.status === "running" && read.data.lease_token === retried.lease_token,
      "Stale commit modified job",
    );
    return { renewed: true, stale_rejected: true };
  });
  await check("retry-limit-three", async () => {
    const job = claimed[1];
    sql(
      `UPDATE public.sdr_turn_jobs SET attempts=3,lease_until=now()-interval '1 minute' WHERE id='${job.id}'`,
    );
    const list = await rpc("sdr_claim_jobs", { p_limit: 50, p_lease_seconds: 300 });
    assert(!list.some((j) => j.id === job.id), "Retry limit exceeded");
    return "blocked";
  });
  await check("64-concurrent-authenticated-reads", async () => {
    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: "own-a@techerp-test.invalid",
    });
    if (link.error) throw link.error;
    const user = createClient(status.API_URL, status.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await user.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: "magiclink",
    });
    if (login.error) throw login.error;
    try {
      const samples = await Promise.all(
        Array.from({ length: 64 }, async () => {
          const start = performance.now();
          const r = await user.from("leads").select("id,workspace_id").limit(50);
          assert(
            !r.error && r.data.length > 0 && r.data.every((v) => v.workspace_id === WA),
            "Read failed or tenant leak",
          );
          return performance.now() - start;
        }),
      );
      samples.sort((a, b) => a - b);
      assert(samples[60] <= budgets.local_read_p95_ms, "Local read p95 budget exceeded");
      return {
        budget_p95_ms: budgets.local_read_p95_ms,
        concurrency: 64,
        p50_ms: samples[31],
        p95_ms: samples[60],
        max_ms: samples[63],
      };
    } finally {
      await user.auth.signOut();
    }
  });
} catch (e) {
  results.push({ name: "fixture-or-runtime", passed: false, error: e.message });
} finally {
  sql(
    `DELETE FROM public.sdr_actions WHERE job_id IN (${jobs.map((id) => `'${id}'`).join(",")});DELETE FROM public.sdr_turn_jobs WHERE id IN (${jobs.map((id) => `'${id}'`).join(",")});DELETE FROM public.sdr_enrollments WHERE id IN (${enrolls.map((id) => `'${id}'`).join(",")});DELETE FROM public.whatsapp_conversations WHERE id IN (${convs.map((id) => `'${id}'`).join(",")});DELETE FROM public.sdr_playbooks WHERE id='${playbook}';DELETE FROM public.whatsapp_campaigns WHERE id='${campaign}';`,
  );
  const report = {
    complete: results.length >= 7 && results.every((r) => r.passed),
    scope: "local synthetic, no external provider invoked",
    pass: results.filter((r) => r.passed).length,
    fail: results.filter((r) => !r.passed).length,
    results,
  };
  writeFileSync(root + "/artifacts/cycle14-load.json", JSON.stringify(report, null, 2));
  console.log(`${report.pass} approved; ${report.fail} failed`);
  if (report.fail) process.exitCode = 1;
}
