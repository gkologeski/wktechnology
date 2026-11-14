import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Real PostgreSQL/RLS with production resolvers, isolated from all configured URLs.
// Claims are a SQL fixture, not a GoTrue login; real-JWT acceptance remains separate.
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-handoffs-ci-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000002",
  O = "10000000-0000-4000-8000-000000000001",
  P = "10000000-0000-4000-8000-000000000003";
const R = "30000000-0000-4000-8000-0000000000a8";
const IDs = [
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
  "50000000-0000-4000-8000-000000000003",
];
const native = process.platform === "darwin" && process.env.TECHERP_NATIVE_PG === "1";
const pgBin = "/Applications/Postgres.app/Contents/Versions/16/bin/";
let nativeStarted = false;
let endpoint = "",
  temporary = "",
  started = false;
let db: ReturnType<typeof postgres>;
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function sourceFunction(file: string, name: string) {
  const source = readFileSync(file, "utf8"),
    start = source.indexOf(
      "CREATE OR REPLACE FUNCTION " + (name.includes(".") ? name : "public." + name) + "(",
    );
  if (start < 0) throw Error("Missing production function: " + name);
  const tail = source.slice(start),
    opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error("Missing SQL function body: " + name);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error("Incomplete SQL function: " + name);
  return tail.slice(0, end + opening[1].length) + ";";
}
beforeAll(async () => {
  if (native) {
    temporary = mkdtempSync(join(tmpdir(), "techerp-journey-pg-"));
    execFileSync(
      pgBin + "initdb",
      [
        "-D",
        join(temporary, "data"),
        "-U",
        "postgres",
        "--auth-local=trust",
        "--auth-host=reject",
        "--no-locale",
        "--encoding=UTF8",
      ],
      { stdio: "pipe", timeout: 30000 },
    );
    execFileSync(
      pgBin + "pg_ctl",
      [
        "-D",
        join(temporary, "data"),
        "-l",
        join(temporary, "postgres.log"),
        "-o",
        "-k " + temporary + " -h '' -F",
        "-w",
        "start",
      ],
      { stdio: "pipe", timeout: 30000 },
    );
    nativeStarted = true;
    db = postgres({
      host: temporary,
      port: 5432,
      database: "postgres",
      username: "postgres",
      max: 1,
      connect_timeout: 1,
      onnotice: () => {},
    });
  } else {
    if (process.platform === "darwin" && !existsSync(docker))
      throw Error("Docker Desktop is required for mandatory SQL permission tests.");
    endpoint = execFileSync(
      docker,
      ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
      { encoding: "utf8", timeout: 10000 },
    ).trim();
    if (!endpoint.startsWith("unix://")) throw Error("Only a local Unix Docker socket is allowed.");
    temporary = mkdtempSync(join(tmpdir(), "techerp-permission-ci-"));
    const password = randomUUID() + randomUUID(),
      envFile = join(temporary, "postgres.env");
    writeFileSync(
      envFile,
      "POSTGRES_DB=techerp_permission_ci\nPOSTGRES_PASSWORD=" + password + "\n",
      { mode: 0o600 },
    );
    dockerRun(
      "run",
      "-d",
      "--rm",
      "--name",
      container,
      "--env-file",
      envFile,
      "-p",
      "127.0.0.1::5432",
      image,
      "-c",
      "fsync=off",
    );
    started = true;
    const mapped = dockerRun("port", container, "5432/tcp");
    if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw Error("Unexpected disposable DB binding");
    db = postgres({
      host: "127.0.0.1",
      port: Number(mapped.split(":")[1]),
      database: "techerp_permission_ci",
      username: "postgres",
      password,
      max: 1,
      connect_timeout: 1,
      onnotice: () => {},
    });
  }
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await db`select 1`;
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!ready) throw Error("Disposable PostgreSQL did not become ready");
  await db.unsafe(readFileSync("tests/fixtures/contract-handoffs.sql", "utf8"));
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0312_contract_draft_legal_review.sql",
      "contract_draft_is_approver",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0312_contract_draft_legal_review.sql",
      "contract_draft_open",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0218_order3_completion_prepare.sql",
      "contract_approval_start",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0218_order3_completion_prepare.sql",
      "contract_approval_decide",
    ),
  );
  await db.unsafe(
    sourceFunction("drizzle/migrations/0223_order4_sales_activate.sql", "sales_row_guard"),
  );
  await db.unsafe(
    'CREATE TRIGGER zzzz_sales_structure BEFORE INSERT OR UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION sales_row_guard(\'[{"column":"related_deal_id","table":"deals","reference":"id"}]\');',
  );
  await db.unsafe(readFileSync("drizzle/migrations/0362_contract_handoffs.sql", "utf8"));
  await db.unsafe(
    readFileSync("drizzle/migrations/0363_contract_handoff_terminal_state.sql", "utf8"),
  );
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", container);
  if (nativeStarted)
    execFileSync(pgBin + "pg_ctl", ["-D", join(temporary, "data"), "-m", "fast", "-w", "stop"], {
      stdio: "pipe",
      timeout: 15000,
    });
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});
const L = "10000000-0000-4000-8000-000000000004",
  F = "10000000-0000-4000-8000-000000000005";
const deal = "60000000-0000-4000-8000-000000000001",
  proposal = "60000000-0000-4000-8000-000000000002",
  contract = "60000000-0000-4000-8000-000000000003";
const needed = [
  "techcontracts.handoffs.manage.workspace",
  "techcontracts.contract_drafts.create.workspace",
  "techcontracts.contract_drafts.view.workspace",
  "techcontracts.contract_drafts.approve.workspace",
  "techcontracts.approvals.view.workspace",
  "techcontracts.approvals.manage.workspace",
  "techcontracts.approvals.approve.workspace",
  "techcontracts.contracts.view.workspace",
  "techcontracts.contracts.update.workspace",
  "techcontracts.contracts.create.workspace",
  "techcontracts.signature_evidence.view.workspace",
  "techcontracts.signature_evidence.manage.workspace",
  "techcontracts.esign.view.workspace",
  "techcontracts.esign.manage.workspace",
  "techcontracts.esign.create.own",
  "techcontracts.esign_send.manage.workspace",
  "techsales.deals.view.workspace",
  "techsales.proposals.view.workspace",
  "techsales.tasks.view.workspace",
  "techsales.tasks.create.workspace",
  "techsales.tasks.assign.workspace",
  "techsales.tasks.update.workspace",
];
const config = () => ({
  enabled: true,
  legal_user_id: L,
  finance_user_id: F,
  signature_user_id: F,
  escalation_user_id: U,
  operator_user_id: U,
  legal_days: 1,
  finance_days: 1,
  signature_days: 1,
  timezone: "America/Sao_Paulo",
});
async function asUser(u = U) {
  await db`select set_config('request.uid',${u},false),set_config('request.role','authenticated',false),set_config('request.readonly','false',false)`;
}
async function reset() {
  const tables = await db`select tablename from pg_tables where schemaname='public'`;
  await db.unsafe(
    "TRUNCATE " + tables.map((t) => 'public."' + t.tablename + '"').join(",") + " CASCADE",
  );
  await db`insert into workspaces values(${W}),(${B})`;
  for (const u of [U, L, F, P]) {
    await db`insert into profiles values(${u},${W},${u === L ? "Legal" : u === F ? "Financeiro" : "Operador"})`;
    await db`insert into workspace_members values(${W},${u},'active',${u === F ? "member" : "admin"})`;
    for (const k of needed) await db`insert into grants values(${u},${W},${k},'grant')`;
  }
  await db`insert into contract_draft_approvers values(${W},${L})`;
  await db`insert into deals values(${deal},${W},null)`;
  // sales catalog is a fixture of production guard metadata, not a permission grant.
  await db`insert into sales_resource_catalog values('activities','techsales.activities',ARRAY['assigned_to','owner_id'],null,null)`;
  await asUser();
  await db`select contract_handoff_settings_save(${db.json(config())})`;
}
async function acceptProposal(at = new Date().toISOString()) {
  await db`insert into proposals(id,workspace_id,deal_id,title,status,locked,decided_at) values(${proposal},${W},${deal},'Proposta fixture','accepted',true,${at})`;
}
async function tick() {
  await db`select set_config('request.uid','',false),set_config('request.role','service_role',false)`;
  const r = (await db`select contract_handoff_tick(30) v`)[0].v;
  await asUser();
  return r;
}
async function ready() {
  await db`update contract_handoffs set next_check_at=now()`;
  return tick();
}
async function draft() {
  return (
    await db`select id from contract_drafts where proposal_id=${proposal} order by created_at desc limit 1`
  )[0].id as string;
}
async function acceptDraft() {
  const d = await draft();
  await db`update contract_drafts set status='accepted',client_decided_at=now(),revision=revision+1 where id=${d}`;
  return d;
}
async function createAndApprove() {
  await db`insert into contracts(id,workspace_id,owner_id,title,proposal_id,deal_id) values(${contract},${W},${F},'Contrato fixture',${proposal},${deal})`;
  await asUser(F);
  await db`select contract_approval_start(${contract})`;
  const chain =
    await db`select id,stage,approver_id from contract_approvals where contract_id=${contract} order by sort_order`;
  expect(chain.map((a) => a.approver_id)).toEqual([L, F]);
  await asUser(L);
  await db`select contract_approval_decide(${chain[0].id},'approved')`;
  await asUser(F);
  await db`select contract_approval_decide(${chain[1].id},'approved')`;
  await asUser();
}
it("handoff allows authorized active configuration", async () => {
  await reset();
  expect((await db`select enabled from contract_handoff_settings`)[0].enabled).toBe(true);
});
it("handoff rejects missing permission", async () => {
  await reset();
  await db`delete from grants where user_id=${U} and key='techcontracts.handoffs.manage.workspace'`;
  await expect(db`select contract_handoff_settings_save(${db.json(config())})`).rejects.toThrow(
    "Sem permissão",
  );
});
it("handoff rejects explicit deny", async () => {
  await reset();
  await db`insert into grants values(${U},${W},'techcontracts.handoffs.manage.workspace','deny')`;
  await expect(db`select contract_handoff_settings_get()`).rejects.toThrow("Sem permissão");
});
it("handoff rejects foreign workspace", async () => {
  await reset();
  await db`insert into profiles values(${O},${B},'Fora')`;
  await db`insert into workspace_members values(${B},${O},'active','admin')`;
  await expect(
    db`select contract_handoff_settings_save(${db.json({ ...config(), legal_user_id: O })})`,
  ).rejects.toThrow("outro workspace");
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await expect(db`select contract_handoff_reconcile(${deal})`).rejects.toThrow();
});
it("handoff rejects inactive membership", async () => {
  await reset();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(db`select contract_handoff_settings_get()`).rejects.toThrow("Sem permissão");
});
it("accepted proposal creates one draft, assigned task and notification despite retries", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await db`update proposals set status='accepted' where id=${proposal}`;
  await ready();
  expect((await db`select count(*)::int n from contract_drafts`)[0].n).toBe(1);
  const tasks = await db`select * from activities`;
  expect(tasks).toHaveLength(1);
  expect(tasks[0].assigned_to).toBe(L);
  expect(tasks[0].related_deal_id).toBe(deal);
  expect(tasks[0].wa_reminders_disabled).toBe(true);
  expect(
    (
      await db`select count(*)::int n from notifications where dedupe_key like 'contract_handoff:%:ready:%'`
    )[0].n,
  ).toBe(1);
});
it("proposal without verifiable acceptance does not enqueue", async () => {
  await reset();
  await db`insert into proposals(id,workspace_id,deal_id,status,locked) values(${proposal},${W},${deal},'accepted',false)`;
  expect(await db`select id from contract_handoffs`).toHaveLength(0);
});
it("accepted draft reaches Finance and approved contract reaches signature owner", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await acceptDraft();
  await ready();
  expect((await db`select status from contract_handoffs where step='legal'`)[0].status).toBe(
    "done",
  );
  expect(
    (await db`select assignee_id,status from contract_handoffs where step='finance'`)[0],
  ).toMatchObject({ assignee_id: F, status: "pending" });
  await createAndApprove();
  await ready();
  expect((await db`select status from contract_handoffs where step='finance'`)[0].status).toBe(
    "done",
  );
  expect(
    (await db`select assignee_id,status from contract_handoffs where step='signature'`)[0],
  ).toMatchObject({ assignee_id: F, status: "pending" });
  expect(await db`select id from activities`).toHaveLength(3);
  await db`select contract_handoff_reconcile(${deal})`;
  await ready();
  expect(await db`select id from activities`).toHaveLength(3);
});
it("task cannot replace the actual action or change its responsible or deadline", async () => {
  await reset();
  await acceptProposal();
  await tick();
  const a = (await db`select id from activities`)[0].id;
  for (const sql of [
    "update activities set completed=true where id='" + a + "'",
    "update activities set task_status='COMPLETED' where id='" + a + "'",
    "update activities set due_date=now() where id='" + a + "'",
    "delete from activities where id='" + a + "'",
  ])
    await expect(
      db.begin(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE authenticated");
        await tx.unsafe(sql);
      }),
    ).rejects.toThrow();
  expect((await db`select status from contract_handoffs`)[0].status).toBe("pending");
});
it("inactive responsible blocks safely, escalates and can retry without duplicating task", async () => {
  await reset();
  await acceptProposal();
  await db`update workspace_members set status='inactive' where user_id=${L}`;
  await tick();
  let h = (await db`select * from contract_handoffs`)[0];
  expect(h.status).toBe("blocked");
  expect(h.assignee_id).toBe(U);
  expect(await db`select id from contract_drafts`).toHaveLength(0);
  expect(await db`select id from activities`).toHaveLength(1);
  await db`update workspace_members set status='active' where user_id=${L}`;
  await db`select contract_handoff_retry(${h.id})`;
  await tick();
  h = (await db`select * from contract_handoffs`)[0];
  expect(h.status).toBe("pending");
  expect((await db`select assigned_to from activities`)[0].assigned_to).toBe(L);
  expect(await db`select id from activities`).toHaveLength(1);
});
it("working-day SLA skips weekends and invalid bounds or timezone fail", async () => {
  await reset();
  expect(
    (
      await db`select contract_handoff_due('2026-11-13 18:00:00+00',1,'America/Sao_Paulo')='2026-11-16 18:00:00+00'::timestamptz v`
    )[0].v,
  ).toBe(true);
  expect(
    (
      await db`select contract_handoff_due('2026-11-14 18:00:00+00',1,'America/Sao_Paulo')='2026-11-16 18:00:00+00'::timestamptz v`
    )[0].v,
  ).toBe(true);
  await expect(db`select contract_handoff_due(now(),0,'America/Sao_Paulo')`).rejects.toThrow();
  await expect(db`select contract_handoff_due(now(),1,'invalid')`).rejects.toThrow();
});
it("overdue escalation notifies responsible and escalation once", async () => {
  await reset();
  await acceptProposal(new Date(Date.now() - 10 * 86400000).toISOString());
  await tick();
  expect(
    (await db`select count(*)::int n from notifications where dedupe_key like '%:overdue:%'`)[0].n,
  ).toBe(2);
  await ready();
  expect(
    (await db`select count(*)::int n from notifications where dedupe_key like '%:overdue:%'`)[0].n,
  ).toBe(2);
});
it("withdrawn source cancels its pending task without pretending approval", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await db`update proposals set status='declined' where id=${proposal}`;
  await ready();
  expect((await db`select status from contract_handoffs`)[0].status).toBe("canceled");
  expect((await db`select completed from activities`)[0].completed).toBe(true);
  expect(await db`select id from contracts`).toHaveLength(0);
});
it("incomplete approvals do not enqueue signature", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await db`insert into contracts(id,workspace_id,deal_id,status) values(${contract},${W},${deal},'awaiting_signature')`;
  expect(await db`select id from contract_handoffs where step='signature'`).toHaveLength(0);
});
it("native partial or failed invitation remains open until every pending signer was sent", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await acceptDraft();
  await createAndApprove();
  await ready();
  const doc = randomUUID(),
    s1 = randomUUID(),
    s2 = randomUUID();
  const hash = (await db`select hiring_contract_fingerprint(${contract}) v`)[0].v;
  await db`insert into esign_documents values(${doc},${W},'sent')`;
  await db`insert into esign_signers values(${s1},${W},${doc},'pending'),(${s2},${W},${doc},'pending')`;
  await db`insert into hiring_contract_evidence(workspace_id,contract_id,kind,document_id,contract_hash) values(${W},${contract},'native',${doc},${hash})`;
  await db`insert into contract_esign_deliveries(workspace_id,document_id,signer_id,status) values(${W},${doc},${s1},'accepted'),(${W},${doc},${s2},'failed')`;
  await ready();
  expect((await db`select status from contract_handoffs where step='signature'`)[0].status).toBe(
    "pending",
  );
  await db`update contract_esign_deliveries set status='accepted' where signer_id=${s2}`;
  await ready();
  expect((await db`select status from contract_handoffs where step='signature'`)[0].status).toBe(
    "done",
  );
});
it("ForSign requires an actual operation and current contract version", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await acceptDraft();
  await createAndApprove();
  await ready();
  await db`insert into contract_forsign_operations(workspace_id,contract_id,contract_hash,operation_id,status) values(${W},${contract},'stale',123,'sent')`;
  await ready();
  expect((await db`select status from contract_handoffs where step='signature'`)[0].status).toBe(
    "pending",
  );
  const hash = (await db`select hiring_contract_fingerprint(${contract}) v`)[0].v;
  await db`update contract_forsign_operations set contract_hash=${hash}`;
  await ready();
  expect((await db`select status from contract_handoffs where step='signature'`)[0].status).toBe(
    "done",
  );
});
it("readonly cannot change configuration or trigger real effects", async () => {
  await reset();
  await db`select set_config('request.readonly','true',false)`;
  await expect(db`select contract_handoff_settings_save(${db.json(config())})`).rejects.toThrow();
  await acceptProposal();
  expect(await db`select id from contract_handoffs`).toHaveLength(0);
});
it("authenticated cannot forge handoff states or invoke the service worker", async () => {
  await reset();
  await acceptProposal();
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx`update contract_handoffs set status='done'`;
    }),
  ).rejects.toThrow("permission denied");
  await expect(
    db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx`select contract_handoff_tick(10)`;
    }),
  ).rejects.toThrow("permission denied");
});

it("loss of permission after assignment escalates instead of silently continuing", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await db`insert into grants values(${L},${W},'techcontracts.contract_drafts.approve.workspace','deny')`;
  await ready();
  const h = (await db`select * from contract_handoffs`)[0];
  expect(h.status).toBe("blocked");
  expect(h.assignee_id).toBe(U);
  expect((await db`select assigned_to,completed from activities`)[0]).toMatchObject({
    assigned_to: U,
    completed: false,
  });
  await db`update proposals set status='declined' where id=${proposal}`;
  await ready();
  expect((await db`select status from contract_handoffs`)[0].status).toBe("canceled");
});
it("operator denial blocks draft creation and escalates only to another authorized admin", async () => {
  await reset();
  await acceptProposal();
  await db`insert into grants values(${U},${W},'techsales.tasks.assign.workspace','deny')`;
  await tick();
  const h = (await db`select * from contract_handoffs`)[0];
  expect(h.status).toBe("blocked");
  expect(h.assignee_id).not.toBe(U);
  expect(await db`select id from contract_drafts`).toHaveLength(0);
});
it("read RLS never exposes another active workspace queue", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await db`insert into workspace_members values(${B},${U},'active','admin')`;
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await db.begin(async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect((await tx`select count(*)::int n from contract_handoffs`)[0].n).toBe(0);
  });
});

it("internal approvals get sequential tasks and notifications for their actual approvers", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await acceptDraft();
  await ready();
  await db`insert into contracts(id,workspace_id,owner_id,title,proposal_id,deal_id) values(${contract},${W},${F},'Contrato fixture',${proposal},${deal})`;
  await asUser(F);
  await db`select contract_approval_start(${contract})`;
  await ready();
  expect(
    (await db`select assignee_id,status from contract_handoffs where step='approval_legal'`)[0],
  ).toMatchObject({ assignee_id: L, status: "pending" });
  expect(await db`select id from contract_handoffs where step='approval_finance'`).toHaveLength(0);
  const legal = (await db`select id from contract_approvals where stage='legal'`)[0].id;
  await asUser(L);
  await db`select contract_approval_decide(${legal},'approved')`;
  await ready();
  expect(
    (await db`select assignee_id,status from contract_handoffs where step='approval_finance'`)[0],
  ).toMatchObject({ assignee_id: F, status: "pending" });
  const fin = (await db`select id from contract_approvals where stage='finance'`)[0].id;
  await asUser(F);
  await db`select contract_approval_decide(${fin},'approved')`;
  await ready();
  expect((await db`select status from contract_handoffs where step='signature'`)[0].status).toBe(
    "pending",
  );
  expect(await db`select id from activities`).toHaveLength(5);
});

it("fully signed native evidence closes the send task even when links were shared manually", async () => {
  await reset();
  await acceptProposal();
  await tick();
  await acceptDraft();
  await createAndApprove();
  await ready();
  const doc = "80000000-0000-4000-8000-000000000001";
  const hash = (await db`select hiring_contract_fingerprint(${contract}) v`)[0].v;
  await db`insert into esign_documents values(${doc},${W},'completed')`;
  await db`insert into esign_signers values('80000000-0000-4000-8000-000000000002',${W},${doc},'signed')`;
  await db`insert into hiring_contract_evidence(workspace_id,contract_id,kind,document_id,contract_hash) values(${W},${contract},'native',${doc},${hash})`;
  await ready();
  expect((await db`select status from contract_handoffs where step='signature'`)[0].status).toBe(
    "done",
  );
  expect(
    (
      await db`select a.completed from activities a join contract_handoffs h on h.activity_id=a.id where h.step='signature'`
    )[0].completed,
  ).toBe(true);
});
it("soft-deleted business cancels its source-bound tasks without additional notifications", async () => {
  await reset();
  await acceptProposal();
  await tick();
  const count = (await db`select count(*)::int n from notifications`)[0].n;
  await db`update deals set deleted_at=now() where id=${deal}`;
  await ready();
  expect((await db`select status from contract_handoffs`)[0].status).toBe("canceled");
  expect((await db`select completed from activities`)[0].completed).toBe(true);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(count);
});
