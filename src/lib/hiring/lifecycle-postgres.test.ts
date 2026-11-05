import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

describe.each(["fresh", "prototype"])("lifecycle schema %s", (mode) => {
  // Real PostgreSQL/RLS with production resolvers, isolated from all configured URLs.
  // Claims are a SQL fixture, not a GoTrue login; real-JWT acceptance remains separate.
  const docker =
    process.platform === "darwin"
      ? "/Applications/Docker.app/Contents/Resources/bin/docker"
      : "docker";
  const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
  const container = "techerp-hiring-lifecycle-ci-" + randomUUID();
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
  let endpoint = "",
    temporary = "",
    started = false;
  let db: ReturnType<typeof postgres>;
  let competitor: ReturnType<typeof postgres>;
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
    competitor = postgres({
      host: "127.0.0.1",
      port: Number(mapped.split(":")[1]),
      database: "techerp_permission_ci",
      username: "postgres",
      password,
      max: 1,
      onnotice: () => {},
    });
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
    await db.unsafe(readFileSync("tests/fixtures/hiring-stage2.sql", "utf8"));
    await db.unsafe(readFileSync("tests/fixtures/hiring-stage3.sql", "utf8"));
    await db.unsafe(readFileSync("tests/fixtures/hiring-stage4.sql", "utf8"));
    await db.unsafe(
      "CREATE TYPE allocation_status AS ENUM ('active','paused','ended'); ALTER TABLE people_allocations ALTER COLUMN status TYPE allocation_status USING status::allocation_status",
    );
    await db.unsafe(
      readFileSync("drizzle/migrations/0308_hiring_demands_and_approvals.sql", "utf8"),
    );
    await db.unsafe(
      sourceFunction(
        "drizzle/migrations/0172_techprojects_cycle2_deal_delivery.sql",
        "deal_stage_type",
      ),
    );
    await db.unsafe(
      sourceFunction(
        "drizzle/migrations/0218_order3_completion_prepare.sql",
        "contract_esign_manage",
      ),
    );
    await db.unsafe(
      sourceFunction(
        "drizzle/migrations/0218_order3_completion_prepare.sql",
        "contract_esign_public",
      ),
    );
    await db.unsafe(
      sourceFunction(
        "supabase/migrations/20260519191027_0ff4d7ed-582a-4195-a34b-e34969225c38.sql",
        "esign_check_completion",
      ),
    );
    await db.unsafe(
      "CREATE TRIGGER completion AFTER UPDATE ON esign_signers FOR EACH ROW EXECUTE FUNCTION esign_check_completion()",
    );
    await db.unsafe(readFileSync("drizzle/migrations/0309_hiring_signature_evidence.sql", "utf8"));
    await db.unsafe(
      readFileSync("drizzle/migrations/0310_hiring_recruitment_authorization.sql", "utf8"),
    );
    await db.unsafe(
      readFileSync("drizzle/migrations/0311_hiring_employment_and_access_models.sql", "utf8"),
    );
    for (const migration of [
      "0312_hiring_allocation_access_and_invites.sql",
      "0313_hiring_contract_owner_boundary.sql",
      "0314_hiring_invite_reissue_boundary.sql",
      "0315_hiring_role_restrictions.sql",
    ]) {
      await db.unsafe(readFileSync("drizzle/migrations/" + migration, "utf8"));
    }
    await db.unsafe(readFileSync("tests/fixtures/hiring-stage5.sql", "utf8"));
    await db.unsafe(
      sourceFunction("drizzle/migrations/0228_order5_fields_prepare.sql", "shared_field_mode_for"),
    );
    await db.unsafe(
      readFileSync("drizzle/migrations/0175_techprojects_cycle4_billing.sql", "utf8"),
    );
    for (const f of [
      "0316_hiring_monthly_provisions.sql",
      "0317_hiring_billing_boundaries.sql",
      "0318_hiring_internal_cost_provisions.sql",
      "0319_hiring_legacy_billing_ownership.sql",
      "0320_hiring_completed_success_settlement.sql",
    ])
      await db.unsafe(readFileSync("drizzle/migrations/" + f, "utf8"));
    await db.unsafe(
      sourceFunction(
        "drizzle/migrations/0218_order3_completion_prepare.sql",
        "contract_workflow_terminate",
      ),
    );
    await db.unsafe(
      "ALTER TABLE financial_entries ADD COLUMN assigned_to uuid,ADD COLUMN parent_entry_id uuid; CREATE FUNCTION user_effective_permissions(u uuid,w uuid) RETURNS SETOF text LANGUAGE sql STABLE AS $$SELECT DISTINCT key FROM grants WHERE user_id=u AND user_has_permission(u,w,key)$$; CREATE FUNCTION my_team_member_pairs() RETURNS TABLE(workspace_id uuid,user_id uuid) LANGUAGE sql AS $$SELECT NULL::uuid,NULL::uuid WHERE false$$",
    );
    for (const name of [
      "finance_access_context",
      "finance_context_access",
      "finance_context_entry_access",
      "finance_entry_access",
    ])
      await db.unsafe(sourceFunction("drizzle/migrations/0210_finance_core_actions.sql", name));
    if (mode === "prototype")
      await db.unsafe(readFileSync("tests/fixtures/hiring-stage6-remote.sql", "utf8"));
    await db.unsafe(readFileSync("drizzle/migrations/0321_hiring_lifecycle.sql", "utf8"));
  }, 120000);
  afterAll(async () => {
    if (competitor) await competitor.end();
    if (db) await db.end();
    if (started) dockerRun("rm", "-f", container);
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  });

  const E = "70000000-0000-4000-8000-000000000001",
    PE = "70000000-0000-4000-8000-000000000002",
    AL = "70000000-0000-4000-8000-000000000003",
    PR = "70000000-0000-4000-8000-000000000004",
    LE = "70000000-0000-4000-8000-000000000005",
    JOB = IDs[0];
  async function seed() {
    const tables = await db`select tablename from pg_tables where schemaname='public'`;
    await db.unsafe(
      "TRUNCATE " +
        tables.map((t) => 'public."' + t.tablename + '"').join(",") +
        ",storage.objects,auth.users CASCADE",
    );
    await db`insert into workspaces values(${W}),(${B})`;
    for (const u of [U, O, P]) {
      await db`insert into profiles values(${u},${W},'Fixture')`;
      await db`insert into workspace_members(workspace_id,user_id,role) values(${W},${u},'admin')`;
      await db`insert into auth.users values(${u},${u + "@test.invalid"})`;
      for (const k of [
        "techpeople.lifecycle.view.workspace",
        "techpeople.lifecycle.manage.workspace",
        "techpeople.lifecycle.approve.workspace",
        "techpeople.employment.manage.workspace",
        "techpeople.employment.view.workspace",
        "fixture.hr",
        "fixture.work",
        "techpeople.person_allocations.create.workspace",
        "system.roles.manage.workspace",
      ])
        await db`insert into grants values(${u},${k},'grant')`;
    }
    await db`select set_config('request.uid',${U},false)`;
    await db`insert into user_groups values(${R},${W},'Area')`;
    await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,updated_by) values(${W},${R},${O},${P},${U})`;
    await db`insert into hiring_workspace_settings(workspace_id,enabled,updated_by,signature_gate_enabled,employment_gate_enabled,lifecycle_gate_enabled,lifecycle_finance_area_id) values(${W},true,${U},true,true,true,${R})`;
    await db`insert into legal_entities values(${LE},${W},'WK fixture','00000000000001',true)`;
    await db`insert into ats_jobs(id,workspace_id,title,employment_type,hiring_area_id,hiring_purpose,hiring_billing_model) values(${JOB},${W},'Internal','pj',${R},'internal','not_applicable')`;
    await db`select set_config('app.hiring_stage2','on',false)`;
    await db`update ats_jobs set hiring_purpose='internal',hiring_approval_status='approved' where id=${JOB}`;
    await db`select set_config('app.hiring_stage2','off',false)`;
    await db`insert into hiring_access_models(id,workspace_id,name,updated_by) values(${E},${W},'Fixture model',${U})`;
    await db`insert into hiring_access_model_versions(id,model_id,workspace_id,revision,name,allocation_only,permission_keys,created_by) values(${E},${E},${W},1,'Fixture',true,'{}',${U})`;
    await db`insert into people(id,workspace_id,full_name,hire_date) values(${PE},${W},'Person fixture','2026-01-01')`;
    await db`select set_config('app.hiring_purchase','on',false)`;
    await db`insert into contracts(id,workspace_id,owner_id,title,role,hiring_person_id,contracting_legal_entity_id,starts_at,ends_at) values(${PR},${W},${U},'Purchase fixture','client',${PE},${LE},'2026-01-01','2028-06-30')`;
    await db`select set_config('app.hiring_purchase','off',false)`;
    await db`insert into hiring_engagements(id,workspace_id,person_id,job_id,purpose,employment_type,legal_entity_id,purchase_contract_id,model_version_id,starts_at,ends_at,created_by) values(${E},${W},${PE},${JOB},'internal','pj',${LE},${PR},${E},'2026-01-01','2027-06-30',${U})`;
    await db`insert into projects(id,workspace_id,owner_id,name) values(${PR},${W},${U},'Project fixture')`;
    await db`select hiring_allocate(${W},${E},${PR},'2026-01-01','2027-06-30',100,'Initial fixture allocation')`;
    const a = (await db`select id from people_allocations where hiring_engagement_id=${E}`)[0].id;
    await db`select set_config('app.hiring_lifecycle','off',false)`;
    return a as string;
  }
  async function actor<T>(user: string, fn: (tx: postgres.TransactionSql) => Promise<T>) {
    return db.begin(async (tx) => {
      await tx`select set_config('request.uid',${user},true)`;
      await tx`set local role authenticated`;
      return fn(tx);
    });
  }
  function payload(a: string) {
    return {
      allocation: a,
      date: "2026-06-30",
      reason: "Finalização parcial aprovada após revisão",
    };
  }
  async function propose(
    a: string,
    k = "end_allocation",
    p: Record<string, string | boolean | string[]> = payload(a),
  ) {
    const req = randomUUID();
    const snap = (
      await actor(U, (tx) => tx`select hiring_lifecycle_preview(${W},${E},${k},${tx.json(p)}) v`)
    )[0].v;
    await actor(
      U,
      (tx) =>
        tx`select hiring_lifecycle_request(${W},${E},${k},${tx.json(p)},${tx.json(snap)},${req})`,
    );
    return req;
  }
  async function approve(req: string) {
    await actor(
      O,
      (tx) => tx`select hiring_lifecycle_decide(${W},${req},true,'Conferido pelo gestor')`,
    );
    await actor(
      P,
      (tx) => tx`select hiring_lifecycle_decide(${W},${req},true,'Conferido pelo CEO')`,
    );
  }
  it("lifecycle allows authorized active member", async () => {
    const a = await seed();
    expect(
      (
        await actor(
          U,
          (tx) =>
            tx`select hiring_lifecycle_preview(${W},${E},'end_allocation',${tx.json(payload(a))}) v`,
        )
      )[0].v.engagement.id,
    ).toBe(E);
  });
  it("lifecycle rejects missing permission", async () => {
    await seed();
    await db`delete from grants where user_id=${U} and key='techpeople.lifecycle.view.workspace'`;
    await expect(
      actor(U, (tx) => tx`select hiring_lifecycle_context(${W},${E},'')`),
    ).rejects.toThrow(/permissão/);
  });
  it("lifecycle rejects explicit deny", async () => {
    await seed();
    await db`insert into grants values(${U},'techpeople.lifecycle.view.workspace','deny')`;
    await expect(
      actor(U, (tx) => tx`select hiring_lifecycle_context(${W},${E},'')`),
    ).rejects.toThrow(/permissão/);
  });
  it("lifecycle rejects foreign workspace", async () => {
    await seed();
    await expect(
      actor(U, (tx) => tx`select hiring_lifecycle_context(${B},${E},'')`),
    ).rejects.toThrow(/permissão/);
  });
  it("lifecycle rejects inactive member", async () => {
    await seed();
    await db`update workspace_members set status='inactive' where user_id=${U}`;
    await expect(
      actor(U, (tx) => tx`select hiring_lifecycle_context(${W},${E},'')`),
    ).rejects.toThrow(/permissão/);
  });
  it("lifecycle requires sequential approvals and preserves employment on allocation end", async () => {
    const a = await seed(),
      req = await propose(a);
    await expect(
      actor(P, (tx) => tx`select hiring_lifecycle_decide(${W},${req},true,'CEO antecipado')`),
    ).rejects.toThrow(/aprovador/);
    await expect(actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`)).rejects.toThrow(
      /aprovação/,
    );
    await approve(req);
    await actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`);
    expect((await db`select status from hiring_engagements`)[0].status).toBe("active");
    expect(
      (await db`select status,ends_at::text from people_allocations where id=${a}`)[0],
    ).toEqual({
      status: "ended",
      ends_at: "2026-06-30",
    });
    await actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`);
    expect(
      (await db`select count(*) n from hiring_lifecycle_events where kind='applied'`)[0].n,
    ).toBe("1");
  });
  it("lifecycle stale policy and source cannot execute", async () => {
    const a = await seed(),
      req = await propose(a);
    await approve(req);
    await db`update hiring_area_policies set revision=revision+1 where area_id=${R}`;
    await expect(actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`)).rejects.toThrow(
      /aprovação/,
    );
  });
  it("lifecycle blocks orphan hours direct edits and legacy ending", async () => {
    const a = await seed();
    await db`insert into project_time_entries(id,workspace_id,project_id,allocation_id,entry_date) values(${randomUUID()},${W},${PR},${a},'2026-07-01')`;
    await expect(propose(a)).rejects.toThrow(/horas posteriores/);
    await expect(
      db`update hiring_engagements set ends_at='2026-06-30' where id=${E}`,
    ).rejects.toThrow(/ciclo de vida/);
    await expect(
      actor(U, (tx) => tx`select hiring_employment_end(${W},${E},'Legacy end must be blocked')`),
    ).rejects.toThrow(/bloqueado/);
  });
  it("lifecycle renewal creates new period without rewriting historical allocation", async () => {
    const a = await seed(),
      p = {
        allocation: a,
        date: "2027-07-01",
        end: "2028-06-30",
        reason: "Renovação previamente revisada em contrato",
      },
      req = await propose(a, "renew", p);
    await approve(req);
    await actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`);
    expect(
      (await db`select starts_at::text,ends_at::text from people_allocations where id=${a}`)[0],
    ).toEqual({ starts_at: "2026-01-01", ends_at: "2027-06-30" });
    expect(
      (await db`select count(*) n from people_allocations where hiring_engagement_id=${E}`)[0].n,
    ).toBe("2");
  });
  async function financialSeed() {
    await seed();
    for (const u of [U, O, P])
      for (const k of [
        "techfinance.entry_cancellation.manage.workspace",
        "techfinance.entries.view.workspace",
      ])
        await db`insert into grants values(${u},${k},'grant')`;
    const id = randomUUID();
    await db`insert into financial_entries(id,workspace_id,owner_id,direction,origin_type,contract_id,amount,competence_date,due_date,status) values(${id},${W},${U},'payable','contract',${PR},1000,'2026-07-01','2026-07-15','open')`;
    return id;
  }
  function financePayload(id: string) {
    return {
      date: "2026-06-30",
      reason: "Compromisso futuro revisado pelo Financeiro",
      entries: [id],
    };
  }
  it("lifecycle finance cancels only selected future commitment after approvals", async () => {
    const id = await financialSeed(),
      req = await propose("", "cancel_commitments", financePayload(id));
    await approve(req);
    await actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`);
    expect((await db`select status from financial_entries where id=${id}`)[0].status).toBe(
      "cancelled",
    );
    expect((await db`select status from hiring_engagements`)[0].status).toBe("active");
  });
  it("lifecycle finance protects payments banks worked competence and stale approval", async () => {
    const id = await financialSeed();
    await db`update financial_entries set competence_date='2026-06-01',due_date='2026-12-01' where id=${id}`;
    await expect(propose("", "cancel_commitments", financePayload(id))).rejects.toThrow(
      /protegido/,
    );
    await db`update financial_entries set competence_date='2026-07-01' where id=${id}`;
    await db`insert into financial_payments values(${randomUUID()},${id},1)`;
    await expect(propose("", "cancel_commitments", financePayload(id))).rejects.toThrow(
      /protegido/,
    );
    await db`delete from financial_payments`;
    const req = await propose("", "cancel_commitments", financePayload(id));
    await approve(req);
    await db`insert into bank_charges values(${randomUUID()},${id},'active')`;
    await expect(actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`)).rejects.toThrow(
      /protegido/,
    );
    expect((await db`select status from financial_entries`)[0].status).toBe("open");
  });
  it("lifecycle substitution requires overlap consent and already admitted compatible replacement", async () => {
    const a = await seed(),
      person = randomUUID(),
      replacement = randomUUID(),
      contract = randomUUID();
    await db`insert into people(id,workspace_id,full_name,hire_date) values(${person},${W},'Replacement fixture','2026-01-01')`;
    await db`select set_config('app.hiring_purchase','on',false)`;
    await db`insert into contracts(id,workspace_id,owner_id,title,role,hiring_person_id,contracting_legal_entity_id,starts_at,ends_at) values(${contract},${W},${U},'Replacement purchase','client',${person},${LE},'2026-01-01','2028-06-30')`;
    await db`select set_config('app.hiring_purchase','off',false)`;
    await db`insert into hiring_engagements(id,workspace_id,person_id,job_id,purpose,employment_type,legal_entity_id,purchase_contract_id,model_version_id,starts_at,ends_at,created_by) values(${replacement},${W},${person},${JOB},'internal','pj',${LE},${contract},${E},'2026-01-01','2027-06-30',${U})`;
    const p = {
      ...payload(a),
      replacement,
      start: "2026-06-15",
      end: "2027-06-30",
      overlap: false,
    };
    await expect(propose(a, "replace", p)).rejects.toThrow(/Sobreposição/);
    p.overlap = true;
    const req = await propose(a, "replace", p);
    await approve(req);
    await actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`);
    expect(
      (
        await db`select count(*) n from people_allocations where hiring_engagement_id=${replacement}`
      )[0].n,
    ).toBe("1");
    expect((await db`select count(*) n from people`)[0].n).toBe("2");
    expect((await db`select status from hiring_engagements where id=${E}`)[0].status).toBe(
      "active",
    );
  });
  it("lifecycle ending revokes only own grant and preserves manual access membership", async () => {
    const a = await seed(),
      own = randomUUID(),
      manual = randomUUID(),
      assignment = randomUUID();
    await db`select set_config('app.hiring_grant','on',false)`;
    await db`insert into permission_sets(id,workspace_id,owner_id,module,name) values(${own},${W},${U},'__hiring__','Own fixture'),(${manual},${W},${U},'manual','Manual fixture')`;
    await db`insert into user_permission_sets(id,workspace_id,owner_id,user_id,set_id) values(${assignment},${W},${U},${U},${own}),(${randomUUID()},${W},${U},${U},${manual})`;
    await db`insert into hiring_access_grants(workspace_id,engagement_id,user_id,set_id,assignment_id) values(${W},${E},${U},${own},${assignment})`;
    await db`select set_config('app.hiring_grant','off',false)`;
    const req = await propose(a, "end_engagement", payload(a));
    await approve(req);
    await actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`);
    expect(
      (await db`select status,ends_at::text from hiring_engagements where id=${E}`)[0],
    ).toEqual({
      status: "ended",
      ends_at: "2026-06-30",
    });
    expect((await db`select set_id from user_permission_sets`)[0].set_id).toBe(manual);
    expect((await db`select status from workspace_members where user_id=${U}`)[0].status).toBe(
      "active",
    );
    expect((await db`select status from people where id=${PE}`)[0].status).toBe("active");
  });
  it("lifecycle source changes invalidate approved plan and service cannot auto cancel", async () => {
    const a = await seed(),
      req = await propose(a);
    await approve(req);
    await db`update people_allocations set notes='Later manual correction' where id=${a}`;
    await expect(actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`)).rejects.toThrow(
      /Origem mudou/,
    );
    await expect(
      db.begin(async (tx) => {
        await tx`set local role service_role`;
        return tx`select hiring_lifecycle_legacy_block(${W},${PE},'cancel_payable_schedules')`;
      }),
    ).rejects.toThrow(/bloqueado/);
    await expect(
      actor(
        U,
        (tx) => tx`select hiring_lifecycle_legacy_block(${W},${PE},'cancel_payable_schedules')`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("lifecycle self approval and direct journal writes are rejected", async () => {
    const a = await seed();
    await db`update hiring_area_policies set manager_id=${U} where area_id=${R}`;
    await expect(propose(a)).rejects.toThrow(/solicitante/);
    await expect(actor(U, (tx) => tx`select * from hiring_lifecycle_requests`)).rejects.toThrow(
      /permission denied/,
    );
  });
  it("lifecycle finance protects worked month without financial link and remains available after ending", async () => {
    const id = await financialSeed();
    await db`insert into project_time_entries(id,workspace_id,project_id,person_id,entry_date,duration_minutes) values(${randomUUID()},${W},${PR},${PE},'2026-07-10',60)`;
    await expect(propose("", "cancel_commitments", financePayload(id))).rejects.toThrow(
      /protegido/,
    );
    await db`delete from project_time_entries`;
    await db`select set_config('app.hiring_lifecycle','on',false)`;
    await db`update hiring_engagements set status='ended',ends_at='2026-06-30' where id=${E}`;
    await db`select set_config('app.hiring_lifecycle','off',false)`;
    const req = await propose("", "cancel_commitments", financePayload(id));
    await approve(req);
    await actor(U, (tx) => tx`select hiring_lifecycle_apply(${W},${req})`);
    expect((await db`select status from financial_entries`)[0].status).toBe("cancelled");
  });
  it("lifecycle pending preview is invalidated by concurrent source update", async () => {
    const a = await seed();
    const p = payload(a),
      snap = (
        await actor(
          U,
          (tx) => tx`select hiring_lifecycle_preview(${W},${E},'end_allocation',${tx.json(p)}) v`,
        )
      )[0].v;
    await competitor`update people_allocations set notes='Concurrent change' where id=${a}`;
    await expect(
      actor(
        U,
        (tx) =>
          tx`select hiring_lifecycle_request(${W},${E},'end_allocation',${tx.json(p)},${tx.json(snap)},${randomUUID()})`,
      ),
    ).rejects.toThrow(/desatualizada/);
  });
});
