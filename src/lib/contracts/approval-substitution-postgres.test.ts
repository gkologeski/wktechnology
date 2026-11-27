import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { disposablePostgresStorageArgs } from "../../../tests/fixtures/disposable-postgres-storage";

// Synthetic PostgreSQL authorization fixtures, never a configured/shared database.
// SQL role claims do not stand in for a browser login or a real approval.
const MIGRATION = "drizzle/migrations/0486_contract_approval_substitution.sql";
const PG = "/Applications/Postgres.app/Contents/Versions/16/bin/";
const useNative = process.platform === "darwin" && process.env.TECHERP_NATIVE_PG === "1";
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-approval-substitution-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000001";
const O = "10000000-0000-4000-8000-000000000002";
const R = "30000000-0000-4000-8000-000000000001";
const OR = "30000000-0000-4000-8000-000000000002";
const C = "40000000-0000-4000-8000-000000000001";
const OTHER = "40000000-0000-4000-8000-000000000002";
const LEGAL = "50000000-0000-4000-8000-000000000001";
const FINANCE = "50000000-0000-4000-8000-000000000002";
const GEN = "60000000-0000-4000-8000-000000000001";
const D = "70000000-0000-4000-8000-000000000001";
const HANDOFF = "80000000-0000-4000-8000-000000000001";
const ACTIVITY = "90000000-0000-4000-8000-000000000001";
const KEY = "techcontracts.approval_substitution.manage.workspace";
const KEYS = [
  KEY,
  "techcontracts.contracts.view.workspace",
  "techcontracts.contracts.update.workspace",
  "techcontracts.approvals.view.workspace",
  "techcontracts.approvals.manage.workspace",
  "techcontracts.approvals.approve.workspace",
];
const REASON = "Substituição autorizada pelo responsável, com conferência da etapa pendente.";
let db: ReturnType<typeof postgres>;
let temporary = "",
  endpoint = "",
  started = false,
  nativeStarted = false;
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function sourceFunction(file: string, name: string) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("CREATE OR REPLACE FUNCTION public." + name + "(");
  if (start < 0) throw Error("Missing production function: " + name);
  const tail = source.slice(start),
    opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error("Missing production body: " + name);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error("Incomplete production body: " + name);
  return tail.slice(0, end + opening[1].length) + ";";
}

beforeAll(async () => {
  temporary = mkdtempSync(join(tmpdir(), "techerp-approval-substitution-"));
  if (useNative) {
    execFileSync(
      PG + "initdb",
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
      PG + "pg_ctl",
      [
        "-D",
        join(temporary, "data"),
        "-l",
        join(temporary, "pg.log"),
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
      database: "postgres",
      username: "postgres",
      max: 3,
      connect_timeout: 1,
      onnotice: () => {},
    });
  } else {
    if (process.platform === "darwin" && !existsSync(docker))
      throw Error("Docker is required for PostgreSQL permission tests.");
    endpoint = execFileSync(
      docker,
      ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
      { encoding: "utf8", timeout: 10000 },
    ).trim();
    if (!endpoint.startsWith("unix://")) throw Error("Only local Unix Docker sockets are allowed.");
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
      ...disposablePostgresStorageArgs,
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
    if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw Error("Unexpected disposable PostgreSQL binding");
    db = postgres({
      host: "127.0.0.1",
      port: Number(mapped.split(":")[1]),
      database: "techerp_permission_ci",
      username: "postgres",
      password,
      max: 3,
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
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!ready) throw Error("Disposable PostgreSQL did not start");
  await db.unsafe(readFileSync("tests/fixtures/permission-postgres-ci.sql", "utf8"));
  for (const [file, name] of [
    ["drizzle/migrations/0031_workspace_members_status_inactive.sql", "is_workspace_member"],
    ["drizzle/migrations/0127_rbac_wk_vis_local_per_role.sql", "user_effective_permissions"],
    ["drizzle/migrations/0120_activities_team_scope_active_membership.sql", "my_team_member_pairs"],
    ["drizzle/migrations/0046_view_as_role_only_readonly.sql", "is_read_only_view"],
    ["drizzle/migrations/0216_work_core_prepare.sql", "work_access_context"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "work_action_prefix"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "work_context_access"],
  ])
    await db.unsafe(sourceFunction(file, name));
  await db.unsafe(`ALTER TABLE permissions ADD COLUMN label text,ADD COLUMN is_sensitive boolean;
    ALTER TABLE profiles ADD COLUMN full_name text;
    CREATE TYPE contract_status AS ENUM('draft','in_review','in_negotiation','awaiting_signature','active','renewing','ended','terminated');
    CREATE TYPE contract_approval_status AS ENUM('pending','approved','rejected');
    CREATE TYPE contract_approval_stage AS ENUM('legal','finance','purchasing');
    CREATE TABLE contracts(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,role text,status contract_status,title text);
    CREATE TABLE contract_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,assigned_to uuid,contract_id uuid,stage contract_approval_stage,sort_order integer,status contract_approval_status,approver_id uuid,comment text,decided_at timestamptz,decided_by uuid,generation uuid,superseded_at timestamptz);
    CREATE TABLE contract_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,contract_id uuid,actor_id uuid,event_type text,payload jsonb,created_at timestamptz DEFAULT now());
    CREATE TABLE activities(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,created_by uuid,type text,related_deal_id uuid,due_date timestamptz,completed boolean DEFAULT false,task_status text DEFAULT 'NOT_STARTED',deleted_at timestamptz);
    CREATE TABLE work_resource_catalog(resource text PRIMARY KEY,table_name name,responsible_columns text[],parent_column name,parent_resource text,shared boolean);
    INSERT INTO work_resource_catalog VALUES('techcontracts.contracts','contracts',ARRAY['assigned_to','owner_id'],NULL,NULL,false),('techcontracts.approvals','contract_approvals',ARRAY['approver_id','owner_id'],'contract_id','techcontracts.contracts',false);
    ALTER TABLE contracts ENABLE ROW LEVEL SECURITY; ALTER TABLE contract_approvals ENABLE ROW LEVEL SECURITY; ALTER TABLE contract_events ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON contracts,contract_approvals,contract_events TO authenticated;
    CREATE FUNCTION public.user_has_permission(_user_id uuid,_workspace_id uuid,_permission_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT EXISTS(SELECT 1 FROM public.user_effective_permissions(_user_id,_workspace_id) k WHERE k=_permission_key)$$;`);
  for (const name of [
    "work_record_context_access",
    "work_record_access",
    "work_area_authorize",
    "contract_approval_decide",
  ])
    await db.unsafe(sourceFunction("drizzle/migrations/0218_order3_completion_prepare.sql", name));
  await db.unsafe(`CREATE POLICY contract_view ON contracts FOR SELECT TO authenticated USING(work_record_access('techcontracts.contracts',id,'view'));
    CREATE POLICY approval_view ON contract_approvals FOR SELECT TO authenticated USING(work_record_access('techcontracts.approvals',id,'view'));
    CREATE POLICY event_view ON contract_events FOR SELECT TO authenticated USING(work_record_access('techcontracts.contracts',contract_id,'view'));
    REVOKE INSERT,UPDATE,DELETE ON contract_approvals,contract_events FROM authenticated;
    REVOKE ALL ON FUNCTION contract_approval_decide(uuid,text,text) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION contract_approval_decide(uuid,text,text) TO authenticated;`);
  const handoffSource = readFileSync("drizzle/migrations/0362_contract_handoffs.sql", "utf8");
  for (const name of ["contract_handoffs", "contract_handoff_events"]) {
    const start = handoffSource.indexOf(`CREATE TABLE public.${name}(`);
    if (start < 0) throw Error("Missing production handoff table: " + name);
    await db.unsafe(handoffSource.slice(start, handoffSource.indexOf(");", start) + 2));
  }
  await db.unsafe(
    sourceFunction("drizzle/migrations/0362_contract_handoffs.sql", "contract_handoff_task_guard"),
  );
  await db.unsafe(
    "CREATE TRIGGER handoff_task_guard BEFORE INSERT OR UPDATE OR DELETE ON activities FOR EACH ROW EXECUTE FUNCTION contract_handoff_task_guard();",
  );
  await db.unsafe(readFileSync(MIGRATION, "utf8"));
  await db`insert into workspaces(id) values(${W}),(${B})`;
  await db`insert into profiles(id,active_workspace_id,full_name) values(${U},${W},'Responsável substituto'),(${O},${W},'Responsável original')`;
  await db`insert into workspace_members(workspace_id,user_id) values(${W},${U}),(${W},${O}),(${B},${U})`;
  await db`insert into job_roles(id,workspace_id) values(${R},${W}),(${OR},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${R},${U},${W},${U}),(${OR},${O},${W},${O})`;
  for (const key of KEYS) {
    await db`insert into permissions(key,module,resource,action,scope) values(${key},'fixture','fixture','view','workspace') on conflict(key) do nothing`;
    for (const role of [R, OR])
      await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${role},${key},'grant')`;
  }
  await db`insert into contracts(id,workspace_id,owner_id,role,status,title) values(${C},${W},${U},'provider','in_review','Contrato sintético'),(${OTHER},${B},${U},'provider','in_review','Outro workspace')`;
  await db`insert into deals(id,workspace_id,owner_id) values(${D},${W},${U})`;
  await db`insert into contract_approvals(id,workspace_id,owner_id,assigned_to,contract_id,stage,sort_order,status,approver_id,generation) values(${LEGAL},${W},${O},${O},${C},'legal',0,'pending',${O},${GEN}),(${FINANCE},${W},${O},${O},${C},'finance',1,'pending',${O},${GEN})`;
}, 120000);

afterAll(async () => {
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", "-v", container);
  if (nativeStarted)
    execFileSync(PG + "pg_ctl", ["-D", join(temporary, "data"), "-m", "fast", "-w", "stop"], {
      stdio: "pipe",
      timeout: 30000,
    });
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}, 30000);

async function login(tx: postgres.TransactionSql, user = U, readOnly = false) {
  const session = randomUUID();
  if (readOnly) await tx`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
  await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: user, role: "authenticated", session_id: session })},true)`;
  await tx.unsafe("SET LOCAL ROLE authenticated");
}
type Options = {
  missing?: string;
  deny?: string;
  inactive?: boolean;
  workspace?: string;
  readOnly?: boolean;
};
async function subject(fn: (tx: postgres.TransactionSql) => Promise<void>, options: Options = {}) {
  const rollback = new Error("rollback fixture");
  try {
    await db.begin(async (tx) => {
      await tx`update profiles set active_workspace_id=${options.workspace ?? W} where id=${U}`;
      if (options.inactive)
        await tx`update workspace_members set status='inactive' where user_id=${U} and workspace_id=${W}`;
      if (options.missing)
        await tx`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${R} and permission_key=${options.missing}`;
      if (options.deny)
        await tx`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${R} and permission_key=${options.deny}`;
      await login(tx, U, options.readOnly);
      await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function assume(
  tx: postgres.TransactionSql,
  approval = LEGAL,
  expected: string | null = O,
  contract = C,
) {
  const [row] =
    await tx`select contract_approval_assume(${contract}::uuid,${approval}::uuid,${expected}::uuid,${REASON}) as r`;
  return row.r as {
    canAssume: boolean;
    approvals: Array<{
      id: string;
      status: string;
      approverId: string;
      currentActorIsApprover: boolean;
    }>;
  };
}
async function decide(tx: postgres.TransactionSql, approval = LEGAL) {
  const [row] =
    await tx`select contract_approval_decide(${approval}::uuid,'approved','Conferência registrada pelo responsável atual.') as r`;
  return row.r as { status: string; contractStatus: string | null };
}
async function createHandoff(tx: postgres.TransactionSql, status = "pending") {
  await tx.unsafe("SET LOCAL ROLE postgres");
  await tx`insert into contract_handoffs(id,workspace_id,deal_id,contract_id,step,source_id,cycle,status,actor_id,requested_user_id,assignee_id,assignee_name,activity_id,subject,href,due_at)
    values(${HANDOFF},${W},${D},${C},'approval_legal',${LEGAL},${GEN},${status},${O},${O},${O},'Responsável original',${ACTIVITY},'Conferir aprovação jurídica',${`/contracts/${C}`},now()+interval '2 days')`;
  await tx`insert into activities(id,workspace_id,owner_id,assigned_to,created_by,type,related_deal_id,due_date,completed,task_status)
    select ${ACTIVITY},${W},${O},${O},${O},'task',${D},due_at,false,'NOT_STARTED' from contract_handoffs where id=${HANDOFF}`;
}

it("approval substitution SQL permits an authorized active member", async () => {
  await subject(async (tx) => {
    const state = await assume(tx);
    expect(state.approvals.find((a) => a.id === LEGAL)).toMatchObject({
      status: "pending",
      approverId: U,
      currentActorIsApprover: true,
    });
    const [row] =
      await tx`select status,approver_id,assigned_to,decided_by from contract_approvals where id=${LEGAL}`;
    expect(row).toEqual({ status: "pending", approver_id: U, assigned_to: U, decided_by: null });
  });
});
it("approval substitution SQL rejects missing permission", async () => {
  await expect(
    subject(
      async (tx) => {
        await assume(tx);
      },
      { missing: KEY },
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("approval substitution SQL respects explicit deny", async () => {
  await expect(
    subject(
      async (tx) => {
        await assume(tx);
      },
      { deny: KEY },
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("approval substitution SQL isolates another workspace", async () => {
  await expect(
    subject(
      async (tx) => {
        await assume(tx);
      },
      { workspace: B },
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("approval substitution SQL rejects inactive membership", async () => {
  await expect(
    subject(
      async (tx) => {
        await assume(tx);
      },
      { inactive: true },
    ),
  ).rejects.toMatchObject({ code: "42501" });
});

it("substitution does not inherit read-only access or omit existing approval capabilities", async () => {
  await expect(
    subject(
      async (tx) => {
        await assume(tx);
      },
      { readOnly: true },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  for (const key of [
    "techcontracts.approvals.manage.workspace",
    "techcontracts.approvals.approve.workspace",
    "techcontracts.contracts.update.workspace",
    "techcontracts.contracts.view.workspace",
  ])
    await expect(
      subject(
        async (tx) => {
          await assume(tx);
        },
        { missing: key },
      ),
    ).rejects.toMatchObject({ code: "42501" });
});

it("the original assignee cannot be bypassed by the canonical decision", async () => {
  await expect(
    subject(async (tx) => {
      await decide(tx);
    }),
  ).rejects.toThrow(/outra pessoa/i);
});

it("substitution preserves provenance and the subsequent decision belongs to the real actor", async () => {
  await subject(async (tx) => {
    await assume(tx);
    const [proof] =
      await tx`select actor_id,payload from contract_events where contract_id=${C} and event_type='approval_substituted'`;
    expect(proof.actor_id).toBe(U);
    expect(proof.payload).toMatchObject({
      approval_id: LEGAL,
      previous_approver_id: O,
      previous_assigned_to: O,
      acting_approver_id: U,
      generation: GEN,
      reason: REASON,
      decision_unchanged: true,
    });
    expect((await decide(tx)).status).toBe("approved");
    const [row] =
      await tx`select approver_id,decided_by,status from contract_approvals where id=${LEGAL}`;
    expect(row).toEqual({ approver_id: U, decided_by: U, status: "approved" });
    const [contract] = await tx`select status from contracts where id=${C}`;
    expect(contract.status).toBe("in_review");
  });
});

it("assuming Finance does not allow deciding before Legal", async () => {
  await subject(async (tx) => {
    await assume(tx, FINANCE);
    await expect(decide(tx, FINANCE)).rejects.toThrow(/etapa anterior/i);
  });
});

it("each original stage remains required after an audited substitution", async () => {
  await subject(async (tx) => {
    await assume(tx);
    await decide(tx);
    await assume(tx, FINANCE);
    expect((await decide(tx, FINANCE)).contractStatus).toBe("awaiting_signature");
    expect(await tx`select id from contract_approvals where contract_id=${C}`).toHaveLength(2);
    expect(
      await tx`select id from contract_events where contract_id=${C} and event_type='approval_substituted'`,
    ).toHaveLength(2);
  });
});

it("a stale assignee or foreign approval cannot be substituted", async () => {
  await expect(
    subject(async (tx) => {
      await assume(tx, LEGAL, U);
    }),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    subject(async (tx) => {
      await assume(tx, LEGAL, O, OTHER);
    }),
  ).rejects.toMatchObject({ code: "42501" });
});

it("superseded or decided stages cannot be reassigned through substitution", async () => {
  for (const patch of ["superseded_at=now()", "status='approved'"])
    await expect(
      subject(async (tx) => {
        await tx.unsafe("SET LOCAL ROLE postgres");
        await tx.unsafe(`UPDATE contract_approvals SET ${patch} WHERE id='${LEGAL}'`);
        await tx.unsafe("SET LOCAL ROLE authenticated");
        await assume(tx);
      }),
    ).rejects.toMatchObject({ code: "23514" });
});

it("an unchanged self-assignment does not duplicate the substitution audit", async () => {
  await subject(async (tx) => {
    await assume(tx);
    await assume(tx, LEGAL, U);
    expect(
      await tx`select id from contract_events where event_type='approval_substituted'`,
    ).toHaveLength(1);
  });
});

it("substitution cannot forge a different actor or mutate the raw approval table", async () => {
  await expect(
    subject(async (tx) => {
      await tx`update contract_approvals set approver_id=${U} where id=${LEGAL}`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    subject(async (tx) => {
      await tx`select contract_approval_assume(${C},${LEGAL},${O},'ok')`;
    }),
  ).rejects.toMatchObject({ code: "22023" });
  await expect(
    subject(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE anon");
      await assume(tx);
    }),
  ).rejects.toMatchObject({ code: "42501" });
});

it("an existing pending task follows the substitute while preserving its deadline and creator", async () => {
  await subject(async (tx) => {
    await createHandoff(tx);
    const [before] =
      await tx`select due_at,actor_id,activity_id from contract_handoffs where id=${HANDOFF}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await assume(tx);
    await tx.unsafe("SET LOCAL ROLE postgres");
    const [after] =
      await tx`select assignee_id,requested_user_id,due_at,actor_id,activity_id,status from contract_handoffs where id=${HANDOFF}`;
    expect(after).toMatchObject({
      assignee_id: U,
      requested_user_id: U,
      actor_id: O,
      activity_id: ACTIVITY,
      status: "pending",
    });
    expect(after.due_at).toEqual(before.due_at);
    const [task] =
      await tx`select owner_id,created_by,assigned_to,due_date,completed from activities where id=${ACTIVITY}`;
    expect(task).toMatchObject({ owner_id: O, created_by: O, assigned_to: U, completed: false });
    expect(task.due_date).toEqual(before.due_at);
    expect(await tx`select id from activities where related_deal_id=${D}`).toHaveLength(1);
    const [audit] =
      await tx`select actor_id,detail from contract_handoff_events where handoff_id=${HANDOFF} and kind='approver_substituted'`;
    expect(audit.actor_id).toBe(U);
    expect(audit.detail).toMatchObject({
      previous_assignee_id: O,
      assignee_id: U,
      approval_id: LEGAL,
      reason: REASON,
    });
  });
});

it("a blocked handoff is queued for canonical revalidation after substitution", async () => {
  await subject(async (tx) => {
    await createHandoff(tx, "blocked");
    await tx`update contract_handoffs set blocked_reason='Responsável indisponível',next_check_at=now()+interval '1 day' where id=${HANDOFF}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await assume(tx);
    await tx.unsafe("SET LOCAL ROLE postgres");
    const [handoff] =
      await tx`select status,blocked_reason,next_check_at<=now() as ready from contract_handoffs where id=${HANDOFF}`;
    expect(handoff).toEqual({ status: "queued", blocked_reason: null, ready: true });
  });
});

it("a worker lock returns a retryable conflict without changing the approval or task", async () => {
  await db.begin(async (tx) => {
    await createHandoff(tx);
  });
  let signalLocked!: () => void;
  let releaseLock!: () => void;
  const locked = new Promise<void>((resolve) => {
    signalLocked = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const holder = db.begin(async (tx) => {
    await tx`select id from contract_handoffs where id=${HANDOFF} for update`;
    signalLocked();
    await released;
  });
  try {
    await locked;
    await expect(
      subject(async (tx) => {
        await assume(tx);
      }),
    ).rejects.toMatchObject({ code: "23514" });
    const [approval] =
      await db`select approver_id,status from contract_approvals where id=${LEGAL}`;
    expect(approval).toEqual({ approver_id: O, status: "pending" });
    const [task] = await db`select assigned_to from activities where id=${ACTIVITY}`;
    expect(task.assigned_to).toBe(O);
  } finally {
    releaseLock();
    await holder;
    await db`delete from contract_handoffs where id=${HANDOFF}`;
    await db`delete from activities where id=${ACTIVITY}`;
  }
});

it("a concurrent original decision and substitution preserve one real decision actor", async () => {
  const results = await Promise.allSettled([
    db.begin(async (tx) => {
      await login(tx, U);
      await assume(tx);
    }),
    db.begin(async (tx) => {
      await login(tx, O);
      await decide(tx);
    }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const [row] =
    await db`select status,approver_id,assigned_to,decided_by from contract_approvals where id=${LEGAL}`;
  if (row.status === "approved") {
    expect(row.approver_id).toBe(O);
    expect(row.decided_by).toBe(O);
    expect(
      await db`select id from contract_events where event_type='approval_substituted'`,
    ).toHaveLength(0);
  } else {
    expect(row).toEqual({ status: "pending", approver_id: U, assigned_to: U, decided_by: null });
    expect(
      await db`select id from contract_events where event_type='approval_substituted'`,
    ).toHaveLength(1);
  }
});
