import {
  captureDisposableHiringSnapshot,
  restoreDisposableHiringSnapshot,
  type DisposableHiringSnapshot,
} from "../../../../tests/fixtures/disposable-hiring-snapshot";
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
const BATCH_B = "drizzle/migrations/0382_hiring_execution_deliveries_fiscal.sql";
const BATCH_C1 = "drizzle/migrations/0383_hiring_economic_plans_provisions.sql";
// Package 4 batch C1 (PLANO-PROVISAO): same disposable bootstrap as batch B plus prepared 0383.
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
const container = "techerp-economics-ci-" + randomUUID();
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
  root = mkdtempSync(join(tmpdir(), "hiring-economics-pg-"));
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
      `-k ${root} -h '' -p 55449 -F -c jit=off`,
      "-w",
      "start",
    ]);
    started = true;
    db = postgres({
      host: root,
      port: 55449,
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
    "CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])",
  );
  // Batch B fixture: canonical tax ids and milestones (production columns), then the real prepared SQL.
  await db.unsafe(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS cnpj text;ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj text;ALTER TABLE people ADD COLUMN IF NOT EXISTS cnpj text;
    ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS metadata jsonb;ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS owner uuid;
    CREATE TABLE project_milestones(id uuid PRIMARY KEY,workspace_id uuid,project_id uuid,name text,billable boolean DEFAULT false,bill_amount numeric,financial_entry_id uuid);
    ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fixture_milestone_read ON project_milestones FOR SELECT TO authenticated USING(workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND is_workspace_member(workspace_id,auth.uid()));`);
  await db.begin(async (tx) => {
    await tx.unsafe(readFileSync(BATCH_B, "utf8"));
  });
  // C1 fixture: production-shaped provision table (0316+0318 columns/constraints) and canonical time tables (0174 columns).
  await db.unsafe(`CREATE TABLE hiring_monthly_provisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,config_id uuid,contract_id uuid NOT NULL REFERENCES contracts(id),
      legal_entity_id uuid NOT NULL REFERENCES legal_entities(id),period_from date NOT NULL,period_to date NOT NULL,currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),revision integer NOT NULL CHECK(revision>0),
      supersedes_id uuid REFERENCES hiring_monthly_provisions(id),snapshot jsonb NOT NULL,source_hash text NOT NULL,closed_by uuid NOT NULL,closed_at timestamptz NOT NULL DEFAULT now(),reason text NOT NULL CHECK(length(btrim(reason))>=10),
      kind text NOT NULL DEFAULT 'revenue' CHECK(kind IN('revenue','cost')),CHECK((kind='revenue' AND config_id IS NOT NULL) OR (kind='cost' AND config_id IS NULL)));
    CREATE UNIQUE INDEX hiring_cost_provision_revision ON hiring_monthly_provisions(contract_id,period_from,revision) WHERE kind='cost';
    CREATE FUNCTION hiring_provision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Provisão imutável: crie uma revisão justificada.';END $$;
    CREATE TRIGGER hiring_provision_immutable BEFORE UPDATE OR DELETE ON hiring_monthly_provisions FOR EACH ROW EXECUTE FUNCTION hiring_provision_immutable();
    REVOKE ALL ON hiring_monthly_provisions FROM anon,authenticated,techerp_request_writer;
    CREATE TABLE project_period_closings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,scope text,project_id uuid,user_id uuid,period_from date,period_to date,status text CHECK(status IN('closed','reopened')));
    CREATE TABLE project_time_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,project_id uuid,person_id uuid,user_id uuid,allocation_id uuid,entry_date date,status text DEFAULT 'draft',source text DEFAULT 'manual',
      duration_seconds bigint,revision integer DEFAULT 1,period_closing_id uuid REFERENCES project_period_closings(id),invoice_id uuid,financial_entry_id uuid);
    REVOKE ALL ON project_time_entries,project_period_closings FROM anon,authenticated,techerp_request_writer;`);
  await db.unsafe(`
    ALTER TABLE project_period_closings ADD COLUMN entries_snapshot jsonb NOT NULL DEFAULT '[]';
    ALTER TABLE project_time_entries ADD COLUMN approved_at timestamptz,ADD COLUMN approved_by uuid;
    CREATE TABLE fixture_field_rules(user_id uuid PRIMARY KEY,rules jsonb);
    CREATE TABLE shared_field_catalog(resource text,table_name text,field text,guard_fields text[]);
    INSERT INTO shared_field_catalog(resource,table_name,field) VALUES
      ('techfinance.entries','financial_entries','amount'),('techcontracts.contracts','contracts','total_value'),('techcontracts.contracts','contracts','monthly_value'),('techprojects.rates','project_rates','amount'),('techpeople.people','people','monthly_cost'),('techpeople.people','people','cost_hour');
    CREATE FUNCTION shared_field_context() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT jsonb_build_object('rules',coalesce((SELECT rules FROM fixture_field_rules WHERE user_id=auth.uid()),'{}'::jsonb)) $$;
    GRANT SELECT ON project_time_entries TO authenticated;
    ALTER TABLE project_time_entries ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fixture_time_read ON project_time_entries FOR SELECT TO authenticated USING(workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND is_workspace_member(workspace_id,auth.uid()) AND work_record_access('techprojects.projects',project_id,'view'));
    ALTER TABLE hiring_monthly_provisions ENABLE ROW LEVEL SECURITY;
  `);
  await db.unsafe(
    body("drizzle/migrations/0228_order5_fields_prepare.sql", "public.shared_field_mode_for"),
  );
  await db.unsafe(
    "CREATE TABLE project_billing_configs(id uuid PRIMARY KEY,workspace_id uuid,contract_id uuid)",
  );
  await db.unsafe(
    "INSERT INTO permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('techprojects.rates.view.workspace','techprojects','rates','view','workspace','Ver tarifas','Fixture of canonical legacy key',true) ON CONFLICT DO NOTHING",
  );
  await db.unsafe(
    body("drizzle/migrations/0316_hiring_monthly_provisions.sql", "public.hiring_provision_access"),
  );
  await db.unsafe(
    body(
      "drizzle/migrations/0318_hiring_internal_cost_provisions.sql",
      "public.hiring_cost_provision_access",
    ),
  );
  for (const name of [
    "public.hiring_provision_preview",
    "public.hiring_provision_close",
    "public.hiring_provision_context",
  ])
    await db.unsafe(body("drizzle/migrations/0318_hiring_internal_cost_provisions.sql", name));
  await db.begin(async (tx) => {
    await tx.unsafe(readFileSync(BATCH_C1, "utf8"));
  });
  await db.unsafe(
    "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated; GRANT USAGE ON SCHEMA storage TO authenticated",
  );
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
    await db`insert into legal_entities(id,workspace_id,name,cnpj) values(${L},${W},'WK fixture','11.222.333/0001-81')`;
    await db`insert into people(id,workspace_id,full_name,email,cnpj) values(${D},${W},'Pessoa real fixture','pessoa@example.test','22333444000190')`;
    await db`insert into companies(id,workspace_id,name,cnpj) values(${C},${W},'Fornecedor fixture','33444555000100')`;
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
async function sentDraft(regime = "pj") {
  const r = await approved("professional", regime),
    k = await prepare(r);
  await user(
    U,
    (tx) =>
      tx`update contracts set body_html='Documento real revisado com condições e partes conferidas.',starts_at=${PREV}::date where id=${k}`,
  );
  await transition(r, "submit");
  await transition(r, "legal", M);
  return { r, k, token: await transition(r, "link") };
}
async function signingDraft(regime = "pj") {
  const x = await sentDraft(regime);
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
const PREV = (() => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
})();
async function signed(kind = "professional", regime = "pj") {
  const x = kind === "professional" ? await signingDraft(regime) : await signingSupplier();
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
      tx`update contracts set body_html='Condições e cláusulas de compra revisadas',starts_at=${PREV}::date where id=${k}`,
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

// ---------------- Batch C1: economic plan, eligible calculation and management provision ----------------
const startedFixtures = new Map<
  string,
  { data: Awaited<ReturnType<typeof buildStartedRequest>>; snapshot: DisposableHiringSnapshot }
>();
async function buildStartedRequest(kind: string, regime: string) {
  const x = await signed(kind, regime);
  const sid = await start(x.r, M, randomUUID(), W, PREV);
  return { ...x, sid };
}
async function startedRequest(kind = "professional", regime = "pj") {
  const key = JSON.stringify([kind, regime]);
  const cached = startedFixtures.get(key);
  if (cached) {
    await restoreDisposableHiringSnapshot(db, cached.snapshot);
    // The cached setup must preserve the current real signature verifier, not a fabricated success flag.
    expect((await db`select hiring_formalization_signed(${W},${cached.data.k}) v`)[0].v).toBe(true);
    return structuredClone(cached.data);
  }
  const data = await buildStartedRequest(kind, regime);
  startedFixtures.set(key, {
    data: structuredClone(data),
    snapshot: await captureDisposableHiringSnapshot(db),
  });
  return data;
}

type R = { id: string; revision: number };
const save = (
  r: R,
  o: Partial<{
    u: string;
    w: string;
    delivery: string | null;
    version: number | null;
    responsible: string;
    project: string | null;
    milestone: string | null;
    reason: string | null;
    op: string;
    title: string;
    periodStart: string;
    periodEnd: string;
  }> = {},
) =>
  user(o.u ?? U, (tx) =>
    tx`select hiring_delivery_save(${o.w ?? W},${r.id},${o.delivery ?? null},${o.version ?? null},${o.title ?? "Entrega mensal de sustentação"},'Critério: chamados críticos resolvidos dentro do SLA acordado.',coalesce(${o.periodStart ?? null}::date,current_date),coalesce(${o.periodEnd ?? null}::date,current_date),${o.responsible ?? M},${o.project ?? null},${o.milestone ?? null},${o.reason ?? null},${o.op ?? randomUUID()}) v`.then(
      (x) => x[0].v as string,
    ),
  );
const submit = (r: R, d: string, version = 1, u = U, w = W, op = randomUUID()) =>
  user(u, (tx) =>
    tx`select hiring_delivery_submit(${w},${r.id},${d},${version},'Relatório de chamados anexado ao projeto.',${op}) v`.then(
      (x) => x[0].v as string,
    ),
  );
const currentHash = async (d: string) =>
  (
    await db`select v.content_hash h from hiring_execution_delivery_versions v join hiring_execution_deliveries d on d.id=v.delivery_id and d.version=v.version where d.id=${d}`
  )[0].h as string;
const decide2 = async (
  r: R,
  d: string,
  o: Partial<{
    u: string;
    w: string;
    version: number;
    hash: string;
    decision: string;
    op: string;
  }> = {},
) => {
  const hash = o.hash ?? (await currentHash(d));
  return user(o.u ?? M, (tx) =>
    tx`select hiring_delivery_decide(${o.w ?? W},${r.id},${d},${o.version ?? 1},${hash},${o.decision ?? "accepted"},'Critérios conferidos pessoalmente.',${o.op ?? randomUUID()}) v`.then(
      (x) => x[0].v as string,
    ),
  );
};

const P = "ffffffff-0000-4000-8000-000000000001",
  P2 = "ffffffff-0000-4000-8000-000000000002";
type Comp = Record<string, unknown>;
const monthly = (o: Comp = {}): Comp => ({
  type: "monthly",
  amount: 9300,
  source_clause: "Cláusula 4.1 — remuneração mensal",
  due_days: 10,
  proration: "calendar_days",
  ...o,
});
const hourly = (o: Comp = {}): Comp => ({
  type: "hourly",
  amount: 120,
  source_clause: "Cláusula 4.2 — valor por hora aprovada",
  due_days: 15,
  ...o,
});
type PlanOpts = Partial<{
  u: string;
  w: string;
  plan: string | null;
  version: number | null;
  modality: string | null;
  components: Comp[];
  from: string;
  reason: string | null;
  op: string;
}>;
const plan = (r: R, o: PlanOpts = {}) =>
  user(o.u ?? U, (tx) =>
    tx`select hiring_econ_save(${o.w ?? W},${r.id},${o.plan ?? null},${o.version ?? null},${o.modality === undefined ? "monthly" : o.modality},'BRL',${o.from ?? PREV}::date,null,${tx.json((o.components ?? [monthly()]) as never)},'Instrumento assinado, seção 4',${o.reason ?? null},${o.op ?? randomUUID()}) v`.then(
      (x) => x[0].v as string,
    ),
  );
const planHash = async (p: string) =>
  (
    await db`select v.content_hash h from hiring_economic_plan_versions v join hiring_economic_plans p on p.id=v.plan_id and p.version=v.version where p.id=${p}`
  )[0].h as string;
const move = async (
  r: R,
  p: string,
  action: string,
  u = U,
  o: Partial<{ w: string; version: number; hash: string; op: string }> = {},
) => {
  const hash = o.hash ?? (await planHash(p));
  return user(u, (tx) =>
    tx`select hiring_econ_transition(${o.w ?? W},${r.id},${p},${o.version ?? 1},${hash},${action},'Conferido contra a cláusula assinada.',${o.op ?? randomUUID()}) v`.then(
      (x) => x[0].v as string,
    ),
  );
};
const econ = (id: string, u = CEO, w = W) =>
  user(u, (tx) =>
    tx`select hiring_econ_context(${w},${id}) v`.then((x) => x[0].v as Record<string, any>),
  );
const preview = (r: R, month = PREV, u = CEO, w = W) =>
  user(u, (tx) =>
    tx`select hiring_econ_provision_preview(${w},${r.id},${month}::date) v`.then(
      (x) => x[0].v as Record<string, any>,
    ),
  );
const close = (r: R, hash: string, prev: string | null = null, month = PREV, u = CEO, w = W) =>
  user(u, (tx) =>
    tx`select hiring_econ_provision_close(${w},${r.id},${month}::date,${hash},${prev},'Fechamento gerencial da competência encerrada.') v`.then(
      (x) => x[0].v as string,
    ),
  );
async function buildApprovedPlan(o: PlanOpts, kind: string, regime: string) {
  const x = await startedRequest(kind, regime);
  const p = await plan(x.r, o);
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  return { ...x, p };
}
const approvedFixtures = new Map<
  string,
  { data: Awaited<ReturnType<typeof buildApprovedPlan>>; snapshot: DisposableHiringSnapshot }
>();
async function approvedPlan(o: PlanOpts = {}, kind = "professional", regime = "pj") {
  // Custom components/periods always execute their own current plan setup; only the unchanged default fixture is reused.
  if (Object.keys(o).length) return buildApprovedPlan(o, kind, regime);
  const key = JSON.stringify([kind, regime]);
  const cached = approvedFixtures.get(key);
  if (cached) {
    await restoreDisposableHiringSnapshot(db, cached.snapshot);
    expect((await db`select hiring_formalization_signed(${W},${cached.data.k}) v`)[0].v).toBe(true);
    return structuredClone(cached.data);
  }
  const data = await buildApprovedPlan(o, kind, regime);
  approvedFixtures.set(key, {
    data: structuredClone(data),
    snapshot: await captureDisposableHiringSnapshot(db),
  });
  return data;
}

async function engagement(r: R) {
  await db`insert into projects(id,workspace_id,name) values(${P},${W},'Projeto real'),(${P2},${W},'Projeto paralelo') on conflict do nothing`;
  const e = (await db`select id from hiring_engagements where hiring_request_id=${r.id}`)[0].id;
  const a = await user(M, (tx) =>
    tx`select hiring_allocate(${W},${e},${P},${PREV}::date,null,50,null) v`.then(
      (x) => x[0].v as string,
    ),
  );
  return { e, a };
}
async function entry(
  a: string | null,
  o: Partial<{
    status: string;
    source: string;
    seconds: number;
    closing: string | null;
    project: string;
    day: number;
  }> = {},
) {
  const id = randomUUID();
  await db`insert into project_time_entries(id,workspace_id,project_id,person_id,user_id,allocation_id,entry_date,status,source,duration_seconds,period_closing_id,approved_at,approved_by)
    values(${id},${W},${o.project ?? P},${D},${D},${a},${PREV}::date + ${o.day ?? 2}::int,${o.status ?? "approved"},${o.source ?? "manual"},${o.seconds ?? 3600},${o.closing === undefined ? null : o.closing},now(),${M})`;
  if (o.closing)
    await db`update project_period_closings set entries_snapshot=entries_snapshot || (select jsonb_build_array(jsonb_build_object('id',id,'revision',revision,'user_id',user_id,'project_id',project_id,'entry_date',entry_date,'seconds',duration_seconds,'approved_at',approved_at)) from project_time_entries where id=${id}) where id=${o.closing}`;
  return id;
}
const closing = async (status = "closed") =>
  (
    await db`insert into project_period_closings(workspace_id,scope,project_id,period_from,period_to,status) values(${W},'project',${P},${PREV}::date,(${PREV}::date + interval '1 month - 1 day')::date,${status}) returning id`
  )[0].id as string;
const monthDays = () => {
  const d = new Date(PREV + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
};

type EAction = "save" | "submit" | "decide" | "view" | "preview" | "close";
const EACTIONS: Record<EAction, { keys: string[]; actor: string }> = {
  save: { keys: ["economics.manage"], actor: U },
  submit: { keys: ["economics.manage"], actor: U },
  decide: { keys: ["economics.approve"], actor: CEO },
  view: { keys: ["economics.view"], actor: CEO },
  preview: { keys: ["provisions.manage"], actor: CEO },
  close: { keys: ["provisions.approve"], actor: CEO },
};
async function escenario(
  action: EAction,
  mode: "allowed" | "missing" | "deny" | "foreign" | "inactive",
) {
  let run: (w: string) => Promise<unknown>;
  if (action === "save") {
    const x = await startedRequest();
    run = (w) => plan(x.r, { w });
  } else if (action === "submit" || action === "decide") {
    const x = await startedRequest();
    const p = await plan(x.r);
    if (action === "decide") await move(x.r, p, "submitted");
    run = (w) =>
      action === "submit"
        ? move(x.r, p, "submitted", U, { w })
        : move(x.r, p, "approved", CEO, { w });
  } else {
    const x = await approvedPlan();
    if (action === "view")
      run = (w) =>
        econ(x.r.id, CEO, w).then((c) => {
          if (!c.can_view || !c.versions.length) throw Error("Sem permissão (oculto)");
          return "ok";
        });
    else if (action === "preview") run = (w) => preview(x.r, PREV, CEO, w);
    else {
      const h = (await preview(x.r)).hash as string;
      run = (w) => close(x.r, h, null, PREV, CEO, w);
    }
  }
  const { keys, actor } = EACTIONS[action];
  for (const key of keys) {
    const full = prefix("professional") + "." + key + ".workspace";
    if (mode === "missing")
      await db`delete from job_role_permission_overrides where role_id=${actor} and permission_key=${full}`;
    if (mode === "deny")
      await db`update job_role_permission_overrides set effect='deny' where role_id=${actor} and permission_key=${full}`;
  }
  if (mode === "inactive")
    await db`update workspace_members set status='inactive' where user_id=${actor}`;
  return run(mode === "foreign" ? B : W).then(
    (v) => (v ? "ok" : "empty"),
    (e: Error) => e.message,
  );
}
const DENIED = /Sem permissão|indisponível/;
it("econ save plan allowed", async () => expect(await escenario("save", "allowed")).toBe("ok"));
it("econ save plan rejects missing key", async () =>
  expect(await escenario("save", "missing")).toMatch(DENIED));
it("econ save plan rejects explicit deny", async () =>
  expect(await escenario("save", "deny")).toMatch(DENIED));
it("econ save plan rejects foreign workspace", async () =>
  expect(await escenario("save", "foreign")).toMatch(DENIED));
it("econ save plan rejects inactive member", async () =>
  expect(await escenario("save", "inactive")).toMatch(DENIED));
for (const action of ["submit", "decide", "view", "preview", "close"] as EAction[]) {
  it(`econ ${action} allowed`, async () => expect(await escenario(action, "allowed")).toBe("ok"));
  it(`econ ${action} rejects missing key`, async () =>
    expect(await escenario(action, "missing")).toMatch(DENIED));
  it(`econ ${action} rejects explicit deny`, async () =>
    expect(await escenario(action, "deny")).toMatch(DENIED));
  it(`econ ${action} rejects foreign workspace`, async () =>
    expect(await escenario(action, "foreign")).toMatch(DENIED));
  it(`econ ${action} rejects inactive member`, async () =>
    expect(await escenario(action, "inactive")).toMatch(DENIED));
}
it("econ provisions also require the canonical TechFinance key", async () => {
  const x = await approvedPlan();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${CEO} and permission_key='techfinance.provisions.manage.workspace'`;
  await expect(preview(x.r)).rejects.toThrow("Sem permissão");
});
it("econ amounts need private contract and person access", async () => {
  const x = await approvedPlan();
  await db`delete from people where id=${D}`.catch(() => undefined);
  await db`update people set workspace_id=${B} where id=${D}`;
  const c = await econ(x.r.id);
  expect(c.can_view).toBe(false);
  expect(c.versions).toEqual([]);
  await expect(preview(x.r)).rejects.toThrow("Sem permissão");
});
it("econ modality is explicit and never inherited from the demand default", async () => {
  const x = await startedRequest();
  await expect(plan(x.r, { modality: null })).rejects.toThrow("modalidade");
  await expect(plan(x.r, { modality: "delivery" })).rejects.toThrow("modalidade escolhida");
});
it("econ monthly needs an explicit proration rule and amount", async () => {
  const x = await startedRequest();
  await expect(plan(x.r, { components: [monthly({ proration: null })] })).rejects.toThrow(
    "regra explícita",
  );
  await expect(plan(x.r, { components: [monthly({ amount: 0 })] })).rejects.toThrow("valor");
  await expect(plan(x.r, { components: [monthly({ due_days: null })] })).rejects.toThrow(
    "vencimento",
  );
  await expect(plan(x.r, { components: [monthly({ source_clause: "" })] })).rejects.toThrow(
    "cláusula",
  );
});
it("econ mixed requires distinct types, sources and explicit hour projects", async () => {
  const x = await startedRequest();
  await expect(
    plan(x.r, {
      modality: "mixed",
      components: [monthly(), monthly({ source_clause: "Outra cláusula" })],
    }),
  ).rejects.toThrow("Apenas um componente mensal");
  await expect(plan(x.r, { modality: "mixed", components: [hourly()] })).rejects.toThrow(
    "tipos distintos",
  );
  await expect(
    plan(x.r, {
      modality: "mixed",
      components: [monthly(), hourly({ source_clause: "Cláusula 4.1 — remuneração mensal" })],
    }),
  ).rejects.toThrow("mesma fonte");
  await expect(plan(x.r, { modality: "mixed", components: [monthly(), hourly()] })).rejects.toThrow(
    "projeto explícito",
  );
  await db`insert into projects(id,workspace_id,name) values(${P},${W},'Projeto real')`;
  expect(
    await plan(x.r, { modality: "mixed", components: [monthly(), hourly({ project_id: P })] }),
  ).toBeTruthy();
});
it("econ hourly components need distinct explicit projects", async () => {
  const x = await startedRequest();
  await db`insert into projects(id,workspace_id,name) values(${P},${W},'Projeto real')`;
  await expect(
    plan(x.r, {
      modality: "hourly",
      components: [
        hourly({ project_id: P }),
        hourly({ project_id: P, source_clause: "Cláusula 9" }),
      ],
    }),
  ).rejects.toThrow("projetos distintos");
});
it("econ supplier cannot price canonical hours", async () => {
  const x = await startedRequest("supplier");
  await expect(plan(x.r, { u: M, modality: "hourly", components: [hourly()] })).rejects.toThrow(
    "Horas canônicas",
  );
});
it("econ delivery component pins the exact version of a delivery from this request", async () => {
  const x = await startedRequest();
  await expect(
    plan(x.r, {
      modality: "delivery",
      components: [
        {
          type: "delivery",
          amount: 5000,
          source_clause: "Cláusula 5",
          due_days: 5,
          delivery_id: randomUUID(),
          delivery_version: 1,
        },
      ],
    }),
  ).rejects.toThrow("versão exata");
  const d = await save(x.r);
  const comp = {
    type: "delivery",
    amount: 5000,
    source_clause: "Cláusula 5",
    due_days: 5,
    delivery_id: d,
    delivery_version: 1,
  };
  await expect(
    plan(x.r, {
      modality: "delivery",
      components: [comp, { ...comp, source_clause: "Cláusula 6" }],
    }),
  ).rejects.toThrow("duas vezes");
  const p = await plan(x.r, { modality: "delivery", components: [comp] });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  // Not accepted yet: unknown line, closing would be refused.
  let v = await preview(x.r, today());
  expect(v.lines[0].issue).toBe("not_accepted");
  await submit(x.r, d);
  await decide2(x.r, d);
  v = await preview(x.r, today());
  expect(v.lines[0].amount).toBe(5000);
  expect(v.totals.unknown_lines).toBe(0);
  // Fixed price: no hours involved, and a new delivery version makes the source stale.
  await save(x.r, { delivery: d, version: 1, reason: "Escopo da entrega revisado" });
  v = await preview(x.r, today());
  expect(v.lines[0].issue).toBe("delivery_version_changed");
});
it("econ only the configured Finance user decides, never the author or submitter", async () => {
  const x = await startedRequest();
  const p = await plan(x.r, { u: CEO });
  await move(x.r, p, "submitted", CEO);
  await expect(move(x.r, p, "approved", CEO)).rejects.toThrow("montou ou enviou");
  await expect(move(x.r, p, "approved", M)).rejects.toThrow("Financeiro configurado");
  await db`update contract_handoff_settings set finance_user_id=null where workspace_id=${W}`;
  await expect(move(x.r, p, "approved", M)).rejects.toThrow("Configure o responsável Financeiro");
});
it("econ decisions bind the exact version hash and edits invalidate future approval", async () => {
  const x = await startedRequest();
  const p = await plan(x.r);
  await move(x.r, p, "submitted");
  await expect(move(x.r, p, "approved", CEO, { hash: "0".repeat(64) })).rejects.toThrow("STALE");
  await move(x.r, p, "approved", CEO);
  await expect(plan(x.r, { plan: p, version: 1 })).rejects.toThrow("Justifique");
  await plan(x.r, {
    plan: p,
    version: 1,
    reason: "Valor mensal corrigido conforme aditivo",
    components: [monthly({ amount: 9900 })],
  });
  const c = await econ(x.r.id);
  expect(c.plan).toMatchObject({ version: 2, status: "draft" });
  expect(c.events.map((e: { kind: string }) => e.kind)).toEqual(["submitted", "approved"]);
  expect(c.versions).toHaveLength(2);
  await expect(preview(x.r)).rejects.toThrow("plano econômico aprovado");
  await expect(move(x.r, p, "approved", CEO, { version: 1 })).rejects.toThrow("REVISION_CONFLICT");
  await expect(
    db`update hiring_economic_plan_versions set currency='USD' where plan_id=${p}`,
  ).rejects.toThrow();
  await expect(db`delete from hiring_economic_plan_events where plan_id=${p}`).rejects.toThrow();
});
it("econ save is idempotent by operation and conflicts on concurrent edits", async () => {
  const x = await startedRequest();
  const op = randomUUID();
  const p = await plan(x.r, { op });
  expect(await plan(x.r, { op })).toBe(p);
  const both = await Promise.allSettled([
    plan(x.r, { plan: p, version: 1, reason: "Primeira revisão concorrente" }),
    plan(x.r, { plan: p, version: 1, reason: "Segunda revisão concorrente" }),
  ]);
  expect(both.filter((b) => b.status === "fulfilled")).toHaveLength(1);
  await expect(plan(x.r)).rejects.toThrow("REVISION_CONFLICT");
});
it("econ blocks when signature, revision or area policy changed after start", async () => {
  const x = await startedRequest();
  await db`update hiring_area_policies set revision=2 where area_id=${A}`;
  await expect(plan(x.r)).rejects.toThrow("alçada");
});
it("econ blocks a revoked signature after the economic plan was prepared", async () => {
  const x = await startedRequest();
  const p = await plan(x.r);
  await db`update hiring_contract_evidence set revoked_at=now() where contract_id=${x.k}`;
  await expect(move(x.r, p, "submitted")).rejects.toThrow("assinatura");
});
it("econ read-only view-as cannot write plans or close provisions", async () => {
  const x = await approvedPlan();
  const session = randomUUID();
  await db`insert into view_as_sessions values(${session},'role',null)`;
  const ro = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    db.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: CEO, role: "authenticated", session_id: session })},true)`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      return fn(tx);
    });
  const h = (await preview(x.r)).hash;
  await expect(
    ro(
      (tx) =>
        tx`select hiring_econ_provision_close(${W},${x.r.id},${PREV}::date,${h},null,'Fechamento indevido em ver-como.')`,
    ),
  ).rejects.toThrow("permissão");
  await expect(
    ro(
      (tx) =>
        tx`select hiring_econ_save(${W},${x.r.id},${x.p},1,'monthly','BRL',${PREV}::date,null,${tx.json([monthly()] as never)},'Seção 4 conferida','Tentativa em ver-como',${randomUUID()})`,
    ),
  ).rejects.toThrow("permissão");
  const c = await ro((tx) => tx`select hiring_econ_context(${W},${x.r.id}) v`.then((r) => r[0].v));
  expect(c).toMatchObject({ can_manage: false, can_close: false, can_decide: false });
});
it("econ monthly calendar proration uses real calendar days, never 30 days", async () => {
  const from = new Date(PREV + "T00:00:00Z");
  from.setUTCDate(11);
  const x = await approvedPlan({ from: from.toISOString().slice(0, 10) });
  const v = await preview(x.r);
  const days = monthDays() - 10;
  expect(v.lines[0]).toMatchObject({ type: "monthly", days, month_days: monthDays() });
  expect(Number(v.lines[0].amount)).toBe(Math.round((9300 * days * 100) / monthDays()) / 100);
  expect(v.notice).toContain("Não é título");
});
it("econ full-month rule keeps the integral amount", async () => {
  const x = await approvedPlan({ components: [monthly({ proration: "full_month" })] });
  expect(Number((await preview(x.r)).lines[0].amount)).toBe(9300);
});
it("econ hours count only approved, closed, non-imported entries of this engagement", async () => {
  const x = await startedRequest();
  const { a } = await engagement(x.r);
  const p = await plan(x.r, { modality: "hourly", components: [hourly()] });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  const cl = await closing(),
    open = await closing("reopened");
  await entry(a, { closing: cl, seconds: 5400 });
  await entry(a, { closing: cl, seconds: 1800, day: 3 });
  await entry(a, { closing: cl, source: "import" });
  await entry(a, { closing: cl, status: "submitted" });
  await entry(a, { closing: open });
  await entry(a, { closing: null });
  await entry(null, { closing: cl });
  const v = await preview(x.r);
  expect(v.lines[0]).toMatchObject({ type: "hourly", seconds: 7200, amount: 240 });
  expect(v.lines[0].entries).toHaveLength(2);
  expect(v.lines[0].excluded.count).toBe(5);
  expect(v.totals.unknown_lines).toBe(1);
  await expect(close(x.r, v.hash)).rejects.toThrow("fontes de horas pendentes");
  expect(v.lines[0].amount).not.toBe(Number(160 * 120));
});
it("econ provision closes only ended months with fresh sources and chained immutable revisions", async () => {
  const x = await startedRequest();
  const { a } = await engagement(x.r);
  const p = await plan(x.r, { modality: "hourly", components: [hourly()] });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  const cl = await closing();
  await entry(a, { closing: cl });
  const current = await preview(x.r, today());
  await expect(close(x.r, current.hash, null, today())).rejects.toThrow("mês encerrado");
  const v1 = await preview(x.r);
  await entry(a, { closing: cl, day: 4 });
  await expect(close(x.r, v1.hash)).rejects.toThrow("STALE");
  const v2 = await preview(x.r);
  const first = await close(x.r, v2.hash);
  expect(await close(x.r, v2.hash)).toBe(first);
  expect(await close(x.r, v2.hash, first)).toBe(first);
  await entry(a, { closing: cl, day: 5 });
  const v3 = await preview(x.r);
  const second = await close(x.r, v3.hash, first);
  const rows =
    await db`select id,kind,config_id,revision,supersedes_id,source_hash from hiring_monthly_provisions order by revision`;
  expect(rows.map((r) => [r.kind, r.config_id, r.revision, r.supersedes_id])).toEqual([
    ["cost", null, 1, null],
    ["cost", null, 2, first],
  ]);
  expect(rows[1].id).toBe(second);
  await expect(
    db`update hiring_monthly_provisions set reason='alterado indevidamente' where id=${first}`,
  ).rejects.toThrow("imutável");
  // Sales billing links on time entries are never touched.
  expect(
    (
      await db`select count(*)::int n from project_time_entries where invoice_id is not null or financial_entry_id is not null`
    )[0].n,
  ).toBe(0);
});
it("econ concurrent closes of the same month create a single revision", async () => {
  const x = await approvedPlan();
  const h = (await preview(x.r)).hash;
  const both = await Promise.allSettled([close(x.r, h), close(x.r, h)]);
  expect(both.filter((b) => b.status === "fulfilled")).toHaveLength(2);
  expect((await db`select count(*)::int n from hiring_monthly_provisions`)[0].n).toBe(1);
});
it("econ provision refuses unknown lines and isolates supplier plans by contract", async () => {
  const x = await startedRequest("supplier");
  const d = await save(x.r, { u: M, responsible: U, periodStart: PREV, periodEnd: PREV });
  const p = await plan(x.r, {
    u: M,
    modality: "delivery",
    components: [
      {
        type: "delivery",
        amount: 7000,
        source_clause: "Cláusula 3",
        due_days: 30,
        delivery_id: d,
        delivery_version: 1,
      },
    ],
  });
  await move(x.r, p, "submitted", M);
  await move(x.r, p, "approved", CEO);
  const v = await preview(x.r);
  expect(v.release_condition).toBe("wk_acceptance_invoice");
  expect(v.contract_id).toBe(x.k);
  await expect(close(x.r, v.hash)).rejects.toThrow("sem valor conferido");
});
it("econ rejects omitted component fields, foreign currency and changed operation payload", async () => {
  const x = await startedRequest();
  const noAmount = monthly();
  delete noAmount.amount;
  await expect(plan(x.r, { components: [noAmount] })).rejects.toThrow("valor/taxa explícito");
  const noDue = monthly();
  delete noDue.due_days;
  await expect(plan(x.r, { components: [noDue] })).rejects.toThrow("vencimento em dias");
  await expect(
    user(
      U,
      (tx) =>
        tx`select hiring_econ_save(${W},${x.r.id},null,null,'monthly','USD',${PREV}::date,null,${tx.json([monthly()] as never)},'Cláusula conferida',null,${randomUUID()})`,
    ),
  ).rejects.toThrow("Moeda do plano diverge");
  const op = randomUUID();
  const p = await plan(x.r, { op });
  await expect(plan(x.r, { op, components: [monthly({ amount: 9999 })] })).rejects.toThrow(
    "outros dados",
  );
  const actionOp = randomUUID();
  await move(x.r, p, "submitted", U, { op: actionOp });
  await expect(
    move(x.r, p, "submitted", U, { op: actionOp, hash: "0".repeat(64) }),
  ).rejects.toThrow("outros dados");
});
it("econ rechecks the approval permission of the configured Finance user", async () => {
  const x = await approvedPlan();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${CEO} and permission_key=${prefix("professional") + ".economics.approve.workspace"}`;
  await expect(preview(x.r)).rejects.toThrow("aprovador Financeiro");
  expect((await econ(x.r.id)).events.some((e: { kind: string }) => e.kind === "approved")).toBe(
    true,
  );
});
it("econ closure source must match snapshot, scope, period and approved allocation", async () => {
  const x = await startedRequest();
  const { a, e } = await engagement(x.r);
  const p = await plan(x.r, { modality: "hourly", components: [hourly()] });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  const cl = await closing();
  const valid = await entry(a, { closing: cl });
  const stale = await entry(a, { closing: cl });
  await db`update project_time_entries set revision=2 where id=${stale}`;
  const seconds = await entry(a, { closing: cl });
  await db`update project_time_entries set duration_seconds=7200 where id=${seconds}`;
  const noApproval = await entry(a, { closing: cl });
  await db`update project_time_entries set approved_at=null where id=${noApproval}`;
  await entry(a, { closing: cl, source: "locked_import" });
  const otherScope = await closing();
  await db`update project_period_closings set scope='person',user_id=${CEO} where id=${otherScope}`;
  await entry(a, { closing: otherScope });
  const otherPeriod = await closing();
  await db`update project_period_closings set period_from=${PREV}::date+20 where id=${otherPeriod}`;
  await entry(a, { closing: otherPeriod });
  const lateAllocation = await user(M, (tx) =>
    tx`select hiring_allocate(${W},${e},${P},${PREV}::date+10,null,10,'Alocação de período parcial conferido') v`.then(
      (rows) => rows[0].v,
    ),
  );
  await entry(lateAllocation, { closing: cl });
  const v = await preview(x.r);
  expect(v.lines[0]).toMatchObject({ seconds: 3600, amount: 120 });
  expect(v.lines[0].entries.map((entry: { id: string }) => entry.id)).toEqual([valid]);
  expect(v.lines[0].excluded.count).toBe(7);
});
it("econ restricted source rows block the calculation rather than masquerade as zero", async () => {
  const x = await startedRequest();
  const { a } = await engagement(x.r);
  const p = await plan(x.r, { modality: "hourly", components: [hourly()] });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  const cl = await closing();
  await entry(a, { closing: cl });
  await db`update job_role_permission_overrides set effect='deny' where role_id=${CEO} and permission_key='techprojects.projects.view.workspace'`;
  await expect(preview(x.r)).rejects.toThrow("Fontes de horas indisponíveis");
});
it("econ current field masks and economics permission protect existing provision table reads", async () => {
  const x = await approvedPlan();
  const snapshot = await preview(x.r);
  const id = await close(x.r, snapshot.hash);
  await db.unsafe(
    "GRANT SELECT ON hiring_monthly_provisions TO authenticated;CREATE POLICY qa_legacy_provision_allow ON hiring_monthly_provisions FOR SELECT TO authenticated USING(true)",
  );
  try {
    expect(
      await user(CEO, (tx) => tx`select id from hiring_monthly_provisions where id=${id}`),
    ).toHaveLength(1);
    await db`update job_role_permission_overrides set effect='deny' where role_id=${CEO} and permission_key=${prefix("professional") + ".economics.view.workspace"}`;
    expect(
      await user(CEO, (tx) => tx`select id from hiring_monthly_provisions where id=${id}`),
    ).toHaveLength(0);
    await db`update job_role_permission_overrides set effect='grant' where role_id=${CEO} and permission_key=${prefix("professional") + ".economics.view.workspace"}`;
    for (const rules of [
      { "techfinance.entries": { amount: "masked" } },
      { "techpeople.people": { monthly_cost: "hidden" } },
    ]) {
      await db`insert into fixture_field_rules values(${CEO},${db.json(rules)}) on conflict(user_id) do update set rules=excluded.rules`;
      expect((await econ(x.r.id, CEO)).can_view).toBe(false);
      expect(
        await user(CEO, (tx) => tx`select id from hiring_monthly_provisions where id=${id}`),
      ).toHaveLength(0);
      await expect(preview(x.r)).rejects.toThrow("Sem permissão");
    }
  } finally {
    await db.unsafe(
      "DROP POLICY qa_legacy_provision_allow ON hiring_monthly_provisions;REVOKE SELECT ON hiring_monthly_provisions FROM authenticated",
    );
  }
});
it("econ delivery competence follows the execution period rather than late acceptance", async () => {
  const x = await startedRequest();
  const d = await save(x.r, { periodStart: PREV, periodEnd: PREV });
  const p = await plan(x.r, {
    modality: "delivery",
    components: [
      {
        type: "delivery",
        amount: 7000,
        source_clause: "Cláusula 3 entrega",
        due_days: 10,
        delivery_id: d,
        delivery_version: 1,
      },
    ],
  });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  await submit(x.r, d);
  await decide2(x.r, d);
  const past = await preview(x.r);
  expect(past.lines[0]).toMatchObject({
    type: "delivery",
    amount: 7000,
    competence: PREV,
    to: PREV,
  });
  const current = await preview(x.r, today());
  expect(current.lines).toHaveLength(0);
});
it("econ legacy provision adapters refuse new request contracts after their existing authorization gate", async () => {
  const x = await approvedPlan();
  await expect(
    user(CEO, (tx) => tx`select hiring_provision_preview(${W},${x.k},${PREV}::date,'UTC')`),
  ).rejects.toThrow("plano econômico");
  await expect(
    user(
      CEO,
      (tx) =>
        tx`select hiring_provision_close(${W},${x.k},${PREV}::date,'hash',null,'Não deve criar provisão legada','UTC')`,
    ),
  ).rejects.toThrow("plano econômico");
  await expect(
    user(CEO, (tx) => tx`select hiring_provision_context(${W},${x.k},${PREV}::date,null)`),
  ).rejects.toThrow("plano econômico");
});
it("econ private write requires the economics view key as well as manage", async () => {
  const x = await startedRequest();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${U} and permission_key=${prefix("professional") + ".economics.view.workspace"}`;
  await expect(plan(x.r)).rejects.toThrow("Sem permissão");
});
it("econ provision close retains canonical Finance view and manage permissions", async () => {
  const x = await approvedPlan();
  const v = await preview(x.r);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${CEO} and permission_key='techfinance.provisions.view.workspace'`;
  await expect(close(x.r, v.hash)).rejects.toThrow("Sem permissão");
  await db`update job_role_permission_overrides set effect='grant' where role_id=${CEO} and permission_key='techfinance.provisions.view.workspace'`;
  await db`update job_role_permission_overrides set effect='deny' where role_id=${CEO} and permission_key='techfinance.provisions.manage.workspace'`;
  await expect(close(x.r, v.hash)).rejects.toThrow("Sem permissão");
});
it("econ fixed prices require monetary precision while hourly rates keep explicit precision", async () => {
  const x = await startedRequest();
  await expect(plan(x.r, { components: [monthly({ amount: 0.001 })] })).rejects.toThrow(
    "duas casas decimais",
  );
  await expect(plan(x.r, { components: [monthly({ amount: 9300.001 })] })).rejects.toThrow(
    "duas casas decimais",
  );
});
it("econ calculates a closed period with 200 source entries in a bounded query", async () => {
  const x = await startedRequest();
  const { a } = await engagement(x.r);
  const p = await plan(x.r, { modality: "hourly", components: [hourly()] });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  const cl = await closing();
  await db`insert into project_time_entries(id,workspace_id,project_id,person_id,user_id,allocation_id,entry_date,status,source,duration_seconds,period_closing_id,approved_at,approved_by) select gen_random_uuid(),${W},${P},${D},${D},${a},${PREV}::date+2,'approved','manual',3600,${cl},now(),${M} from generate_series(1,200)`;
  await db`update project_period_closings set entries_snapshot=(select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'user_id',user_id,'project_id',project_id,'entry_date',entry_date,'seconds',duration_seconds,'approved_at',approved_at)) from project_time_entries where period_closing_id=${cl}) where id=${cl}`;
  const v = await user(CEO, async (tx) => {
    await tx.unsafe("SET LOCAL statement_timeout='4s'");
    return tx`select hiring_econ_provision_preview(${W},${x.r.id},${PREV}::date) v`.then(
      (rows) => rows[0].v,
    );
  });
  expect(v.lines[0]).toMatchObject({ seconds: 720000, amount: 24000 });
  expect(v.lines[0].entries).toHaveLength(200);
});
it("econ plan and provision tables are not directly readable", async () => {
  const x = await approvedPlan();
  await expect(
    user(CEO, (tx) => tx`select * from hiring_economic_plan_versions`),
  ).rejects.toThrow();
  await expect(user(CEO, (tx) => tx`select * from hiring_monthly_provisions`)).rejects.toThrow();
  const c = await econ(x.r.id, D);
  expect(JSON.stringify(c)).toContain("9300");
  await db`delete from job_role_permission_overrides where role_id=${D} and permission_key like '%economics.view%'`;
  expect(JSON.stringify(await econ(x.r.id, D))).not.toContain("9300");
});
