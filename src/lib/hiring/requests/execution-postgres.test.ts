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
const PREPARED = "drizzle/migrations/0381_hiring_execution_start.sql";
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
const container = "techerp-execution-ci-" + randomUUID();
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
  root = mkdtempSync(join(tmpdir(), "hiring-execution-pg-"));
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
      `-k ${root} -h '' -p 55447 -F -c jit=off`,
      "-w",
      "start",
    ]);
    started = true;
    db = postgres({
      host: root,
      port: 55447,
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
  // Production-shaped execution tables (ATS dependencies stay stubs; domain functions are real).
  await db.unsafe(readFileSync("tests/fixtures/hiring-execution.sql", "utf8"));
  await db.unsafe(
    body(
      "drizzle/migrations/0356_deal_contracting_journey.sql",
      "public.contract_accepted_draft_guard",
    ),
  );
  await db.unsafe(
    "CREATE TRIGGER contract_accepted_draft_guard BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contract_accepted_draft_guard()",
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0311_hiring_employment_and_access_models.sql",
      "public.hiring_employment_access",
    ),
  );
  for (const name of ["public.hiring_allocate"])
    await db.unsafe(body("drizzle/migrations/0312_hiring_allocation_access_and_invites.sql", name));
  await db.unsafe(
    body(
      "drizzle/migrations/0314_hiring_invite_reissue_boundary.sql",
      "public.hiring_employment_context",
    ),
  );
  await db.begin(async (tx) => {
    await tx.unsafe(readFileSync(PREPARED, "utf8"));
    await tx.unsafe(
      readFileSync("drizzle/migrations/0386_hiring_execution_current_authority.sql", "utf8"),
    );
  });
  await db.unsafe(
    "CREATE TRIGGER zzzzzz_hiring_allocation BEFORE INSERT OR UPDATE ON people_allocations FOR EACH ROW EXECUTE FUNCTION hiring_allocation_guard()",
  );
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
  // Open both sessions before deadlines; concurrency cases still run real overlapping RPCs.
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
    // Cleanup only in the disposable fixture: preserve query plans and restore every guard before scenario writes.
    await db.unsafe(`SET LOCAL session_replication_role=replica;
      DO $cleanup$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN('permissions','shared_field_catalog') LOOP EXECUTE format('DELETE FROM public.%I',t.tablename);END LOOP;END $cleanup$;
      DELETE FROM storage.objects; SET LOCAL session_replication_role=origin;`);
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
const today = () => new Date().toISOString().slice(0, 10);
async function signed(kind = "professional") {
  const x = kind === "professional" ? await signingDraft() : await signingSupplier();
  const doc = await nativeParticipants(x.k);
  await user(D, (tx) => tx`select contract_esign_manage('send',${doc},'{}')`);
  const signers =
    await db`select * from esign_signers where document_id=${doc} order by sign_order`;
  for (const s of signers)
    await db`select contract_esign_public(${s.public_token},'sign','Nome real','desenho',null,null,null)`;
  expect((await db`select hiring_formalization_signed(${W},${x.k}) v`)[0].v).toBe(true);
  return { ...x, doc };
}
async function signingSupplier() {
  const r = await approved("supplier"),
    k = await prepare(r, M);
  await user(
    M,
    (tx) =>
      tx`update contracts set body_html='Condições e cláusulas de compra revisadas',starts_at=current_date where id=${k}`,
  );
  await transition(r, "submit", M);
  await transition(r, "legal", M);
  const token = await transition(r, "link", M);
  const challenge = randomUUID(),
    digest = "a".repeat(64);
  await db`select hiring_draft_code_reserve(${token},${challenge},${digest})`;
  await db`select hiring_draft_code_delivery(${token},${challenge},true)`;
  await db`select hiring_draft_decide(${token},${challenge},${digest},'accept','')`;
  await transition(r, "finance", CEO);
  return { r, k, token };
}
const start = (
  r: { id: string; revision: number },
  u = M,
  op = randomUUID(),
  w = W,
  from: string | null = today(),
  to: string | null = null,
  reason = "Início autorizado após conferência da assinatura.",
) =>
  user(u, (tx) =>
    tx`select hiring_execution_start(${w},${r.id},${r.revision},${from}::date,${to}::date,${reason},${op}) v`.then(
      (x) => x[0].v as string,
    ),
  );
const execContext = (id: string, u = M) =>
  user(u, (tx) => tx`select hiring_execution_context(${W},${id}) v`.then((x) => x[0].v));
const KEY = "techpeople.hiring_requests.execution.approve.workspace";

it("execution allowed: area manager authorizes direct professional start without ATS, IAM or finance", async () => {
  const { r, k } = await signed();
  expect((await execContext(r.id)).can_start).toBe(true);
  const sid = await start(r);
  const s = (await db`select * from hiring_execution_starts where id=${sid}`)[0];
  expect(s).toMatchObject({
    request_id: r.id,
    contract_id: k,
    authorized_by: M,
    kind: "professional",
  });
  const e = (await db`select * from hiring_engagements where id=${s.engagement_id}`)[0];
  expect(e).toMatchObject({
    hiring_request_id: r.id,
    job_id: null,
    application_id: null,
    model_version_id: null,
    person_id: D,
    purchase_contract_id: k,
    legal_entity_id: L,
    employment_type: "pj",
  });
  expect((await db`select status from contracts where id=${k}`)[0].status).toBe("active");
  expect((await db`select count(*)::int n from ats_jobs`)[0].n).toBe(0);
  expect((await execContext(r.id, U)).status).toBe("started");
});
it("execution direct employment is visible in the canonical person context without IAM or ATS", async () => {
  const { r } = await signed();
  await start(r);
  const c = await user(M, (tx) =>
    tx`select hiring_employment_context(${W},${D},null,'') v`.then((x) => x[0].v),
  );
  expect(c.engagements).toHaveLength(1);
  expect(c.engagements[0]).toMatchObject({
    hiring_request_id: r.id,
    model_name: null,
    access_active: false,
    invite_pending: false,
    job_id: null,
  });
  await expect(
    user(M, (tx) => tx`select hiring_employment_context(${W},null,${randomUUID()},'')`),
  ).rejects.toThrow("Sem permissão para vínculos");
});
it("execution rejects missing key", async () => {
  const { r } = await signed();
  await db`delete from job_role_permission_overrides where role_id=${M} and permission_key=${KEY}`;
  await expect(start(r)).rejects.toThrow("permissão");
  expect((await execContext(r.id, U)).problem).toContain("Gestor da área sem permissão");
});
it("execution rejects explicit deny", async () => {
  const { r } = await signed();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${M} and permission_key=${KEY}`;
  await expect(start(r)).rejects.toThrow("permissão");
});
it("execution rejects foreign workspace", async () => {
  const { r } = await signed();
  await expect(start(r, M, randomUUID(), B)).rejects.toThrow("permissão");
});
it("execution rejects inactive member", async () => {
  const { r } = await signed();
  await db`update workspace_members set status='inactive' where user_id=${M}`;
  await expect(start(r)).rejects.toThrow("permissão");
});
it("execution: CEO and requester never act as fallback manager", async () => {
  const { r } = await signed();
  await expect(start(r, CEO)).rejects.toThrow("gestor da área");
  await expect(start(r, U)).rejects.toThrow("gestor da área");
});
it("execution blocks before signature and keeps contract out of active", async () => {
  const { r, k } = await signingDraft();
  await expect(start(r)).rejects.toThrow("Assinatura completa");
  await expect(db`update contracts set status='active' where id=${k}`).rejects.toThrow(
    "Ativação somente",
  );
});
it("execution blocks when policy changes and revalidates current approval", async () => {
  const { r } = await signed();
  await db`update hiring_area_policies set manager_id=${CEO},revision=revision+1 where area_id=${A}`;
  await expect(start(r, CEO)).rejects.toThrow("Aprovação gestor/CEO");
});
it("execution period must stay within signed instrument and reason is required", async () => {
  const { r, k } = await signed();
  await expect(start(r, M, randomUUID(), W, "2000-01-01")).rejects.toThrow("vigência");
  await expect(start(r, M, randomUUID(), W, today(), null, "curto")).rejects.toThrow("Justifique");
  expect((await db`select status from contracts where id=${k}`)[0].status).toBe("draft");
});
it("execution revision conflict and idempotent concurrent starts produce one engagement", async () => {
  const { r } = await signed();
  await expect(start({ ...r, revision: r.revision + 1 })).rejects.toThrow("REVISION_CONFLICT");
  const op = randomUUID();
  const [a, b] = await Promise.all([start(r, M, op), start(r, M, op)]);
  expect(a).toBe(b);
  await expect(
    start(r, M, op, W, today(), null, "Outra justificativa não substitui o início anterior"),
  ).rejects.toThrow("já autorizado");
  await expect(start({ ...r, revision: r.revision + 1 }, M, op)).rejects.toThrow("já autorizado");
  expect(
    (await db`select count(*)::int n from hiring_engagements where hiring_request_id=${r.id}`)[0].n,
  ).toBe(1);
  await expect(start(r, M, randomUUID(), W, today(), today())).rejects.toThrow("já autorizado");
});
it("execution supplier start creates no person engagement", async () => {
  const { r, k } = await signed("supplier");
  await user(M, (tx) => tx`select 1`);
  const sid = await user(M, (tx) =>
    tx`select hiring_execution_start(${W},${r.id},${r.revision},current_date,null,'Fornecedor liberado após assinatura.',${randomUUID()}) v`.then(
      (x) => x[0].v,
    ),
  );
  expect(
    (await db`select engagement_id from hiring_execution_starts where id=${sid}`)[0].engagement_id,
  ).toBeNull();
  expect((await db`select count(*)::int n from hiring_engagements`)[0].n).toBe(0);
  expect((await db`select status from contracts where id=${k}`)[0].status).toBe("active");
});
it("execution direct writes cannot forge starts, engagements or activation", async () => {
  const { r, k } = await signed();
  await expect(
    user(
      M,
      (tx) =>
        tx`insert into hiring_engagements(workspace_id,person_id,hiring_request_id,purpose,employment_type,legal_entity_id,starts_at,created_by) values(${W},${D},${r.id},'internal','pj',${L},current_date,${M})`,
    ),
  ).rejects.toThrow();
  await expect(
    user(M, (tx) => tx`select hiring_execution_problem(${W},${r.id})`),
  ).rejects.toThrow();
  await expect(db`update contracts set status='active' where id=${k}`).rejects.toThrow(
    "Ativação somente",
  );
  const sid = await start(r);
  await expect(
    db`update hiring_execution_starts set reason='alterado indevidamente' where id=${sid}`,
  ).rejects.toThrow("imutável");
});
it("execution allocation requires authorized start, intact signature, period and capacity", async () => {
  const { r, k, doc } = await signed();
  const P = randomUUID();
  await db`insert into projects(id,workspace_id,name) values(${P},${W},'Projeto real')`;
  await start(r);
  const e = (await db`select id from hiring_engagements where hiring_request_id=${r.id}`)[0].id;
  const alloc = (pct: number, op = M) =>
    user(op, (tx) =>
      tx`select hiring_allocate(${W},${e},${P},current_date,null,${pct},null) v`.then(
        (x) => x[0].v,
      ),
    );
  const [a1, a2] = await Promise.allSettled([
    alloc(60),
    user(
      M,
      (tx) =>
        tx`select hiring_allocate(${W},${e},${P},current_date + 1,null,60,'Período diferente justificado') v`,
    ),
  ]);
  expect([a1, a2].filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(String([a1, a2].find((x) => x.status === "rejected")?.reason)).toContain("Capacidade");
  const winner = (
    await db`select id,starts_at::text as starts_at from people_allocations where hiring_engagement_id=${e}`
  )[0];
  expect(
    await user(M, (tx) =>
      tx`select hiring_allocate(${W},${e},${P},${winner.starts_at}::date,null,60,'Período diferente justificado') v`.then(
        (x) => x[0].v,
      ),
    ),
  ).toBe(winner.id);
  await expect(
    user(
      M,
      (tx) =>
        tx`insert into people_allocations(workspace_id,person_id,project_id,hiring_engagement_id,starts_at,allocation_pct) values(${W},${D},${P},${e},'2000-01-01',10)`,
    ),
  ).rejects.toThrow("período");
  await db`delete from contract_signature_participants where document_id=${doc} and role='TESTEMUNHA'`;
  await expect(
    user(
      M,
      (tx) =>
        tx`select hiring_allocate(${W},${e},${P},current_date + 5,null,10,'Período diferente justificado')`,
    ),
  ).rejects.toThrow("assinatura íntegra");
  expect((await execContext(r.id)).start.signature_intact).toBe(false);
  expect((await db`select status from contracts where id=${k}`)[0].status).toBe("active");
});
it("execution capacity counts simultaneous load rather than sequential allocations", async () => {
  const { r } = await signed();
  const P = randomUUID();
  await db`insert into projects(id,workspace_id,name) values(${P},${W},'Projeto com períodos')`;
  const sid = await start(r);
  const e = (await db`select engagement_id from hiring_execution_starts where id=${sid}`)[0]
    .engagement_id;
  await user(
    M,
    (tx) =>
      tx`select hiring_allocate(${W},${e},${P},current_date,current_date+9,60,'Primeiro período revisado')`,
  );
  await user(
    M,
    (tx) =>
      tx`select hiring_allocate(${W},${e},${P},current_date+10,current_date+19,60,'Segundo período revisado')`,
  );
  await expect(
    user(
      M,
      (tx) =>
        tx`select hiring_allocate(${W},${e},${P},current_date,current_date+19,40,'Dedicação paralela revisada')`,
    ),
  ).resolves.toBeDefined();
  await expect(
    user(
      M,
      (tx) =>
        tx`select hiring_allocate(${W},${e},${P},current_date+9,current_date+10,1,'Limite entre períodos revisado')`,
    ),
  ).rejects.toThrow("Capacidade");
});
it("execution allocations reject changed approval policy after start and preserve history", async () => {
  const { r, k } = await signed();
  const P = randomUUID();
  await db`insert into projects(id,workspace_id,name) values(${P},${W},'Projeto de origem')`;
  const sid = await start(r);
  const e = (await db`select engagement_id from hiring_execution_starts where id=${sid}`)[0]
    .engagement_id;
  await db`update hiring_area_policies set revision=revision+1 where area_id=${A}`;
  await expect(
    user(M, (tx) => tx`select hiring_allocate(${W},${e},${P},current_date,null,20,null)`),
  ).rejects.toThrow("assinatura íntegra");
  expect((await execContext(r.id)).start.signature_intact).toBe(false);
  expect((await db`select count(*)::int n from hiring_execution_starts where id=${sid}`)[0].n).toBe(
    1,
  );
  expect((await db`select status from contracts where id=${k}`)[0].status).toBe("active");
});
it("execution context is read-only and denies foreign or unauthorized readers", async () => {
  const { r } = await signed();
  const before =
    await db`select (select count(*) from hiring_execution_starts)+(select count(*) from hiring_engagements)+(select count(*) from hiring_formalization_events) n`;
  const c = await execContext(r.id);
  expect(c).toMatchObject({ status: "ready", can_start: true, start: null });
  expect(JSON.stringify(c)).not.toContain("22000");
  const after =
    await db`select (select count(*) from hiring_execution_starts)+(select count(*) from hiring_engagements)+(select count(*) from hiring_formalization_events) n`;
  expect(after[0].n).toBe(before[0].n);
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await expect(execContext(r.id, U)).rejects.toThrow("indisponível");
});
it.each(["missing", "deny", "inactive", "foreign"] as const)(
  "package5 current manager %s blocks new allocations without rewriting the start",
  async (scenario) => {
    const { r } = await signed();
    const project = randomUUID();
    await db`insert into projects(id,workspace_id,name) values(${project},${W},'Projeto de teste isolado')`;
    const sid = await start(r);
    const before = (await db`select * from hiring_execution_starts where id=${sid}`)[0];
    const engagement = before.engagement_id;
    if (scenario === "missing")
      await db`delete from job_role_permission_overrides where role_id=${M} and permission_key=${KEY}`;
    if (scenario === "deny")
      await db`update job_role_permission_overrides set effect='deny' where role_id=${M} and permission_key=${KEY}`;
    if (scenario === "inactive")
      await db`update workspace_members set status='inactive' where user_id=${M} and workspace_id=${W}`;
    if (scenario === "foreign")
      await db`update profiles set active_workspace_id=${B} where id=${M}`;
    await expect(
      user(
        M,
        (tx) =>
          tx`select hiring_allocate(${W},${engagement},${project},current_date,null,20,'Alocação após revogação deve ser bloqueada.')`,
      ),
    ).rejects.toThrow(/assinatura íntegra|autoriza|permissão|acesso/);
    expect((await db`select * from hiring_execution_starts where id=${sid}`)[0]).toEqual(before);
    expect((await db`select status from hiring_engagements where id=${engagement}`)[0].status).toBe(
      "active",
    );
    expect(
      (
        await db`select count(*)::int n from people_allocations where hiring_engagement_id=${engagement}`
      )[0].n,
    ).toBe(0);
  },
);
it("execution ATS regression: legacy job engagements keep the unchanged recruitment gate", async () => {
  await reset();
  const job = randomUUID(),
    k = randomUUID(),
    P = randomUUID();
  await db`insert into ats_jobs(id,workspace_id) values(${job},${W})`;
  await db.begin(async (tx) => {
    await tx`select set_config('app.hiring_purchase','on',true)`;
    await tx`insert into contracts(id,workspace_id,title,role,document_kind,hiring_person_id,contracting_legal_entity_id,status,starts_at) values(${k},${W},'Legacy','client','main',${D},${L},'active',current_date)`;
  });
  await expect(
    db`insert into hiring_engagements(workspace_id,person_id,purpose,employment_type,legal_entity_id,starts_at,created_by) values(${W},${D},'internal','pj',${L},current_date,${U})`,
  ).rejects.toThrow("hiring_engagement_origin");
  const e = (
    await db`insert into hiring_engagements(workspace_id,person_id,job_id,purpose,employment_type,legal_entity_id,purchase_contract_id,model_version_id,starts_at,created_by) values(${W},${D},${job},'internal','pj',${L},${k},${randomUUID()},current_date,${U}) returning id`
  )[0].id;
  await db`insert into projects(id,workspace_id,name) values(${P},${W},'Projeto ATS')`;
  await expect(
    user(M, (tx) => tx`select hiring_allocate(${W},${e},${P},current_date,null,50,null)`),
  ).rejects.toThrow("Autorização ATS");
  await db`update ats_jobs set recruitment_authorized=true where id=${job}`;
  expect(
    await user(M, (tx) =>
      tx`select hiring_allocate(${W},${e},${P},current_date,null,50,null) v`.then((x) => x[0].v),
    ),
  ).toBeTruthy();
});
it("execution ATS regression: legacy allocation guard text is preserved byte-for-byte", () => {
  const legacy = readFileSync(
    "drizzle/migrations/0312_hiring_allocation_access_and_invites.sql",
    "utf8",
  );
  const prepared = readFileSync(PREPARED, "utf8");
  const pick = (s: string) =>
    s.slice(
      s.indexOf("FUNCTION public.hiring_allocation_guard()"),
      s.indexOf("END $$;", s.indexOf("FUNCTION public.hiring_allocation_guard()")),
    );
  const branch = /\n IF e\.hiring_request_id IS NOT NULL THEN\n[\s\S]*?\n END IF;/;
  expect(pick(prepared).replace(branch, "")).toBe(pick(legacy));
});
it("execution ACL: private helpers are not executable by authenticated or anon", async () => {
  for (const fn of [
    "hiring_execution_problem(uuid,uuid)",
    "hiring_execution_manager(uuid,uuid)",
    "hiring_execution_subject(uuid,uuid,text)",
    "hiring_execution_activation_ok(uuid,uuid)",
    "hiring_execution_allocation_assert(uuid,uuid,uuid,uuid,uuid,date,date,numeric,text,boolean)",
  ])
    for (const role of ["authenticated", "anon"])
      expect((await db`select has_function_privilege(${role},${fn},'execute') v`)[0].v).toBe(false);
  expect(
    (
      await db`select has_function_privilege('anon','hiring_execution_start(uuid,uuid,integer,date,date,text,uuid)','execute') v`
    )[0].v,
  ).toBe(false);
  expect(
    (await db`select has_table_privilege('authenticated','hiring_execution_starts','insert') v`)[0]
      .v,
  ).toBe(false);
});
