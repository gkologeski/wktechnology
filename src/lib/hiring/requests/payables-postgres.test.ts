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
const BATCH_C2 = "drizzle/migrations/0384_hiring_payables_reconciliation.sql";
// Package 4 batch C2 (PARCELA-CONCILIA): same disposable bootstrap as batch C1 plus canonical finance tables and prepared 0384.
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
const container = "techerp-payables-ci-" + randomUUID();
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
  root = mkdtempSync(join(tmpdir(), "hiring-payables-pg-"));
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
      `-k ${root} -h '' -p 55451 -F -c jit=off`,
      "-w",
      "start",
    ]);
    started = true;
    db = postgres({
      host: root,
      port: 55451,
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
    ALTER TABLE project_time_entries ADD COLUMN approved_at timestamptz,ADD COLUMN approved_by uuid,ADD COLUMN invoiced_at timestamptz,ADD COLUMN updated_at timestamptz;
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
  // C2 fixture: production-shaped canonical finance tables (columns from the live schema; enums as text).
  await db.unsafe(`ALTER TABLE people ADD COLUMN personal_doc jsonb DEFAULT '{"cpf":"12345678901"}'; CREATE TABLE financial_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,owner_id uuid NOT NULL,direction text NOT NULL CHECK(direction IN('receivable','payable')),
      origin_type text NOT NULL DEFAULT 'manual',origin_id uuid,contract_id uuid,service_id uuid,project_id uuid,counterparty_company_id uuid,category_id uuid,description text NOT NULL,amount numeric NOT NULL,
      currency text NOT NULL DEFAULT 'BRL',competence_date date NOT NULL,due_date date NOT NULL,paid_amount numeric NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'open',payment_method text,notes text,
      attachments jsonb NOT NULL DEFAULT '[]',external_ref text,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),parent_entry_id uuid,
      installment_number smallint,installment_total smallint,legal_entity_id uuid,counterparty_legal_entity_id uuid,assigned_to uuid);
    CREATE UNIQUE INDEX financial_entries_workspace_external_ref_key ON financial_entries(workspace_id,external_ref) WHERE external_ref IS NOT NULL;
    CREATE TABLE financial_recurrences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,owner_id uuid NOT NULL,direction text NOT NULL,template jsonb NOT NULL,cadence text NOT NULL,interval_days smallint,
      day_of_month smallint,start_date date NOT NULL,end_date date,max_occurrences smallint,occurrences_generated smallint DEFAULT 0,next_run_date date,active boolean DEFAULT true,last_generated_entry_id uuid,
      created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),assigned_to uuid,legal_entity_id uuid);
    CREATE TABLE financial_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,entry_id uuid NOT NULL REFERENCES financial_entries(id),bank_account_id uuid,paid_at date NOT NULL,amount numeric NOT NULL,
      method text,reference text,notes text,created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    -- Stand-in for the finance guard: status/paid_amount derive from financial_payments only.
    CREATE FUNCTION fixture_payment_derive() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      UPDATE financial_entries e SET paid_amount=(SELECT coalesce(sum(amount),0) FROM financial_payments WHERE entry_id=e.id),
        status=CASE WHEN (SELECT coalesce(sum(amount),0) FROM financial_payments WHERE entry_id=e.id)>=e.amount THEN 'paid' ELSE 'partial' END WHERE e.id=NEW.entry_id; RETURN NEW; END $$;
    CREATE TRIGGER fixture_payment_derive AFTER INSERT ON financial_payments FOR EACH ROW EXECUTE FUNCTION fixture_payment_derive();
    GRANT SELECT,INSERT,UPDATE,DELETE ON financial_entries,financial_recurrences,financial_payments TO authenticated;
    CREATE TABLE fixture_hidden_reads(user_id uuid,record_id uuid);
    GRANT SELECT ON fixture_hidden_reads TO authenticated;
    ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE financial_recurrences ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fixture_company_scope ON companies AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT EXISTS(SELECT 1 FROM fixture_hidden_reads WHERE user_id=auth.uid() AND record_id=id));
    CREATE POLICY fixture_entity_scope ON legal_entities AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT EXISTS(SELECT 1 FROM fixture_hidden_reads WHERE user_id=auth.uid() AND record_id=id));
    CREATE POLICY fixture_finance_read ON financial_entries FOR SELECT TO authenticated USING(workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND is_workspace_member(workspace_id,auth.uid()) AND NOT EXISTS(SELECT 1 FROM fixture_hidden_reads WHERE user_id=auth.uid() AND record_id=id));
    CREATE POLICY fixture_finance_delete ON financial_entries FOR DELETE TO authenticated USING(is_workspace_member(workspace_id,auth.uid()));
    CREATE POLICY fixture_finance_insert ON financial_entries FOR INSERT TO authenticated WITH CHECK(is_workspace_member(workspace_id,auth.uid()));
    CREATE POLICY fixture_finance_update ON financial_entries FOR UPDATE TO authenticated USING(is_workspace_member(workspace_id,auth.uid())) WITH CHECK(is_workspace_member(workspace_id,auth.uid()));
    CREATE POLICY fixture_recurrence_insert ON financial_recurrences FOR INSERT TO authenticated WITH CHECK(is_workspace_member(workspace_id,auth.uid()));
    CREATE POLICY fixture_recurrence_read ON financial_recurrences FOR SELECT TO authenticated USING(workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND is_workspace_member(workspace_id,auth.uid()) AND NOT EXISTS(SELECT 1 FROM fixture_hidden_reads WHERE user_id=auth.uid() AND record_id=id));
    INSERT INTO permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
     ('techfinance.entries.view.workspace','techfinance','entries','view','workspace','x','x',true),('techfinance.entries.create.workspace','techfinance','entries','create','workspace','x','x',true),
     ('techfinance.entries.update.workspace','techfinance','entries','update','workspace','x','x',true) ON CONFLICT(key) DO NOTHING;`);
  await db.begin(async (tx) => {
    await tx.unsafe(readFileSync(BATCH_C2, "utf8"));
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
  // Package 5 cross-flow boundary: load the legacy migration beside the real hiring chain.
  // The fixture already exercises actual signatures, starts, deliveries and canonical payables.
  await db.unsafe(`CREATE DOMAIN contract_status AS text;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_file_path text, ADD COLUMN IF NOT EXISTS imported_from text,
      ADD COLUMN IF NOT EXISTS parent_contract_id uuid, ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS signed_at timestamptz, ADD COLUMN IF NOT EXISTS signed_pdf_path text,
      ADD COLUMN IF NOT EXISTS signature_provider text, ADD COLUMN IF NOT EXISTS signature_document_id text,
      ADD COLUMN IF NOT EXISTS signature_operation_id text, ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS quote_id uuid, ADD COLUMN IF NOT EXISTS currency text, ADD COLUMN IF NOT EXISTS payment_method text,
      ADD COLUMN IF NOT EXISTS payment_terms jsonb;
    ALTER TABLE services ADD COLUMN IF NOT EXISTS billing_hold text;
    ALTER TABLE contract_drafts ADD COLUMN IF NOT EXISTS updated_at timestamptz;`);
  await db.unsafe(
    readFileSync("drizzle/migrations/0385_contract_legacy_regularization.sql", "utf8"),
  );
  // Connection startup belongs to fixture preparation, not the race under test.
  // postgres.js can open a third TCP session lazily several seconds after the first two on CI.
  const connections = await Promise.all([db.reserve(), db.reserve(), db.reserve()]);
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
  if (started && !useNative) dockerRun("rm", "-f", container);
  if (root) rmSync(root, { recursive: true, force: true });
});
const CLIENT_PROJECT = "ffffffff-0000-4000-8000-000000000009";
const M = "bbbbbbbb-0000-4000-8000-000000000002",
  CEO = "bbbbbbbb-0000-4000-8000-000000000003",
  D = "bbbbbbbb-0000-4000-8000-000000000004";
const prefix = (kind: string) =>
  kind === "professional" ? "techpeople.hiring_requests" : "techcontracts.supplier_requests";
async function reset() {
  // Keep fixture setup atomic so a failed seed never exposes partial test data.
  await db.begin(async (db) => {
    // Privileged cleanup is confined to this disposable database; production RPCs and scenario writes still run with all guards.
    // DELETE avoids TRUNCATE's repeated relcache/plan invalidation across the full signed-flow fixture.
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
    await db`insert into deals(id,workspace_id,name,legal_entity_id) values(${CLIENT_PROJECT},${W},'Negócio cliente',${L})`;
    await db`update deals set company_id=${C} where id=${CLIENT_PROJECT}`;
    await db`insert into contracts(id,workspace_id,title,role,status,contracting_legal_entity_id,deal_id,counterparty_company_id,starts_at,body_html) values(${CLIENT_PROJECT},${W},'Contrato comercial assinado fixture','provider','active',${L},${CLIENT_PROJECT},${C},${PREV}::date,'Origem comercial assinada')`;
    await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence','fixture-commercial-signed',${db.json({ sha256: "b".repeat(64) })})`;
    await db`insert into hiring_contract_evidence(workspace_id,contract_id,contract_hash,kind,file_path,file_hash) values(${W},${CLIENT_PROJECT},hiring_contract_fingerprint(${CLIENT_PROJECT}),'external','fixture-commercial-signed',${"b".repeat(64)})`;
    await db`insert into projects(id,workspace_id,name,legal_entity_id,deal_id,contract_id) values(${CLIENT_PROJECT},${W},'Projeto cliente',${L},${CLIENT_PROJECT},${CLIENT_PROJECT})`;
  });
}
async function user<T>(u: string, fn: (tx: postgres.TransactionSql) => Promise<T>) {
  return db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: u, role: "authenticated" })},true)`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    return fn(tx);
  });
}
let formExtra: Record<string, unknown> = {};
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
  ...formExtra,
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
  const key = JSON.stringify([kind, regime, formExtra]);
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
  }> = {},
) =>
  user(o.u ?? U, (tx) =>
    tx`select hiring_delivery_save(${o.w ?? W},${r.id},${o.delivery ?? null},${o.version ?? null},${o.title ?? "Entrega mensal de sustentação"},'Critério: chamados críticos resolvidos dentro do SLA acordado.',current_date,current_date,${o.responsible ?? M},${o.project ?? null},${o.milestone ?? null},${o.reason ?? null},${o.op ?? randomUUID()}) v`.then(
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
  const key = JSON.stringify([kind, regime, formExtra]);
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
// ---------------- Batch C2: canonical payables, reconciliation and source integrity ----------------
const WK_CNPJ = "11222333000181",
  PERSON_CNPJ = "22333444000190",
  SUPPLIER_CNPJ = "33444555000100";
type DocOpts = Partial<{
  type: string;
  amount: number;
  currency: string;
  issuer: string;
  taker: string;
  delivery: string | null;
  regime: string | null;
  kind: string;
  status: string;
}>;
async function doc(r: R, o: DocOpts = {}) {
  const id = randomUUID();
  const sid = (await db`select id from hiring_execution_starts where request_id=${r.id}`)[0].id;
  const type = o.type ?? "nfse";
  const requestRow = (await db`select * from hiring_preparation_requests where id=${r.id}`)[0];
  const defaultIssuer =
    requestRow.regime === "clt"
      ? WK_CNPJ
      : requestRow.regime === "freelance"
        ? "12345678901"
        : PERSON_CNPJ;
  await db`insert into hiring_fiscal_documents(id,workspace_id,request_id,start_id,kind,regime,doc_type,modality,delivery_id,storage_path,file_name,mime_type,size_bytes,sha256,issuer_tax_id,taker_tax_id,amount,currency,document_number,issued_on,status,operation_id,uploaded_by,registered_at,server_sha256,server_attested_at)
    values(${id},${W},${r.id},${sid},${o.kind ?? "professional"},${o.regime === undefined ? "pj" : o.regime},${type},${type === "freelance_document" ? "rpa" : null},${o.delivery ?? null},${"fixture/" + id},'nota.pdf','application/pdf',100,
      ${(id.replace(/-/g, "") + id.replace(/-/g, "")).slice(0, 64)},${o.issuer ?? defaultIssuer},${type === "payroll_evidence" ? null : (o.taker ?? WK_CNPJ)},${o.amount ?? 9300},${o.currency ?? "BRL"},${"NF-" + id.slice(0, 8)},current_date,${o.status ?? "verified"},${randomUUID()},${U},now(),${(id.replace(/-/g, "") + id.replace(/-/g, "")).slice(0, 64)},now())`;
  if ((o.status ?? "verified") === "verified")
    await db`insert into hiring_fiscal_document_reviews(workspace_id,document_id,sha256,decision,reason,operation_id,reviewed_by) select workspace_id,id,sha256,'verified','Conferência humana fixture',${randomUUID()},${CEO} from hiring_fiscal_documents where id=${id}`;
  return id;
}
const pctx = (id: string, month: string | null = PREV, u = CEO, w = W) =>
  user(u, (tx) =>
    tx`select hiring_payable_context(${w},${id},${month}::date) v`.then(
      (x) => x[0].v as Record<string, any>,
    ),
  );
type Gen = Partial<{
  u: string;
  w: string;
  month: string;
  hash: string;
  keys: string[];
  inst: { amount: number; due_on: string }[];
  doc: string | null;
  op: string;
  just: string;
  beforeGenerate: () => Promise<void>;
}>;
const DUE = () => {
  const d = new Date(PREV + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 10)).toISOString().slice(0, 10);
};
async function gen(r: R, o: Gen = {}) {
  const month = o.month ?? PREV;
  const hash = o.hash ?? ((await pctx(r.id, month)).eligible?.preview_hash as string);
  return user(o.u ?? U, async (tx) => {
    if (o.beforeGenerate) await o.beforeGenerate();
    return await tx`select hiring_payable_generate(${o.w ?? W},${r.id},${month}::date,${hash},${tx.json(o.keys ?? ["monthly:" + month])},${tx.json(o.inst ?? [{ amount: 9300, due_on: DUE() }])},${o.doc === undefined ? null : o.doc},${o.just ?? "Competência encerrada conferida com o contrato assinado."},${o.op ?? randomUUID()}) v`.then(
      (x) => x[0].v as string,
    );
  });
}
type Rec = Partial<{
  u: string;
  w: string;
  month: string;
  decision: string;
  hash: string;
  keys: string[];
  doc: string | null;
  op: string;
}>;
async function recon(r: R, target: string, o: Rec = {}) {
  const month = o.month ?? PREV;
  const hash = o.hash ?? ((await pctx(r.id, month)).eligible?.preview_hash as string);
  return user(o.u ?? CEO, (tx) =>
    tx`select hiring_payable_reconcile(${o.w ?? W},${r.id},${month}::date,${target},${o.decision ?? "linked"},${hash},${tx.json(o.keys ?? ["monthly:" + month])},${o.doc === undefined ? null : o.doc},'Título legado conferido pelo Financeiro.',${o.op ?? randomUUID()}) v`.then(
      (x) => x[0].v as string,
    ),
  );
}
async function payroll(amount = 9300) {
  const id = randomUUID();
  await db`insert into financial_entries(id,workspace_id,owner_id,direction,origin_type,description,amount,currency,competence_date,due_date,status,notes,legal_entity_id)
    values(${id},${W},${U},'payable','manual','Folha legado',${amount},'BRL',${PREV}::date,${DUE()}::date,'open',${"[people_payroll:" + D + "]"},${L})`;
  return id;
}
const contractOf = async (r: R) =>
  (await db`select contract_id from hiring_execution_starts where request_id=${r.id}`)[0]
    .contract_id as string;
const count = async (table: string) =>
  (await db.unsafe(`select count(*)::int n from ${table}`))[0].n as number;

it("payables generate canonical open payable titles with exact installments and no payment", async () => {
  const x = await approvedPlan();
  const d = await doc(x.r);
  const sid = await gen(x.r, {
    doc: d,
    inst: [
      { amount: 4650, due_on: DUE() },
      { amount: 4650, due_on: DUE() },
    ],
  });
  const k = await contractOf(x.r);
  const rows =
    await db`select f.* from financial_entries f join hiring_payable_installments i on i.financial_entry_id=f.id where i.schedule_id=${sid} order by f.installment_number`;
  expect(
    rows.map((f) => [
      f.direction,
      f.status,
      f.origin_type,
      f.origin_id,
      f.contract_id,
      f.legal_entity_id,
      Number(f.amount),
      Number(f.paid_amount),
    ]),
  ).toEqual([
    ["payable", "open", "contract", k, k, L, 4650, 0],
    ["payable", "open", "contract", k, k, L, 4650, 0],
  ]);
  expect(await count("financial_payments")).toBe(0);
  expect(
    Number(
      (
        await db`select sum(amount) s from hiring_fiscal_document_allocations where document_id=${d}`
      )[0].s,
    ),
  ).toBe(9300);
});
it("payables reject installments that do not close the obligation exactly", async () => {
  const x = await approvedPlan();
  const d = await doc(x.r);
  await expect(gen(x.r, { doc: d, inst: [{ amount: 9299.99, due_on: DUE() }] })).rejects.toThrow(
    "fechar exatamente",
  );
  await expect(
    gen(x.r, { doc: d, inst: [{ amount: 9300, due_on: "2000-01-01" }] }),
  ).rejects.toThrow("Vencimento");
  expect(await count("financial_entries")).toBe(0);
});
it("payables exact replay is idempotent and a reused operation with other data fails", async () => {
  const x = await approvedPlan();
  const d = await doc(x.r);
  const hash = (await pctx(x.r.id)).eligible.preview_hash as string;
  const op = randomUUID();
  const a = await gen(x.r, { doc: d, op, hash });
  expect(await gen(x.r, { doc: d, op, hash })).toBe(a);
  await expect(
    gen(x.r, { doc: d, op, hash, just: "Outra justificativa diferente da primeira." }),
  ).rejects.toThrow("dados diferentes");
  expect(await count("financial_entries")).toBe(1);
});
it("payables never claim the same source twice", async () => {
  const x = await approvedPlan();
  const d = await doc(x.r, { amount: 20000 });
  await gen(x.r, { doc: d });
  expect((await pctx(x.r.id)).eligible.lines[0].blocking).toBe("already_claimed");
  await expect(gen(x.r, { doc: d })).rejects.toThrow("already_claimed");
  expect(await count("financial_entries")).toBe(1);
});
it("payables claims survive a new approved plan version (stable key independent of version)", async () => {
  const x = await approvedPlan();
  await gen(x.r, { doc: await doc(x.r) });
  await plan(x.r, {
    plan: x.p,
    version: 1,
    components: [monthly({ amount: 9400 })],
    reason: "Reajuste contratual aprovado",
  });
  await move(x.r, x.p, "submitted", U, { version: 2 });
  await move(x.r, x.p, "approved", CEO, { version: 2 });
  expect((await pctx(x.r.id)).eligible.lines[0].blocking).toBe("already_claimed");
});
it("payables concurrent generation of the same source creates a single obligation", async () => {
  const x = await approvedPlan();
  const d = await doc(x.r, { amount: 30000 });
  const hash = (await pctx(x.r.id)).eligible.preview_hash as string;
  let ready = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const beforeGenerate = async () => {
    if (++ready === 3) release();
    await gate;
  };
  const out = await Promise.allSettled(
    [1, 2, 3].map(() =>
      gen(x.r, { doc: d, hash, beforeGenerate }).catch((error) => {
        release();
        throw error;
      }),
    ),
  );
  expect(ready).toBe(3);
  expect(out.filter((o) => o.status === "fulfilled").length).toBe(1);
  for (const result of out)
    if (result.status === "rejected")
      expect(String(result.reason)).toMatch(/already_claimed|DUPLICATE_SOURCE/);
  expect(await count("financial_entries")).toBe(1);
});

it("payables refuse a stale preview hash", async () => {
  const x = await approvedPlan();
  await expect(gen(x.r, { doc: await doc(x.r), hash: "0".repeat(64) })).rejects.toThrow("STALE");
});
it("payables need the current approved plan: a pending new version blocks generation", async () => {
  const x = await approvedPlan();
  const d = await doc(x.r);
  await plan(x.r, {
    plan: x.p,
    version: 1,
    components: [monthly({ amount: 9400 })],
    reason: "Reajuste em revisão",
  });
  await expect(gen(x.r, { doc: d, hash: "0".repeat(64) })).rejects.toThrow(
    "plano econômico aprovado",
  );
});
it("payables keep the open current month out of monthly obligations", async () => {
  const x = await approvedPlan();
  const month = today().slice(0, 8) + "01";
  expect((await pctx(x.r.id, month)).eligible.lines[0].blocking).toBe("period_open");
  await expect(
    gen(x.r, { month, keys: ["monthly:" + month], doc: await doc(x.r) }),
  ).rejects.toThrow("period_open");
});
it("payables require a verified fiscal document with matching currency, parties, type and balance", async () => {
  const x = await approvedPlan();
  await expect(gen(x.r)).rejects.toThrow("documento fiscal");
  await expect(gen(x.r, { doc: await doc(x.r, { status: "registered" }) })).rejects.toThrow(
    "não conferido",
  );
  await expect(gen(x.r, { doc: await doc(x.r, { currency: "USD" }) })).rejects.toThrow("Moeda");
  await expect(gen(x.r, { doc: await doc(x.r, { taker: "99888777000166" }) })).rejects.toThrow(
    "Tomador",
  );
  await expect(gen(x.r, { doc: await doc(x.r, { issuer: "99888777000166" }) })).rejects.toThrow(
    "Emissor",
  );
  await expect(gen(x.r, { doc: await doc(x.r, { amount: 5000 }) })).rejects.toThrow(
    "Saldo do documento",
  );
  await expect(gen(x.r, { doc: await doc(x.r, { type: "payroll_evidence" }) })).rejects.toThrow(
    "Tipo de documento",
  );
  expect(await count("financial_entries")).toBe(0);
});
it("payables: CLT uses payroll evidence and never a fictitious invoice", async () => {
  const x = await approvedPlan({}, "professional", "clt");
  await expect(gen(x.r)).rejects.toThrow("evidência de folha");
  await expect(gen(x.r, { doc: await doc(x.r, { regime: "clt" }) })).rejects.toThrow(
    "Tipo de documento",
  );
  expect(
    await gen(x.r, { doc: await doc(x.r, { regime: "clt", type: "payroll_evidence" }) }),
  ).toBeTruthy();
});
it("payables: freelance requires the explicit freelance document", async () => {
  const x = await approvedPlan({}, "professional", "freelance");
  await expect(gen(x.r, { doc: await doc(x.r, { regime: "freelance" }) })).rejects.toThrow(
    "Tipo de documento",
  );
  expect(
    await gen(x.r, { doc: await doc(x.r, { regime: "freelance", type: "freelance_document" }) }),
  ).toBeTruthy();
});
it("payables: one document balance is never used beyond its verified amount (concurrency)", async () => {
  const x = await startedRequest();
  const { a } = await engagement(x.r);
  const p = await plan(x.r, {
    modality: "mixed",
    components: [monthly(), hourly({ project_id: P })],
  });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  await entry(a, { closing: await closing(), seconds: 7200 });
  const d = await doc(x.r, { amount: 9500 });
  const hash = (await pctx(x.r.id)).eligible.preview_hash as string;
  const out = await Promise.allSettled([
    gen(x.r, { doc: d, hash }),
    gen(x.r, { doc: d, hash, keys: ["hourly:" + P], inst: [{ amount: 240, due_on: DUE() }] }),
  ]);
  expect(out.filter((o) => o.status === "fulfilled").length).toBe(1);
  expect(
    out.some((o) => o.status === "rejected" && String(o.reason).includes("Saldo do documento")),
  ).toBe(true);
});
it("payables detect legacy payroll titles before creating a new expense", async () => {
  const x = await approvedPlan();
  await payroll();
  await expect(gen(x.r, { doc: await doc(x.r) })).rejects.toThrow("LEGACY_CONFLICT");
  expect((await pctx(x.r.id)).legacy.map((l: any) => l.match)).toEqual(["payroll"]);
  expect(await count("financial_entries")).toBe(1);
});
it("payables reconcile a compatible paid legacy title (Finance only) without touching it", async () => {
  const x = await approvedPlan();
  const legacy = await payroll();
  await db`insert into financial_payments(workspace_id,entry_id,paid_at,amount) values(${W},${legacy},current_date,9300)`;
  const d = await doc(x.r);
  await expect(recon(x.r, legacy, { u: U, doc: d })).rejects.toThrow(
    /Financeiro configurado|Sem permissão/,
  );
  expect(await recon(x.r, legacy, { doc: d })).toBeTruthy();
  const f = (await db`select status,paid_amount from financial_entries where id=${legacy}`)[0];
  expect([f.status, Number(f.paid_amount)]).toEqual(["paid", 9300]);
  expect((await pctx(x.r.id)).eligible.lines[0].blocking).toBe("already_claimed");
  await expect(gen(x.r, { doc: await doc(x.r) })).rejects.toThrow("already_claimed");
  await expect(
    db`update financial_entries set status='cancelled' where id=${legacy}`,
  ).rejects.toThrow("cancelado");
});
it("payables refuse to link an incompatible legacy title and explain why", async () => {
  const x = await approvedPlan();
  const legacy = await payroll(8000);
  await expect(recon(x.r, legacy, { doc: await doc(x.r) })).rejects.toThrow(/INCOMPATIBLE.*amount/);
  expect(await count("hiring_payable_reconciliations")).toBe(0);
});
it("payables 'unrelated' decision is explicit and unblocks generation without touching the title", async () => {
  const x = await approvedPlan();
  const legacy = await payroll(500);
  await recon(x.r, legacy, { decision: "unrelated" });
  expect(await gen(x.r, { doc: await doc(x.r) })).toBeTruthy();
  expect((await db`select status from financial_entries where id=${legacy}`)[0].status).toBe(
    "open",
  );
});
it("payables: legacy payroll cannot later duplicate a governed competence", async () => {
  const x = await approvedPlan();
  await gen(x.r, { doc: await doc(x.r) });
  await expect(payroll()).rejects.toThrow("Competência já possui obrigação");
});
it("payables block manual, workflow, GUC and recurrence bypass on governed contracts", async () => {
  const x = await approvedPlan();
  const k = await contractOf(x.r);
  const sid = await gen(x.r, { doc: await doc(x.r) });
  const e = (
    await db`select financial_entry_id id from hiring_payable_installments where schedule_id=${sid}`
  )[0].id;
  await expect(
    user(
      U,
      (tx) =>
        tx`insert into financial_entries(workspace_id,owner_id,direction,origin_type,contract_id,description,amount,competence_date,due_date) values(${W},${U},'payable','manual',${k},'Manual',100,current_date,current_date)`,
    ),
  ).rejects.toThrow("fluxo governado");
  await expect(
    user(
      U,
      (tx) =>
        tx`insert into financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,description,amount,competence_date,due_date) values(${W},${U},'payable','contract',${k},'Workflow',100,current_date,current_date)`,
    ),
  ).rejects.toThrow("fluxo governado");
  await expect(
    db.begin(async (tx) => {
      await tx`select set_config('request.hiring_payable','trusted',true)`;
      await tx`insert into financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,contract_id,description,amount,competence_date,due_date) values(${W},${U},'payable','contract',${k},${k},'GUC',100,current_date,current_date)`;
    }),
  ).rejects.toThrow("fluxo governado");
  const manual = (
    await db`insert into financial_entries(workspace_id,owner_id,direction,description,amount,competence_date,due_date) values(${W},${U},'payable','Avulso',100,current_date,current_date) returning id`
  )[0].id;
  await expect(
    user(U, (tx) => tx`update financial_entries set contract_id=${k} where id=${manual}`),
  ).rejects.toThrow("conciliação");
  await expect(
    user(U, (tx) => tx`update financial_entries set amount=1 where id=${e}`),
  ).rejects.toThrow("imutável");
  await expect(
    user(U, (tx) => tx`update financial_entries set status='cancelled' where id=${e}`),
  ).rejects.toThrow("cancelado");
  await expect(user(U, (tx) => tx`delete from financial_entries where id=${e}`)).rejects.toThrow(
    "excluído",
  );
  await expect(
    user(
      U,
      (tx) =>
        tx`insert into financial_recurrences(workspace_id,owner_id,direction,template,cadence,start_date) values(${W},${U},'payable',${tx.json({ contract_id: k })},'monthly',current_date)`,
    ),
  ).rejects.toThrow("recorrência");
  await user(U, (tx) => tx`update financial_entries set notes='Observação livre' where id=${e}`);
  await db`insert into financial_payments(workspace_id,entry_id,paid_at,amount) values(${W},${e},current_date,9300)`;
  expect((await db`select status from financial_entries where id=${e}`)[0].status).toBe("paid");
});
it("payables leave old non-governed contracts untouched", async () => {
  await reset();
  const k = randomUUID();
  await db`insert into contracts(id,workspace_id,title) values(${k},${W},'Contrato antigo')`;
  const id = (
    await db`insert into financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,contract_id,description,amount,competence_date,due_date) values(${W},${U},'payable','contract',${k},${k},'Antigo',100,current_date,current_date) returning id`
  )[0].id;
  await db`update financial_entries set amount=200,status='cancelled' where id=${id}`;
  await db`insert into financial_recurrences(workspace_id,owner_id,direction,template,cadence,start_date) values(${W},${U},'payable',${db.json({ contract_id: k })},'monthly',current_date)`;
  await db`delete from financial_entries where id=${id}`;
  expect(await count("financial_entries")).toBe(0);
});
async function hourlyPlan() {
  const x = await startedRequest();
  const { a } = await engagement(x.r);
  const p = await plan(x.r, { modality: "hourly", components: [hourly()] });
  await move(x.r, p, "submitted");
  await move(x.r, p, "approved", CEO);
  return { ...x, a };
}
it("payables freeze claimed hours and their closing, but keep sales billing fields free", async () => {
  const x = await hourlyPlan();
  const pc = await closing();
  const t = await entry(x.a, { closing: pc, seconds: 7200 });
  const line = (await pctx(x.r.id)).eligible.lines[0];
  expect([line.key, line.seconds, Number(line.amount)]).toEqual(["hourly:*", 7200, 240]);
  await gen(x.r, {
    keys: ["hourly:*"],
    inst: [{ amount: 240, due_on: DUE() }],
    doc: await doc(x.r, { amount: 240 }),
  });
  await expect(
    db`update project_time_entries set duration_seconds=1 where id=${t}`,
  ).rejects.toThrow("lastro");
  await expect(db`delete from project_time_entries where id=${t}`).rejects.toThrow("lastro");
  await expect(
    db`update project_period_closings set status='reopened' where id=${pc}`,
  ).rejects.toThrow("reaberto");
  await db`update project_time_entries set invoice_id=${randomUUID()},invoiced_at=now(),updated_at=now() where id=${t}`;
  await expect(
    db`update project_period_closings set entries_snapshot='[]' where id=${pc}`,
  ).rejects.toThrow("lastro");
  await expect(db`update people_allocations set allocation_pct=5 where id=${x.a}`).rejects.toThrow(
    "lastro",
  );
  await expect(
    db`update people_allocations set ends_at=${PREV}::date where id=${x.a}`,
  ).rejects.toThrow("lastro");
  const claims =
    await db`select time_entry_id,seconds::int s,period_closing_id from hiring_payable_source_claims`;
  expect(claims.map((c) => [c.time_entry_id, c.s, c.period_closing_id])).toEqual([[t, 7200, pc]]);
});
it("payables: pending hours (no closing) never become a zero obligation", async () => {
  const x = await hourlyPlan();
  await entry(x.a, { closing: null });
  expect((await pctx(x.r.id)).eligible.lines[0].blocking).toBe("pending_time_sources");
  await expect(gen(x.r, { keys: ["hourly:*"], doc: await doc(x.r) })).rejects.toThrow(
    "pending_time_sources",
  );
});

// Supplier special condition: client purpose + canonical project + named, Finance-confirmed final acceptance.
async function supplierClient() {
  // Real client-purpose request from its first revision: all approval/formalization proofs remain intact.
  formExtra = {
    modality: "delivery",
    purpose: "client",
    deal_id: CLIENT_PROJECT,
    project_id: CLIENT_PROJECT,
    commercial_contract_id: CLIENT_PROJECT,
    release_condition: "also_client_acceptance",
  };
  try {
    const x = await startedRequest("supplier");
    const dlv = await save(x.r);
    await submit(x.r, dlv);
    await decide2(x.r, dlv);
    const p = await plan(x.r, {
      u: M,
      modality: "delivery",
      components: [
        {
          type: "delivery",
          amount: 15000,
          source_clause: "Cláusula 5 — preço fechado da entrega",
          due_days: 15,
          delivery_id: dlv,
          delivery_version: 1,
        },
      ],
    });
    await move(x.r, p, "submitted", M);
    await move(x.r, p, "approved", CEO);
    return { ...x, dlv, p };
  } finally {
    formExtra = {};
  }
}
const MONTH = () => today().slice(0, 8) + "01";
const register = async (
  r: R,
  dlv: string,
  o: Partial<{ u: string; w: string; target: string; op: string; hash: string }> = {},
) => {
  const hash = o.hash ?? (await currentHash(dlv));
  return user(o.u ?? U, (tx) =>
    tx`select hiring_client_acceptance_register(${o.w ?? W},${r.id},${dlv},1,${hash},'project',${o.target ?? CLIENT_PROJECT},'Maria Cliente','Gerente de TI',current_date,'Termo de aceite assinado pelo cliente final (ata 12)',${o.op ?? randomUUID()}) v`.then(
      (x) => x[0].v as string,
    ),
  );
};
const confirm = async (r: R, a: string, o: Partial<{ u: string; w: string }> = {}) => {
  const h = (await db`select content_hash from hiring_client_acceptances where id=${a}`)[0]
    .content_hash;
  return user(o.u ?? CEO, (tx) =>
    tx`select hiring_client_acceptance_decide(${o.w ?? W},${r.id},${a},${h},'confirmed','Aceite conferido com o cliente.',${randomUUID()}) v`.then(
      (x) => x[0].v as string,
    ),
  );
};
it("client acceptance: ready requires client purpose with a canonical link", async () => {
  await reset();
  formExtra = { release_condition: "also_client_acceptance" };
  try {
    await expect(ready("supplier")).rejects.toThrow("finalidade Cliente");
  } finally {
    formExtra = {};
  }
});
it("client acceptance: WK technical acceptance alone never releases the supplier payable", async () => {
  const x = await supplierClient();
  expect((await pctx(x.r.id, MONTH())).eligible.lines[0].blocking).toBe(
    "client_acceptance_missing",
  );
  const a = await register(x.r, x.dlv);
  expect((await pctx(x.r.id, MONTH())).eligible.lines[0].blocking).toBe(
    "client_acceptance_missing",
  );
  await expect(confirm(x.r, a, { u: U })).rejects.toThrow(/Financeiro configurado|Sem permissão/);
  await confirm(x.r, a);
  const line = (await pctx(x.r.id, MONTH())).eligible.lines[0];
  expect(line.blocking).toBeNull();
  const d = await doc(x.r, {
    kind: "supplier",
    regime: null,
    issuer: SUPPLIER_CNPJ,
    amount: 15000,
    delivery: x.dlv,
  });
  const sid = await gen(x.r, {
    u: M,
    month: MONTH(),
    keys: [line.key],
    inst: [{ amount: 15000, due_on: today() }],
    doc: d,
  });
  expect(
    (
      await db`select client_acceptance_id from hiring_payable_source_claims where schedule_id=${sid}`
    )[0].client_acceptance_id,
  ).toBe(a);
  await expect(
    db`update hiring_execution_deliveries set version=2 where id=${x.dlv}`,
  ).rejects.toThrow("não muda");
});
it("client acceptance must point at the request's canonical target and the exact accepted version", async () => {
  const x = await supplierClient();
  await expect(register(x.r, x.dlv, { target: P })).rejects.toThrow("canônico");
  await expect(register(x.r, x.dlv, { hash: "0".repeat(64) })).rejects.toThrow("STALE");
});
it("client acceptance: the registrant cannot confirm it", async () => {
  const x = await supplierClient();
  const a = await register(x.r, x.dlv, { u: CEO });
  await expect(confirm(x.r, a)).rejects.toThrow("Quem registrou");
});

type PAction = "generate" | "reconcile" | "view" | "client_register" | "client_confirm";
const PKEYS: Record<PAction, { key: string; actor: string; kind: string }> = {
  generate: { key: "payables.manage", actor: U, kind: "professional" },
  reconcile: { key: "payables_reconciliation.approve", actor: CEO, kind: "professional" },
  view: { key: "payables.view", actor: CEO, kind: "professional" },
  client_register: { key: "client_acceptance.manage", actor: U, kind: "supplier" },
  client_confirm: { key: "client_acceptance.approve", actor: CEO, kind: "supplier" },
};
async function pscenario(
  action: PAction,
  mode: "allowed" | "missing" | "deny" | "foreign" | "inactive",
) {
  let run: (w: string) => Promise<unknown>;
  if (action === "generate") {
    const x = await approvedPlan();
    const d = await doc(x.r);
    const hash = (await pctx(x.r.id)).eligible.preview_hash as string;
    run = (w) => gen(x.r, { w, doc: d, hash });
  } else if (action === "reconcile") {
    const x = await approvedPlan();
    const legacy = await payroll(),
      d = await doc(x.r);
    const hash = (await pctx(x.r.id)).eligible.preview_hash as string;
    run = (w) => recon(x.r, legacy, { w, doc: d, hash });
  } else if (action === "view") {
    const x = await approvedPlan();
    run = (w) =>
      pctx(x.r.id, PREV, CEO, w).then((c) => {
        if (!c.can_view || !c.eligible) throw Error("Sem permissão (oculto)");
        return "ok";
      });
  } else {
    const x = await supplierClient();
    const h = await currentHash(x.dlv);
    if (action === "client_register") run = (w) => register(x.r, x.dlv, { w, hash: h });
    else {
      const a = await register(x.r, x.dlv);
      run = (w) => confirm(x.r, a, { w });
    }
  }
  const { key, actor, kind } = PKEYS[action];
  const full = prefix(kind) + "." + key + ".workspace";
  if (mode === "missing")
    await db`delete from job_role_permission_overrides where role_id=${actor} and permission_key=${full}`;
  if (mode === "deny")
    await db`update job_role_permission_overrides set effect='deny' where role_id=${actor} and permission_key=${full}`;
  if (mode === "inactive")
    await db`update workspace_members set status='inactive' where user_id=${actor}`;
  return run(mode === "foreign" ? B : W).then(
    (v) => (v ? "ok" : "empty"),
    (e: Error) => e.message,
  );
}
it("payables generate allowed", async () =>
  expect(await pscenario("generate", "allowed")).toBe("ok"));
it("payables generate rejects missing key", async () =>
  expect(await pscenario("generate", "missing")).toMatch(DENIED));
it("payables generate rejects explicit deny", async () =>
  expect(await pscenario("generate", "deny")).toMatch(DENIED));
it("payables generate rejects foreign workspace", async () =>
  expect(await pscenario("generate", "foreign")).toMatch(DENIED));
it("payables generate rejects inactive member", async () =>
  expect(await pscenario("generate", "inactive")).toMatch(DENIED));
for (const action of ["reconcile", "view", "client_register", "client_confirm"] as PAction[]) {
  it(`payables ${action} allowed`, async () =>
    expect(await pscenario(action, "allowed")).toBe("ok"));
  it(`payables ${action} rejects missing key`, async () =>
    expect(await pscenario(action, "missing")).toMatch(DENIED));
  it(`payables ${action} rejects explicit deny`, async () =>
    expect(await pscenario(action, "deny")).toMatch(DENIED));
  it(`payables ${action} rejects foreign workspace`, async () =>
    expect(await pscenario(action, "foreign")).toMatch(DENIED));
  it(`payables ${action} rejects inactive member`, async () =>
    expect(await pscenario(action, "inactive")).toMatch(DENIED));
}
it("payables also require the canonical TechFinance entries key", async () => {
  const x = await approvedPlan();
  const d = await doc(x.r);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${U} and permission_key='techfinance.entries.create.workspace'`;
  await expect(gen(x.r, { doc: d, hash: "x" })).rejects.toThrow("Sem permissão");
});
it("payables private amounts need contract and person access", async () => {
  const x = await approvedPlan();
  await db`update people set workspace_id=${B} where id=${D}`;
  const c = await pctx(x.r.id);
  expect([c.can_view, c.eligible ?? null, c.schedules]).toEqual([false, null, []]);
});

it("payables hide private prospective economics and fiscal documents without their read keys", async () => {
  const x = await approvedPlan();
  await doc(x.r);
  for (const suffix of ["economics.view", "fiscal_documents.view"]) {
    await db`update job_role_permission_overrides set effect='deny' where role_id=${CEO} and permission_key=${prefix("professional") + "." + suffix + ".workspace"}`;
    const c = await pctx(x.r.id);
    expect(c.can_generate).toBe(false);
    expect(c.can_reconcile).toBe(false);
    if (suffix === "economics.view") expect(c.eligible).toBeNull();
    else expect(c.documents).toEqual([]);
    await expect(recon(x.r, randomUUID(), { hash: "stale" })).rejects.toThrow(DENIED);
    await db`update job_role_permission_overrides set effect='grant' where role_id=${CEO} and permission_key=${prefix("professional") + "." + suffix + ".workspace"}`;
  }
});
it("payables block hidden canonical legacy sources rather than exposing amounts or treating them as empty", async () => {
  const x = await approvedPlan();
  const f = await payroll();
  const hash = (await pctx(x.r.id)).eligible.preview_hash;
  await db`insert into fixture_hidden_reads values(${CEO},${f}),(${U},${f})`;
  await expect(pctx(x.r.id)).rejects.toThrow("indisponíveis");
  await expect(gen(x.r, { hash, doc: await doc(x.r) })).rejects.toThrow("indisponíveis");
  expect(await count("hiring_payable_schedules")).toBe(0);
});
it("payables refuse a financial source hidden after its schedule was created", async () => {
  const x = await approvedPlan();
  await gen(x.r, { doc: await doc(x.r) });
  const f = (await db`select id from financial_entries`)[0].id;
  await db`insert into fixture_hidden_reads values(${CEO},${f})`;
  await expect(pctx(x.r.id)).rejects.toThrow("indisponíveis");
});
it("payables unrelated decisions are invalidated by source edits and require the current plan hash", async () => {
  const x = await approvedPlan();
  const f = await payroll(500);
  await expect(recon(x.r, f, { decision: "unrelated", hash: "stale" })).rejects.toThrow("STALE");
  await recon(x.r, f, { decision: "unrelated" });
  expect((await pctx(x.r.id)).legacy).toEqual([]);
  await db`update financial_entries set amount=600 where id=${f}`;
  expect((await pctx(x.r.id)).legacy).toHaveLength(1);
  await recon(x.r, f, { decision: "unrelated" });
  expect((await pctx(x.r.id)).legacy).toEqual([]);
  expect(await count("hiring_payable_reconciliations")).toBe(2);
});
it("payables recurrence unrelated decision is limited to the reviewed competence", async () => {
  const x = await approvedPlan();
  const f = randomUUID();
  await db`insert into financial_recurrences(id,workspace_id,owner_id,direction,template,cadence,start_date) values(${f},${W},${U},'payable',${db.json({ description: "Folha legado", amount: 500, notes: "[people_payroll:" + D + "]" })},'monthly',${PREV}::date)`;
  await recon(x.r, f, { decision: "unrelated" });
  expect((await pctx(x.r.id)).legacy).toEqual([]);
  expect((await pctx(x.r.id, MONTH())).legacy).toHaveLength(1);
  await db`update financial_recurrences set template=template||' {"amount":600}'::jsonb where id=${f}`;
  expect((await pctx(x.r.id)).legacy).toHaveLength(1);
});
it("payables reconciliation claim prevents later legacy payroll duplication", async () => {
  const x = await approvedPlan();
  const f = await payroll();
  await recon(x.r, f, { doc: await doc(x.r) });
  await expect(payroll()).rejects.toThrow("Competência já possui obrigação");
});
it("payables protect new-origin instruments before execution start", async () => {
  const x = await signed();
  await expect(
    db`insert into financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,description,amount,competence_date,due_date,legal_entity_id) values(${W},${U},'payable','contract',${x.k},'Obrigação precoce',100,current_date,current_date,${L})`,
  ).rejects.toThrow("fluxo governado");
});
it("payables refuse missing installment amounts atomically", async () => {
  const x = await approvedPlan();
  await expect(gen(x.r, { doc: await doc(x.r), inst: [{ due_on: DUE() } as any] })).rejects.toThrow(
    "valor explícito",
  );
  expect(await count("financial_entries")).toBe(0);
});
it("payables require server byte attestation even for a human-verified fiscal record", async () => {
  const x = await approvedPlan();
  const d = await doc(x.r);
  // Privileged fixture corruption simulates historic or inconsistent import, not an authenticated write.
  await db.begin(async (tx) => {
    await tx`set local session_replication_role=replica`;
    await tx`update hiring_fiscal_documents set server_sha256=null,server_attested_at=null where id=${d}`;
  });
  await expect(gen(x.r, { doc: d })).rejects.toThrow("confirmação dos bytes");
});
it("monthly cost stays unknown when another contract overlaps the same person", async () => {
  const x = await approvedPlan();
  const k = randomUUID();
  await db`insert into contracts(id,workspace_id,title,role) values(${k},${W},'Outro instrumento','client')`;
  await db`insert into ats_jobs(id,workspace_id) values(${k},${W})`;
  await db`insert into hiring_engagements(workspace_id,person_id,job_id,model_version_id,purpose,employment_type,legal_entity_id,purchase_contract_id,starts_at,status,created_by) values(${W},${D},${k},${k},'internal','pj',${L},${k},${PREV}::date,'active',${M})`;
  const c = await pctx(x.r.id);
  expect(c.eligible.lines[0].blocking).toBe("ambiguous_employment");
  expect(c.eligible.lines[0].amount).toBeNull();
  await expect(gen(x.r, { doc: await doc(x.r) })).rejects.toThrow("ambiguous_employment");
});

it("disposable fixture restores all triggers before each financial scenario", async () => {
  await reset();
  expect((await db`show jit`)[0].jit).toBe("off");
  expect((await db`show session_replication_role`)[0].session_replication_role).toBe("origin");
});

it("payables creation retains caller RLS on the supplier and WK entity parents", async () => {
  const x = await approvedPlan({}, "supplier");
  const hash = (await pctx(x.r.id)).eligible.preview_hash;
  const d = await doc(x.r, { kind: "supplier", regime: null, issuer: SUPPLIER_CNPJ });
  for (const parent of [C, L]) {
    await db`insert into fixture_hidden_reads values(${U},${parent})`;
    expect((await pctx(x.r.id, PREV, U)).can_generate).toBe(false);
    await expect(gen(x.r, { hash, doc: d })).rejects.toThrow(DENIED);
    await db`delete from fixture_hidden_reads where user_id=${U} and record_id=${parent}`;
  }
  expect(await count("financial_entries")).toBe(0);
});

it("payables retain the canonical PJ company as counterparty when the professional request includes it", async () => {
  formExtra = { company_id: C };
  try {
    const x = await approvedPlan();
    const d = await doc(x.r, { issuer: SUPPLIER_CNPJ });
    await gen(x.r, { doc: d });
    expect(
      (await db`select counterparty_company_id from financial_entries`)[0].counterparty_company_id,
    ).toBe(C);
  } finally {
    formExtra = {};
  }
});
it("payables reconciliation cannot substitute the named PJ company with a personal payroll title", async () => {
  formExtra = { company_id: C };
  try {
    const x = await approvedPlan();
    const f = await payroll();
    const d = await doc(x.r, { issuer: SUPPLIER_CNPJ });
    await expect(recon(x.r, f, { doc: d })).rejects.toThrow(/INCOMPATIBLE.*counterparty/);
    await db`update financial_entries set counterparty_company_id=${C} where id=${f}`;
    expect(await recon(x.r, f, { doc: d })).toBeTruthy();
  } finally {
    formExtra = {};
  }
});

// Package 5: exercise the cross-module and impersonation boundaries with real RPCs.
it.each(["professional", "supplier"])(
  "package5 %s payables never inherit the other module's action key",
  async (kind) => {
    const x = await approvedPlan({}, kind);
    const own = prefix(kind) + ".payables.manage.workspace";
    const other =
      prefix(kind === "professional" ? "supplier" : "professional") + ".payables.manage.workspace";
    const hash = (await pctx(x.r.id)).eligible.preview_hash as string;
    expect((await pctx(x.r.id, PREV, U)).can_generate).toBe(true);
    expect(
      (
        await db`select count(*)::int n from job_role_permission_overrides where role_id=${U} and permission_key=${other} and effect='grant'`
      )[0].n,
    ).toBe(1);
    await db`delete from job_role_permission_overrides where role_id=${U} and permission_key=${own}`;
    expect((await pctx(x.r.id, PREV, U)).can_generate).toBe(false);
    await expect(gen(x.r, { hash })).rejects.toThrow(DENIED);
    await db`insert into job_role_permission_overrides values(${W},${U},${own},'deny')`;
    await expect(gen(x.r, { hash })).rejects.toThrow(DENIED);
    expect(await count("financial_entries")).toBe(0);
    expect(await count("hiring_payable_source_claims")).toBe(0);
    expect(await count("financial_payments")).toBe(0);
  },
);

it.each(["professional", "supplier"])(
  "package5 %s role view-as remains read-only even with finance grants",
  async (kind) => {
    const x = await approvedPlan({}, kind);
    const hash = (await pctx(x.r.id)).eligible.preview_hash as string;
    expect((await pctx(x.r.id, PREV, U)).can_generate).toBe(true);
    const session = randomUUID();
    await db`insert into view_as_sessions values(${session},'role',null)`;
    const ro = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) =>
      user(U, async (tx) => {
        await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "authenticated", session_id: session })},true)`;
        return fn(tx);
      });
    const c = (
      await ro((tx) => tx`select hiring_payable_context(${W},${x.r.id},${PREV}::date) v`)
    )[0].v;
    expect(c.can_generate).toBe(false);
    expect(c.can_reconcile).toBe(false);
    expect(c.can_register_client).toBe(false);
    expect(c.can_confirm_client).toBe(false);
    await expect(
      ro(
        (tx) =>
          tx`select hiring_payable_generate(${W},${x.r.id},${PREV}::date,${hash},${tx.json(["monthly:" + PREV])},${tx.json([{ amount: 9300, due_on: DUE() }])},null,'Tentativa bloqueada em perfil de teste.',${randomUUID()})`,
      ),
    ).rejects.toThrow(DENIED);
    expect(await count("financial_entries")).toBe(0);
    expect(await count("hiring_payable_source_claims")).toBe(0);
    expect(await count("financial_payments")).toBe(0);
  },
);

it.each(["professional", "supplier"])(
  "package5 %s governed contract cannot be laundered through legacy regularization",
  async (kind) => {
    const { k, sid } = await startedRequest(kind);
    // Import-looking data cannot replace the protected hiring origin or its real signature chain.
    await user(
      M,
      (tx) =>
        tx`update contracts set source_file_path='fixture/imported.pdf',imported_from='pdf' where id=${k}`,
    );
    const before = (await db`select to_jsonb(c) v from contracts c where id=${k}`)[0].v;
    await expect(
      user(
        M,
        (tx) =>
          tx`select contract_legacy_recognize(${W},${k},null,'Documento importado não substitui contratação governada.',${randomUUID()})`,
      ),
    ).rejects.toThrow(/contratação|governado/);
    expect(
      (await db`select count(*)::int n from contract_legacy_records where contract_id=${k}`)[0].n,
    ).toBe(0);
    expect((await db`select to_jsonb(c) v from contracts c where id=${k}`)[0].v).toEqual(before);
    expect(
      (await db`select count(*)::int n from hiring_execution_starts where id=${sid}`)[0].n,
    ).toBe(1);
    expect((await db`select count(*)::int n from financial_payments`)[0].n).toBe(0);
  },
);
