import { beforeAll, afterAll, it, expect } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  readdirSync,
  existsSync,
  chownSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
// Never reads a configured URL. Native official PostgreSQL gets its own temporary Unix socket.
let root = "",
  started = false;
let db: ReturnType<typeof postgres>;
const W = "aaaaaaaa-0000-4000-8000-000000000001",
  B = "aaaaaaaa-0000-4000-8000-000000000002",
  U = "bbbbbbbb-0000-4000-8000-000000000001",
  A = "cccccccc-0000-4000-8000-000000000001",
  L = "dddddddd-0000-4000-8000-000000000001",
  C = "eeeeeeee-0000-4000-8000-000000000001";
const nixPg =
  process.platform === "linux" && existsSync("/nix/store")
    ? readdirSync("/nix/store").find((n) => /-postgresql-17\.\d+$/.test(n))
    : undefined;
const useNative =
  !!nixPg || (process.platform === "darwin" && process.env.TECHERP_NATIVE_PG === "1");
const pgBin = nixPg
  ? `/nix/store/${nixPg}/bin/`
  : "/Applications/Postgres.app/Contents/Versions/16/bin/";
function native(binary: string, args: string[]) {
  return nixPg
    ? execFileSync("runuser", ["-u", "nobody", "--", pgBin + binary, ...args], {
        stdio: "pipe",
        timeout: 30000,
      })
    : execFileSync(pgBin + binary, args, { stdio: "pipe", timeout: 30000 });
}
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-preparation-ci-" + randomUUID();
let endpoint = "";
const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function body(path: string, name: string) {
  const sql = readFileSync(path, "utf8");
  const start = sql.indexOf("CREATE OR REPLACE FUNCTION " + name);
  if (start < 0) throw Error("Missing resolver " + name);
  const tail = sql.slice(start);
  const delimiter = tail.match(/AS\s+(\$[a-zA-Z_]*\$)/i)?.[1] ?? tail.match(/(\$\$)/)?.[1];
  if (!delimiter) throw Error("Missing body");
  const first = tail.indexOf(delimiter),
    end = tail.indexOf(delimiter, first + delimiter.length);
  return tail.slice(0, tail.indexOf(";", end) + 1);
}
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hiring-approval-pg-"));
  if (nixPg) chownSync(root, 65534, 65534);
  if (useNative) {
    native("initdb", [
      "-D",
      join(root, "data"),
      "-U",
      "postgres",
      "--auth-local=trust",
      "--auth-host=reject",
      "--no-locale",
      "--encoding=UTF8",
    ]);
    native("pg_ctl", [
      "-D",
      join(root, "data"),
      "-l",
      join(root, "server.log"),
      "-o",
      `-k ${root} -h '' -p 55438 -F -c jit=off`,
      "-w",
      "start",
    ]);
    started = true;
    db = postgres({
      host: root,
      port: 55438,
      username: "postgres",
      database: "postgres",
      max: 4,
      onnotice: () => {},
    });
  } else {
    endpoint = execFileSync(
      docker,
      ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
      { encoding: "utf8", timeout: 10000 },
    ).trim();
    if (!endpoint.startsWith("unix://")) throw Error("Only a local Unix Docker socket is allowed.");
    const password = randomUUID() + randomUUID(),
      envFile = join(root, "postgres.env");
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
      // Match the deployed PostgreSQL setting; no permission, query or timeout is relaxed.
      "-c",
      "jit=off",
    );
    started = true;
    const mapped = dockerRun("port", container, "5432/tcp");
    if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw Error("Unexpected disposable DB binding");
    db = postgres({
      host: "127.0.0.1",
      port: Number(mapped.split(":")[1]),
      username: "postgres",
      password,
      database: "techerp_permission_ci",
      max: 4,
      connect_timeout: 1,
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
  }
  // Create introspection function after resolver dependencies to satisfy SQL-language validation.
  const fixture = readFileSync("tests/fixtures/hiring-preparation.sql", "utf8");
  const permission = fixture.match(/CREATE FUNCTION user_has_permission[^\n]+/)?.[0];
  if (!permission) throw Error("resolver missing");
  await db.unsafe(fixture.replace(permission, ""));
  await db.unsafe(
    body(
      "drizzle/migrations/0031_workspace_members_status_inactive.sql",
      "public.is_workspace_member",
    ),
  );
  await db.unsafe(
    body("drizzle/migrations/0046_view_as_role_only_readonly.sql", "public.is_read_only_view"),
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0315_hiring_role_restrictions.sql",
      "techerp_api.effective_permissions_unchecked",
    ),
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0249_permission_introspection_boundary.sql",
      "public.permission_metadata_access",
    ),
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0249_permission_introspection_boundary.sql",
      "public.user_effective_permissions",
    ),
  );
  await db.unsafe(permission);
  // Supabase migrations use a non-superuser with CREATEROLE, not PostgreSQL superuser.
  await db.unsafe(`CREATE ROLE preparation_migrator NOLOGIN CREATEROLE INHERIT;
    GRANT authenticated TO preparation_migrator WITH ADMIN OPTION;
    GRANT USAGE,CREATE ON SCHEMA public TO preparation_migrator WITH GRANT OPTION;
    GRANT USAGE ON SCHEMA auth TO preparation_migrator WITH GRANT OPTION;
    GRANT SELECT,INSERT ON permissions TO preparation_migrator;
    GRANT REFERENCES ON workspaces,user_groups,legal_entities,people,companies,contacts,deals,projects,contracts TO preparation_migrator;
    ALTER DEFAULT PRIVILEGES FOR ROLE preparation_migrator IN SCHEMA public GRANT ALL ON TABLES TO authenticated,anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE preparation_migrator IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated,anon;
    SET ROLE preparation_migrator;`);
  await db.unsafe(readFileSync("drizzle/migrations/0373_hiring_requests.sql", "utf8"));
  await db.unsafe(
    readFileSync("drizzle/migrations/0374_hiring_preparation_conditions.sql", "utf8"),
  );
  await db.unsafe("RESET ROLE");
  await db.unsafe(`CREATE TABLE hiring_area_policies(workspace_id uuid,area_id uuid PRIMARY KEY,manager_id uuid,ceo_id uuid,manager_delegate_id uuid,ceo_delegate_id uuid,revision integer DEFAULT 1,updated_by uuid,updated_at timestamptz DEFAULT now());
    CREATE TABLE notifications(id uuid DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,user_id uuid,type text,title text,body text,link text,entity text,entity_id uuid,dedupe_key text);
    CREATE UNIQUE INDEX notification_dedupe ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated,anon,techerp_request_writer;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated,anon,service_role,techerp_request_writer;`);
  await db.begin(async (tx) => {
    await tx.unsafe(
      readFileSync("drizzle/migrations/0375_hiring_preparation_approvals.sql", "utf8")
        .replace(/^BEGIN;$/m, "")
        .replace(/^COMMIT;$/m, ""),
    );
  });

  await db.unsafe(readFileSync("tests/fixtures/hiring-formalization.sql", "utf8"));
  await db.unsafe(
    body(
      "drizzle/migrations/0312_hiring_allocation_access_and_invites.sql",
      "public.hiring_purchase_guard",
    ),
  );
  await db.unsafe(
    "CREATE TRIGGER legacy_hiring_purchase BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION hiring_purchase_guard()",
  );
  await db.unsafe(
    "DROP FUNCTION contract_esign_manage(text,uuid,jsonb);DROP FUNCTION hiring_signature_access(uuid,uuid,text);",
  );
  // Exercise the actual domain functions; fixture retains only tenant/authorization dependencies.
  await db.unsafe(
    body("drizzle/migrations/0218_order3_completion_prepare.sql", "public.contract_esign_manage"),
  );
  await db.unsafe(
    body("drizzle/migrations/0309_hiring_signature_evidence.sql", "public.hiring_signature_access"),
  );
  await db.unsafe(
    body(
      "supabase/migrations/20260519191027_0ff4d7ed-582a-4195-a34b-e34969225c38.sql",
      "public.esign_check_completion",
    ),
  );
  await db.unsafe(
    "CREATE TRIGGER esign_signers_completion AFTER UPDATE OF status ON esign_signers FOR EACH ROW EXECUTE FUNCTION esign_check_completion();",
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0367_contract_signature_packages.sql",
      "public.hiring_contract_fingerprint",
    ),
  );
  await db.unsafe(
    body("drizzle/migrations/0359_forsign_integration.sql", "public.forsign_record_evidence"),
  );
  for (const migration of [
    "0376_hiring_formalization.sql",
    "0377_hiring_formalization_boundaries.sql",
    "0378_hiring_signature_adapter.sql",
    "0379_hiring_formalization_integrity.sql",
    "0380_hiring_direct_person_origin.sql",
  ])
    await db.begin(async (tx) => {
      await tx.unsafe(
        readFileSync("drizzle/migrations/" + migration, "utf8")
          .replace(/^BEGIN;$/m, "")
          .replace(/^COMMIT;$/m, ""),
      );
    });
  for (const table of [
    "user_groups",
    "legal_entities",
    "people",
    "companies",
    "contacts",
    "deals",
    "projects",
    "contracts",
  ]) {
    await db.unsafe(
      `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_entity_read ON ${table} FOR SELECT TO authenticated USING(workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND is_workspace_member(workspace_id,auth.uid()));`,
    );
  }
  // Prepare TCP sessions outside test deadlines; assertions still exercise real concurrent RPCs.
  const connections = await Promise.all([db.reserve(), db.reserve()]);
  try {
    await Promise.all(connections.map((connection) => connection`select 1`));
  } finally {
    for (const connection of connections) connection.release();
  }
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started && useNative)
    native("pg_ctl", ["-D", join(root, "data"), "-m", "fast", "-w", "stop"]);
  if (started && !useNative) dockerRun("rm", "-f", "-v", container);
  if (root) rmSync(root, { recursive: true, force: true });
});
const M = "bbbbbbbb-0000-4000-8000-000000000002",
  CEO = "bbbbbbbb-0000-4000-8000-000000000003",
  D = "bbbbbbbb-0000-4000-8000-000000000004";
const prefix = (kind: string) =>
  kind === "professional" ? "techpeople.hiring_requests" : "techcontracts.supplier_requests";
async function reset() {
  // Keep fixture setup atomic so a failed seed never exposes partial test data.
  await db.begin(async (db) => {
    await db.unsafe(
      "TRUNCATE hiring_engagements,contract_draft_approvers,hiring_formalization_events,hiring_draft_capabilities,hiring_formalizations,contract_drafts,contract_attachments,hiring_contract_evidence,esign_signers,esign_documents,contract_forsign_operations,contract_esign_deliveries,contract_handoff_settings CASCADE",
    );
    await db.unsafe(
      "TRUNCATE hiring_preparation_approval_events,hiring_preparation_approvals,hiring_preparation_reference_events,hiring_preparation_reference_values,hiring_preparation_events,hiring_preparation_requests,notifications,hiring_area_policies,workspaces,profiles,workspace_members,user_job_roles,job_roles,job_role_permission_overrides,user_permission_sets,permission_sets,permission_set_items,user_groups,legal_entities,people,companies,contacts,deals,projects,contracts CASCADE",
    );
    await db`insert into workspaces(id) values(${W}),(${B})`;
    for (const u of [U, M, CEO, D]) {
      await db`insert into profiles values(${u},${W})`;
      await db`insert into workspace_members(workspace_id,user_id) values(${W},${u})`;
      await db`insert into job_roles values(${u},${W})`;
      await db`insert into user_job_roles values(${u},${u},${W},null)`;
      await db`insert into job_role_permission_overrides select ${W},${u},key,'grant' from permissions`;
    }
    await db`insert into user_groups values(${A},${W},'Área de fixture')`;
    await db`insert into legal_entities(id,workspace_id,name) values(${L},${W},'WK fixture')`;
    await db`insert into people(id,workspace_id,full_name,email) values(${D},${W},'Pessoa real fixture','pessoa@example.test')`;
    await db`insert into companies(id,workspace_id,name) values(${C},${W},'Fornecedor fixture')`;
    await db`insert into contacts(id,workspace_id,company_id,first_name,last_name,email) values(${L},${W},${C},'Contato','Fornecedor','fornecedor@example.test')`;
    await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id,updated_by) values(${W},${A},${M},${CEO},${D},${U})`;
  });
}
async function user<T>(u: string, fn: (tx: postgres.TransactionSql) => Promise<T>) {
  return db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: u, role: "authenticated" })},true)`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    return fn(tx);
  });
}
const form = (kind: string) => ({
  title: "Pedido sintético",
  scope_text: "Escopo para revisão",
  purpose: "internal",
  area_id: A,
  legal_entity_id: L,
  regime: kind === "professional" ? "pj" : null,
  person_id: kind === "professional" ? D : null,
  company_id: kind === "supplier" ? C : null,
  contact_id: kind === "supplier" ? L : null,
  deal_id: null,
  project_id: null,
  commercial_contract_id: null,
  status: "draft",
  selection_mode: "defined",
  modality: "monthly",
  release_condition: kind === "supplier" ? "wk_acceptance_invoice" : null,
});
async function ready(kind = "professional", regime = "pj") {
  const data = { ...form(kind), regime: kind === "professional" ? regime : null };
  const draft = await user(U, (tx) =>
    tx`select hiring_preparation_save(${W},${kind},null,0,${randomUUID()},${tx.json({ ...data, reference_value: 22000 })}) v`.then(
      (x) => x[0].v,
    ),
  );
  return user(U, (tx) =>
    tx`select hiring_preparation_save(${W},${kind},${draft.id},1,${randomUUID()},${tx.json({ ...data, status: "ready" })}) v`.then(
      (x) => x[0].v,
    ),
  );
}
const request = (r: { id: string; revision: number }, kind = "professional", u = U) =>
  user(u, (tx) =>
    tx`select hiring_preparation_approval_request(${W},${kind},${r.id},${r.revision}) v`.then(
      (x) => x[0].v as string,
    ),
  );
const context = (id: string, u = U, kind = "professional") =>
  user(u, (tx) =>
    tx`select hiring_preparation_approval_context(${W},${kind},${id},0) v`.then((x) => x[0].v),
  );
const decide = (
  r: { id: string; revision: number },
  a: string,
  u = M,
  stage = "manager",
  decision = "approved",
  op = randomUUID(),
  kind = "professional",
  note = "Revisão conferida",
) =>
  user(u, (tx) =>
    tx`select hiring_preparation_approval_decide(${W},${kind},${r.id},${r.revision},${a},${stage},${decision},${note},${op}) v`.then(
      (x) => x[0].v,
    ),
  );

async function approved(kind = "professional", regime = "pj") {
  await reset();
  await db`insert into contract_handoff_settings(workspace_id,enabled,legal_user_id,finance_user_id,signature_user_id) values(${W},true,${M},${CEO},${D})`;
  await db`insert into contract_draft_approvers values(${W},${M})`;
  const r = await ready(kind, regime),
    a = await request(r, kind);
  await decide(r, a, M, "manager", "approved", randomUUID(), kind);
  await decide(r, a, CEO, "ceo", "approved", randomUUID(), kind);
  return r;
}
const prepare = (r: { id: string; revision: number }, u = U, w = W) =>
  user(u, (tx) =>
    tx`select hiring_formalization_prepare(${w},${r.id},${r.revision}) v`.then(
      (x) => x[0].v as string,
    ),
  );
const transition = (r: { id: string; revision: number }, action: string, u = U) =>
  user(u, (tx) =>
    tx`select hiring_formalization_transition(${W},${r.id},${r.revision},${action},'Conferência humana completa') v`.then(
      (x) => x[0].v as string,
    ),
  );
it("formalization allowed chain creates one real purchase instrument", async () => {
  const r = await approved();
  const a = await prepare(r);
  expect(
    (await db`select role,deal_id,proposal_id,hiring_person_id from contracts where id=${a}`)[0],
  ).toMatchObject({ role: "client", deal_id: null, proposal_id: null, hiring_person_id: D });
  await user(
    U,
    (tx) =>
      tx`update contracts set body_html='Cláusulas, partes e condições reais conferidas no instrumento.',starts_at=current_date where id=${a}`,
  );
  await transition(r, "submit");
  await transition(r, "legal", M);
  const token = await transition(r, "link");
  const challenge = randomUUID(),
    hash = "a".repeat(64);
  await db`select hiring_draft_code_reserve(${token},${challenge},${hash})`;
  await db`select hiring_draft_code_delivery(${token},${challenge},true)`;
  expect(
    (await db`select hiring_draft_decide(${token},${challenge},${hash},'accept','') v`)[0].v.ok,
  ).toBe(true);
  await transition(r, "finance", CEO);
  expect(
    (await user(D, (tx) => tx`select hiring_formalization_signature_gate(${W},${a},null) v`))[0].v,
  ).toBe(true);
});
it("formalization concurrent preparation serializes into one canonical instrument", async () => {
  const r = await approved();
  let ready = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const concurrentPrepare = () =>
    user(U, async (tx) => {
      if (++ready === 2) release();
      await barrier;
      return tx`select hiring_formalization_prepare(${W},${r.id},${r.revision}) v`.then(
        (rows) => rows[0].v as string,
      );
    });
  const [a, b] = await Promise.all([concurrentPrepare(), concurrentPrepare()]);
  expect(ready).toBe(2);
  expect(a).toBe(b);
  expect(
    (await db`select count(*)::int n from contracts where hiring_request_origin=${r.id}`)[0].n,
  ).toBe(1);
  expect(
    (await db`select count(*)::int n from contract_drafts where hiring_request_origin=${r.id}`)[0]
      .n,
  ).toBe(1);
});
it("formalization rejects missing permission", async () => {
  const r = await approved();
  await db`delete from job_role_permission_overrides where role_id=${U} and permission_key='techpeople.hiring_requests.formalization.manage.workspace'`;
  await expect(prepare(r)).rejects.toThrow("permissão");
});
it("formalization rejects explicit deny", async () => {
  const r = await approved();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${U} and permission_key='techpeople.hiring_requests.formalization.manage.workspace'`;
  await expect(prepare(r)).rejects.toThrow("permissão");
});
it("formalization rejects foreign workspace", async () => {
  const r = await approved();
  await expect(prepare(r, U, B)).rejects.toThrow("permissão");
});
it("formalization rejects inactive member", async () => {
  const r = await approved();
  await db`update workspace_members set status='inactive' where user_id=${U}`;
  await expect(prepare(r)).rejects.toThrow("permissão");
});
it("formalization rechecks both approvers before factory", async () => {
  const r = await approved();
  await db`update workspace_members set status='inactive' where user_id=${M}`;
  await expect(prepare(r)).rejects.toThrow("Aprovação atual");
});
it("formalization blocks both signers before legal acceptance finance", async () => {
  const r = await approved(),
    k = await prepare(r);
  await expect(
    user(D, (tx) => tx`select hiring_formalization_signature_gate(${W},${k},null)`),
  ).rejects.toThrow("Conclua");
  await expect(
    db`insert into contract_forsign_operations(workspace_id,contract_id) values(${W},${k})`,
  ).rejects.toThrow("Conclua");
  await expect(
    db`insert into hiring_contract_evidence(workspace_id,contract_id,kind) values(${W},${k},'native')`,
  ).rejects.toThrow("Conclua");
});
async function sentDraft() {
  const r = await approved(),
    k = await prepare(r);
  await user(
    U,
    (tx) =>
      tx`update contracts set body_html='Documento real revisado com condições e partes conferidas.',starts_at=current_date where id=${k}`,
  );
  await transition(r, "submit");
  await transition(r, "legal", M);
  return { r, k, token: await transition(r, "link") };
}
it("formalization OTP suppression failure wrong attempts expiry and atomic consumption", async () => {
  const { token } = await sentDraft(),
    challenge = randomUUID(),
    digest = "b".repeat(64);
  await db`select hiring_draft_code_reserve(${token},${challenge},${digest})`;
  expect(
    (await db`select hiring_draft_decide(${token},${challenge},${digest},'accept','') v`)[0].v.ok,
  ).toBe(false);
  await db`select hiring_draft_code_delivery(${token},${challenge},true)`;
  for (let j = 0; j < 4; j++)
    expect(
      (
        await db`select hiring_draft_decide(${token},${challenge},${"c".repeat(64)},'accept','') v`
      )[0].v.ok,
    ).toBe(false);
  expect((await db`select attempts from hiring_draft_capabilities`)[0].attempts).toBe(5);
  expect(
    (await db`select hiring_draft_decide(${token},${challenge},${digest},'accept','') v`)[0].v.ok,
  ).toBe(false);
});
it("formalization valid OTP consumes once under concurrent acceptance", async () => {
  const { token } = await sentDraft(),
    challenge = randomUUID(),
    digest = "d".repeat(64);
  await db`select hiring_draft_code_reserve(${token},${challenge},${digest})`;
  await db`select hiring_draft_code_delivery(${token},${challenge},true)`;
  const out = await Promise.all([
    db`select hiring_draft_decide(${token},${challenge},${digest},'accept','') v`,
    db`select hiring_draft_decide(${token},${challenge},${digest},'accept','') v`,
  ]);
  expect(out.filter((x) => x[0].v.ok)).toHaveLength(1);
  expect((await db`select code_hash from hiring_draft_capabilities`)[0].code_hash).toBe(null);
});
it("formalization OTP resend and challenge expiry are bounded", async () => {
  const { token } = await sentDraft(),
    c = randomUUID(),
    h = "e".repeat(64);
  await db`select hiring_draft_code_reserve(${token},${c},${h})`;
  await expect(db`select hiring_draft_code_reserve(${token},${randomUUID()},${h})`).rejects.toThrow(
    "Aguarde",
  );
  await db`select hiring_draft_code_delivery(${token},${c},true)`;
  await db`update hiring_draft_capabilities set code_expires_at=now()-interval '1 second'`;
  expect((await db`select hiring_draft_decide(${token},${c},${h},'accept','') v`)[0].v.ok).toBe(
    false,
  );
  await db`update hiring_draft_capabilities set sends=5,last_send_at=now()-interval '2 minutes'`;
  await expect(db`select hiring_draft_code_reserve(${token},${randomUUID()},${h})`).rejects.toThrow(
    "Aguarde",
  );
});
it("formalization canonical recipient only and no secret in ordinary projections", async () => {
  const { r, token } = await sentDraft(),
    c = randomUUID(),
    h = "f".repeat(64);
  expect((await db`select hiring_draft_code_reserve(${token},${c},${h}) v`)[0].v.recipient).toBe(
    "pessoa@example.test",
  );
  const context = await user(U, (tx) => tx`select hiring_formalization_context(${W},${r.id}) v`);
  expect(JSON.stringify(context)).not.toContain(token);
  expect(JSON.stringify(context)).not.toContain(h);
  expect(JSON.stringify(await db`select * from hiring_formalization_events`)).not.toContain(token);
  expect(
    (
      await db`select has_table_privilege('authenticated','hiring_draft_capabilities','SELECT') v`
    )[0].v,
  ).toBe(false);
});
it("formalization origin forgery is blocked and no internal acceptance bypass", async () => {
  const r = await approved();
  await expect(
    db`insert into contracts(id,workspace_id,title,role,hiring_request_origin) values(${randomUUID()},${W},'forged','client',${r.id})`,
  ).rejects.toThrow("Origem");
  const k = await prepare(r);
  await expect(db`update contracts set hiring_request_origin=null where id=${k}`).rejects.toThrow(
    "imutável",
  );
  await expect(
    db`update contract_drafts set status='accepted' where hiring_request_origin=${r.id}`,
  ).rejects.toThrow("bypass");
});
it.each(["document", "attachment", "request", "manager", "recipient", "configuration"])(
  "formalization %s changes revoke old links and decisions",
  async (change) => {
    const { r, k, token } = await sentDraft();
    if (change === "document")
      await user(
        U,
        (tx) => tx`update contracts set body_html='Nova revisão material' where id=${k}`,
      );
    if (change === "attachment")
      await db`insert into contract_attachments(workspace_id,contract_id,file_name,sha256) values(${W},${k},'novo.pdf',${"a".repeat(64)})`;
    if (change === "request")
      await user(
        U,
        (tx) =>
          tx`select hiring_preparation_save(${W},'professional',${r.id},${r.revision},${randomUUID()},${tx.json({ ...form("professional"), status: "ready", title: "Nova demanda" })})`,
      );
    if (change === "manager")
      await db`update workspace_members set status='inactive' where user_id=${M}`;
    if (change === "recipient")
      await db`update people set email='other@example.test' where id=${D}`;
    if (change === "configuration") await db`update contract_handoff_settings set finance_days=2`;
    await expect(db`select hiring_draft_public(${token})`).rejects.toThrow("versão");
    await expect(
      user(D, (tx) => tx`select hiring_formalization_signature_gate(${W},${k},null)`),
    ).rejects.toThrow("Conclua");
  },
);
it("formalization legal and finance order and self-approval are mandatory", async () => {
  const r = await approved(),
    k = await prepare(r);
  await expect(transition(r, "finance", CEO)).rejects.toThrow();
  await user(
    U,
    (tx) =>
      tx`update contracts set body_html='Texto completo com condições conferidas',starts_at=current_date where id=${k}`,
  );
  await transition(r, "submit");
  await expect(transition(r, "legal", U)).rejects.toThrow("autoaprovação");
  await expect(
    user(
      D,
      (tx) =>
        tx`select hiring_contract_native_prepare(${W},${k},hiring_contract_fingerprint(${k}),'WK','wk@example.test','Pessoa','pessoa@example.test')`,
    ),
  ).rejects.toThrow("permission denied");
});
it("formalization historical provider body and native flow remain unchanged", async () => {
  await reset();
  const k = randomUUID();
  await db`insert into contracts(id,workspace_id,title,role,document_kind,deal_id,counterparty_company_id,contracting_legal_entity_id,body_html) values(${k},${W},'Venda histórica','provider','main',${A},${C},${L},'Corpo histórico sem nova exigência')`;
  const [before, after] = await Promise.all([
    db`select hiring_contract_esign_body_without_attachments_sales_v1(${W},${k}) v`,
    db`select hiring_contract_esign_body_without_attachments(${W},${k}) v`,
  ]);
  expect(after[0].v).toBe(before[0].v);
  expect(
    (await user(U, (tx) => tx`select hiring_formalization_signature_gate(${W},${k},null) v`))[0].v,
  ).toBe(true);
});

async function signingDraft() {
  const x = await sentDraft();
  const challenge = randomUUID(),
    digest = "a".repeat(64);
  await db`select hiring_draft_code_reserve(${x.token},${challenge},${digest})`;
  await db`select hiring_draft_code_delivery(${x.token},${challenge},true)`;
  await db`select hiring_draft_decide(${x.token},${challenge},${digest},'accept','')`;
  await transition(x.r, "finance", CEO);
  return x;
}
it("integrity private trail persists all decisions and excludes basic events", async () => {
  const { r } = await signingDraft();
  const notes = await user(
    M,
    (tx) => tx`select * from hiring_formalization_notes order by created_at`,
  );
  expect(notes.map((n) => n.stage)).toEqual(["submit", "legal", "finance"]);
  expect(
    notes.every(
      (n) =>
        n.note === "Conferência humana completa" && n.actor_id && n.created_at && n.cycle === 1,
    ),
  ).toBe(true);
  expect(JSON.stringify(await db`select * from hiring_formalization_events`)).not.toContain(
    "Conferência humana completa",
  );
  const c = await user(M, (tx) => tx`select hiring_formalization_context(${W},${r.id}) v`);
  expect(c[0].v.notes).toHaveLength(3);
  await expect(
    user(M, (tx) => tx`update hiring_formalization_notes set note='forged'`),
  ).rejects.toThrow();
});
it("integrity private trail denies missing reference permission deny foreign and inactive", async () => {
  const { r } = await signingDraft();
  for (const scenario of ["missing", "deny", "foreign", "inactive", "contract", "formalization"]) {
    await db`update workspace_members set status='active' where user_id=${M}`;
    await db`update profiles set active_workspace_id=${W} where id=${M}`;
    await db`delete from job_role_permission_overrides where role_id=${M}`;
    await db`insert into job_role_permission_overrides select ${W},${M},key,'grant' from permissions`;
    const key =
      scenario === "contract"
        ? "techcontracts.contracts.view.workspace"
        : "techpeople.hiring_requests.reference.view.workspace";
    if (scenario === "missing" || scenario === "contract")
      await db`delete from job_role_permission_overrides where role_id=${M} and permission_key=${key}`;
    if (scenario === "deny")
      await db`update job_role_permission_overrides set effect='deny' where role_id=${M} and permission_key=${key}`;
    if (scenario === "foreign")
      await db`update profiles set active_workspace_id=${B} where id=${M}`;
    if (scenario === "inactive")
      await db`update workspace_members set status='inactive' where user_id=${M}`;
    if (scenario === "formalization")
      await db`delete from job_role_permission_overrides where role_id=${M} and permission_key like 'techpeople.hiring_requests.formalization.%'`;
    expect(await user(M, (tx) => tx`select * from hiring_formalization_notes`)).toHaveLength(0);
    if (scenario !== "foreign" && scenario !== "inactive")
      expect(
        (await user(M, (tx) => tx`select hiring_formalization_context(${W},${r.id}) v`))[0].v.notes,
      ).toEqual([]);
  }
});
it("integrity external changes require reason after valid OTP and never persist invalid code notes", async () => {
  const { r, token } = await sentDraft();
  const challenge = randomUUID(),
    digest = "a".repeat(64);
  await db`select hiring_draft_code_reserve(${token},${challenge},${digest})`;
  await db`select hiring_draft_code_delivery(${token},${challenge},true)`;
  expect(
    (
      await db`select hiring_draft_decide(${token},${challenge},${"b".repeat(64)},'changes','Nota não autenticada') v`
    )[0].v.ok,
  ).toBe(false);
  expect(
    (
      await db`select count(*)::int n from hiring_formalization_notes where stage='counterparty_changes'`
    )[0].n,
  ).toBe(0);
  expect(
    (await db`select hiring_draft_decide(${token},${challenge},${digest},'changes',' ') v`)[0].v.ok,
  ).toBe(false);
  expect((await db`select consumed_at from hiring_draft_capabilities`)[0].consumed_at).toBeNull();
  expect(
    (
      await db`select hiring_draft_decide(${token},${challenge},${digest},'changes','Revisar prazo e condições') v`
    )[0].v.ok,
  ).toBe(true);
  expect(
    (await db`select * from hiring_formalization_notes where stage='counterparty_changes'`)[0],
  ).toMatchObject({
    note: "Revisar prazo e condições",
    actor_kind: "counterparty",
    actor_id: null,
    cycle: 1,
    request_id: r.id,
  });
  expect(JSON.stringify(await db`select * from hiring_formalization_events`)).not.toContain(
    "Revisar prazo e condições",
  );
});
it("integrity supplier legal preparer explicitly reviews but cannot approve own demand", async () => {
  const r = await approved("supplier");
  const k = await prepare(r, M);
  expect(
    (
      await db`select role,counterparty_company_id,hiring_person_id from contracts where id=${k}`
    )[0],
  ).toMatchObject({ role: "client", counterparty_company_id: C, hiring_person_id: null });
  await user(
    M,
    (tx) =>
      tx`update contracts set body_html='Condições e cláusulas de compra revisadas',starts_at=current_date where id=${k}`,
  );
  await transition(r, "submit", M);
  await transition(r, "legal", M);
  expect((await db`select legal_by,prepared_by from hiring_formalizations`)[0]).toMatchObject({
    legal_by: M,
    prepared_by: M,
  });
  expect((await db`select hiring_formalization_recipient(${r.id}) v`)[0].v).toBe(
    "fornecedor@example.test",
  );
  await expect(
    user(M, (tx) => tx`update hiring_preparation_requests set created_by=${M} where id=${r.id}`),
  ).rejects.toThrow();
  await expect(transition(r, "legal", U)).rejects.toThrow();
});
it.each(["clt", "pj", "freelance"])(
  "integrity real professional %s factory preserves canonical person",
  async (regime) => {
    const r = await approved("professional", regime),
      k = await prepare(r);
    expect(
      (await db`select role,hiring_person_id,deal_id,proposal_id from contracts where id=${k}`)[0],
    ).toMatchObject({ role: "client", hiring_person_id: D, deal_id: null, proposal_id: null });
    expect(
      (await db`select regime from hiring_preparation_requests where id=${r.id}`)[0].regime,
    ).toBe(regime);
  },
);
async function nativeParticipants(k: string) {
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  for (let j = 0; j < 3; j++)
    await db`insert into contacts(id,workspace_id,company_id,first_name,last_name,email) values(${ids[j]},${W},${C},'Signatário',${String(j)},${`signer${j}@example.test`})`;
  return user(D, (tx) =>
    tx`select hiring_contract_signers_prepare(${W},${k},hiring_contract_fingerprint(${k}),${tx.json(ids.map((id, j) => ({ contactId: id, role: ["CONTRATANTE", "CONTRATADO", "TESTEMUNHA"][j] })))}) v`.then(
      (x) => x[0].v as string,
    ),
  );
}
it("integrity actual native preparation public signature and completion require every included witness", async () => {
  const { r, k } = await signingDraft();
  const doc = await nativeParticipants(k);
  const signers =
    await db`select * from esign_signers where document_id=${doc} order by sign_order`;
  expect(signers).toHaveLength(3);
  await user(D, (tx) => tx`select contract_esign_manage('send',${doc},'{}')`);
  expect(
    (await user(M, (tx) => tx`select hiring_formalization_context(${W},${r.id}) v`))[0].v.status,
  ).toBe("signature_pending");
  for (let j = 0; j < 2; j++)
    await db`select contract_esign_public(${signers[j].public_token},'sign','Nome real','desenho',null,null,null)`;
  expect((await db`select hiring_formalization_signed(${W},${k}) v`)[0].v).toBe(false);
  await db`select contract_esign_public(${signers[2].public_token},'sign','Testemunha real','desenho',null,null,null)`;
  expect((await db`select hiring_formalization_signed(${W},${k}) v`)[0].v).toBe(true);
  expect((await db`select hiring_contract_signature_reason(${k},${W},null) v`)[0].v).toBeNull();
  expect(
    (await user(M, (tx) => tx`select hiring_formalization_context(${W},${r.id}) v`))[0].v.status,
  ).toBe("signed");
  expect((await db`select status from contracts where id=${k}`)[0].status).toBe("draft");
  await db`delete from contract_signature_participants where document_id=${doc} and role='TESTEMUNHA'`;
  expect((await db`select hiring_formalization_signed(${W},${k}) v`)[0].v).toBe(false);
});
it("integrity actual ForSign evidence requires current private operation and stored PDF hash", async () => {
  const { k } = await signingDraft();
  const op = randomUUID(),
    path = `${W}/${k}/signed.pdf`,
    hash = "a".repeat(64);
  await db`insert into contract_forsign_operations(id,workspace_id,contract_id,contract_hash,status,operation_id,created_by) values(${op},${W},${k},hiring_contract_fingerprint(${k}),'completed',802,${D})`;
  expect((await db`select hiring_formalization_signed(${W},${k}) v`)[0].v).toBe(false);
  await db`update contract_forsign_operations set requested_members='[{"email":"a@example.test"},{"email":"b@example.test"},{"email":"w@example.test"}]',members='[{"email":"a@example.test","status":"Completed"},{"email":"b@example.test","status":"Completed"}]' where id=${op}`;
  await expect(
    db`select forsign_record_evidence(${op},${path},${hash},current_date)`,
  ).rejects.toThrow("todos os participantes");
  await db`update contract_forsign_operations set members=members||'[{"email":"w@example.test","status":"Completed"}]'::jsonb where id=${op}`;
  await db`insert into storage.objects values('contract-signature-evidence',${path},jsonb_build_object('sha256',${hash}::text,'contract_hash',hiring_contract_fingerprint(${k})))`;
  await db`select forsign_record_evidence(${op},${path},${hash},current_date)`;
  expect((await db`select hiring_formalization_signed(${W},${k}) v`)[0].v).toBe(true);
  await db`update storage.objects set user_metadata='{}' where name=${path}`;
  expect((await db`select hiring_formalization_signed(${W},${k}) v`)[0].v).toBe(false);
});
it.each([false, true])(
  "integrity reprepare and direct body overwrite blocked; completed=%s",
  async (complete) => {
    const { r, k } = await signingDraft();
    const doc = await nativeParticipants(k);
    await user(D, (tx) => tx`select contract_esign_manage('send',${doc},'{}')`);
    if (complete)
      for (const z of await db`select public_token from esign_signers where document_id=${doc}`)
        await db`select contract_esign_public(${z.public_token},'sign','Nome completo','desenho',null,null,null)`;
    const old = (await db`select body_html from contracts where id=${k}`)[0].body_html;
    await db`select hiring_formalization_invalidate(${r.id})`;
    await expect(prepare(r)).rejects.toThrow("Documento em assinatura");
    await expect(
      user(U, (tx) => tx`update contracts set body_html='' where id=${k}`),
    ).rejects.toThrow("corpo histórico");
    expect((await db`select body_html from contracts where id=${k}`)[0].body_html).toBe(old);
    expect(
      (await db`select count(*)::int n from esign_signers where document_id=${doc}`)[0].n,
    ).toBe(3);
  },
);

it("integrity preview before finance uses same hash and restricts sales attachments on purchase", async () => {
  const { r, k } = await sentDraft();
  const annex = randomUUID(),
    hash = "c".repeat(64);
  await db`select hiring_formalization_invalidate(${r.id})`;
  await db`insert into contract_attachments(id,workspace_id,contract_id,file_name,storage_path,sha256) values(${annex},${W},${k},'Proposta fornecedor.pdf','private/path',${hash})`;
  const current = (await db`select hiring_contract_fingerprint(${k}) v`)[0].v;
  const preview = await user(
    M,
    (tx) => tx`select contract_attachment_signing_context(${k},${current}) v`,
  );
  expect(preview[0].v.attachments[0]).toMatchObject({ id: annex, kind: "file", stamp: hash });
  const c = await user(M, (tx) => tx`select hiring_contract_signature_context(${W},${k}) v`);
  expect(c[0].v).toMatchObject({ hiring_origin: true, can_manage: false, can_preview: true });
  expect(
    (await user(M, (tx) => tx`select contract_attachment_manage(${k},'sources','{}') v`))[0].v,
  ).toEqual([]);
  await expect(
    user(M, (tx) => tx`select contract_attachment_manage(${k},'link','{"kind":"proposal"}')`),
  ).rejects.toThrow("Compra WK");
  await expect(
    user(D, (tx) => tx`select hiring_formalization_signature_gate(${W},${k},${current})`),
  ).rejects.toThrow("Conclua");
});

it("integrity rejection retains private stage reason and actor", async () => {
  const { r } = await sentDraft();
  await db`update hiring_formalizations set status='legal' where request_id=${r.id}`;
  await transition(r, "reject", M);
  expect(
    (await db`select * from hiring_formalization_notes where stage='legal_reject'`)[0],
  ).toMatchObject({ actor_id: M, note: "Conferência humana completa", cycle: 1 });
  expect(
    (await db`select status from hiring_formalizations where request_id=${r.id}`)[0].status,
  ).toBe("invalid");
});
it("integrity private capability has no direct anon authenticated writer note insertion", async () => {
  await signingDraft();
  for (const role of ["anon", "authenticated", "techerp_request_writer"])
    expect(
      (await db`select has_table_privilege(${role},'hiring_formalization_notes','INSERT') v`)[0].v,
    ).toBe(false);
  expect(
    (await db`select has_table_privilege('anon','hiring_formalization_notes','SELECT') v`)[0].v,
  ).toBe(false);
});
it("integrity historical sales reasons and context are identical to unchanged definitions", async () => {
  await reset();
  const k = randomUUID();
  await db`insert into contracts(id,workspace_id,title,role,document_kind,deal_id,counterparty_company_id,contracting_legal_entity_id,body_html) values(${k},${W},'Venda histórica','provider','main',${A},${C},${L},'Corpo histórico')`;
  expect((await db`select hiring_contract_signature_reason(${k},${W},null) v`)[0].v).toBe(
    (await db`select hiring_contract_signature_reason_sales_v1(${k},${W},null) v`)[0].v,
  );
  const c = await db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "authenticated" })},true)`;
    return tx`select hiring_contract_signature_context(${W},${k}) v,hiring_contract_signature_context_sales_v1(${W},${k}) previous`;
  });
  expect(c[0].v).toEqual(c[0].previous);
});
it("integrity cancellation and revocation release only pending document not completed history", async () => {
  const { r, k } = await signingDraft();
  const doc = await nativeParticipants(k);
  await user(D, (tx) => tx`select contract_esign_manage('send',${doc},'{}')`);
  await user(D, (tx) => tx`select contract_esign_manage('cancel',${doc},'{}')`);
  await db`update hiring_contract_evidence set revoked_at=now() where document_id=${doc}`;
  await db`select hiring_formalization_invalidate(${r.id})`;
  expect(await prepare(r)).toBe(k);
  expect((await db`select status from esign_documents where id=${doc}`)[0].status).toBe("canceled");
});

it("direct professional origin preserves the legacy admission person guard", async () => {
  await reset();
  const k = randomUUID();
  await expect(
    db`insert into contracts(id,workspace_id,title,role,document_kind,hiring_person_id,contracting_legal_entity_id) values(${k},${W},'Legacy fixture','client','main',${D},${L})`,
  ).rejects.toThrow("admissão");
  await db.begin(async (tx) => {
    await tx`select set_config('app.hiring_purchase','on',true)`;
    await tx`insert into contracts(id,workspace_id,title,role,document_kind,hiring_person_id,contracting_legal_entity_id) values(${k},${W},'Legacy fixture','client','main',${D},${L})`;
  });
  await db`insert into hiring_engagements values(${k},${L},${D},'active')`;
  await expect(
    db`update contracts set contracting_legal_entity_id=null where id=${k}`,
  ).rejects.toThrow("preservar pessoa");
});
