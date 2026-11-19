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
import { randomUUID, createHash } from "node:crypto";
const PREPARED = "drizzle/migrations/0381_hiring_execution_start.sql";
const BATCH_B = "drizzle/migrations/0382_hiring_execution_deliveries_fiscal.sql";
// Package 4 batch B (ENTREGA-FISCAL): same disposable bootstrap as batch A plus prepared 0382.
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
const container = "techerp-deliveries-ci-" + randomUUID();
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
  root = mkdtempSync(join(tmpdir(), "hiring-deliveries-pg-"));
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
      `-k ${root} -h '' -p 55448 -F`,
      "-w",
      "start",
    ]);
    started = true;
    db = postgres({
      host: root,
      port: 55448,
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
  });
  await db.unsafe(
    "CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])",
  );
  // Batch B fixture: canonical tax ids and milestones (production columns), then the real prepared SQL.
  await db.unsafe(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS cnpj text;ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj text;ALTER TABLE people ADD COLUMN IF NOT EXISTS cnpj text;ALTER TABLE people ADD COLUMN IF NOT EXISTS personal_doc jsonb;
    ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS metadata jsonb;ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS owner uuid;
    CREATE TABLE project_milestones(id uuid PRIMARY KEY,workspace_id uuid,project_id uuid,name text,billable boolean DEFAULT false,bill_amount numeric,financial_entry_id uuid);
    ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fixture_milestone_read ON project_milestones FOR SELECT TO authenticated USING(workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND is_workspace_member(workspace_id,auth.uid()));`);
  await db.begin(async (tx) => {
    await tx.unsafe(readFileSync(BATCH_B, "utf8"));
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
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started && useNative)
    native("pg_ctl", ["-D", join(root, "data"), "-m", "fast", "-w", "stop"]);
  if (started && !useNative) dockerRun("rm", "-f", container);
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
      "TRUNCATE hiring_fiscal_document_events,hiring_fiscal_document_reviews,hiring_fiscal_documents,hiring_execution_delivery_decisions,hiring_execution_delivery_submissions,hiring_execution_delivery_versions,hiring_execution_deliveries,project_milestones,storage.objects,hiring_execution_starts,people_allocations,hiring_employment_events,hiring_engagements,ats_jobs,hiring_workspace_settings,contract_draft_approvers,hiring_formalization_events,hiring_draft_capabilities,hiring_formalizations,contract_drafts,contract_attachments,hiring_contract_evidence,esign_signers,esign_documents,contract_forsign_operations,contract_esign_deliveries,contract_handoff_settings CASCADE",
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
    await db`insert into legal_entities(id,workspace_id,name,cnpj) values(${L},${W},'WK fixture','11.222.333/0001-81')`;
    await db`insert into people(id,workspace_id,full_name,email,cnpj,personal_doc) values(${D},${W},'Pessoa real fixture','pessoa@example.test','22333444000190','{"cpf":"12345678901"}'::jsonb)`;
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
      tx`update contracts set body_html='Documento real revisado com condições e partes conferidas.',starts_at=current_date where id=${k}`,
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

// ---------------- Batch B: deliveries, versioned acceptance and private fiscal trail ----------------
const WK = "11222333000181",
  PJ = "22333444000190",
  SUP = "33444555000100";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
async function startedRequest(kind = "professional", regime = "pj") {
  const x = await signed(kind, regime);
  const sid = await start(x.r);
  return { ...x, sid };
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
const reserve = (r: R, u = U, w = W, mime = "application/pdf", size = 100, op = randomUUID()) =>
  user(u, (tx) =>
    tx`select hiring_fiscal_reserve(${w},${r.id},'nota.pdf',${mime},${size},${op}) v`.then(
      (x) => x[0].v as { id: string; path: string },
    ),
  );
const putObject = (path: string, u = U, size = 100) =>
  user(
    u,
    (tx) =>
      tx`insert into storage.objects(bucket_id,name,metadata) values('hiring-fiscal-documents',${path},${tx.json({ size })})`,
  );
type Fiscal = Partial<{
  u: string;
  type: string;
  modality: string | null;
  issuer: string;
  taker: string | null;
  number: string;
  hash: string;
  amount: number;
}>;
const register = async (r: R, doc: string, o: Fiscal = {}) => {
  const f = (
    await db`select f.*,o.metadata from hiring_fiscal_documents f join storage.objects o on o.name=f.storage_path and o.bucket_id='hiring-fiscal-documents' where f.id=${doc}`
  )[0];
  if (
    f &&
    Number(f.metadata?.size) === Number(f.size_bytes) &&
    /^[a-f0-9]{64}$/.test(o.hash ?? sha(doc))
  ) {
    await db.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
      await tx.unsafe("SET LOCAL ROLE service_role");
      await tx`select hiring_fiscal_attest(${W},${r.id},${doc},${f.uploaded_by},${o.hash ?? sha(doc)},${f.size_bytes},${f.mime_type})`;
    });
  }
  return user(o.u ?? U, (tx) =>
    tx`select hiring_fiscal_register(${W},${r.id},${doc},${o.hash ?? sha(doc)},${o.type ?? "nfse"},${o.modality ?? null},${o.issuer ?? PJ},${o.taker === undefined ? WK : o.taker},${o.amount ?? 1500},'BRL',${o.number ?? "NF-1"},current_date,null) v`.then(
      (x) => x[0].v as string,
    ),
  );
};
async function uploaded(r: R, o: Fiscal = {}) {
  const res = await reserve(r);
  await putObject(res.path);
  await register(r, res.id, o);
  return res;
}
const review = (
  r: R,
  doc: string,
  u = CEO,
  w = W,
  hash?: string,
  decision = "verified",
  op = randomUUID(),
) =>
  user(u, (tx) =>
    tx`select hiring_fiscal_review(${w},${r.id},${doc},${hash ?? sha(doc)},${decision},'Conferência humana do Financeiro.',${op}) v`.then(
      (x) => x[0].v as string,
    ),
  );
const openDoc = (r: R, doc: string, u = CEO, w = W) =>
  user(u, (tx) => tx`select hiring_fiscal_open(${w},${r.id},${doc}) v`.then((x) => x[0].v));
const opsContext = (id: string, u = U) =>
  user(u, (tx) => tx`select hiring_execution_ops_context(${W},${id}) v`.then((x) => x[0].v));

type Action = "save" | "submit" | "decide" | "fiscal_create" | "fiscal_view" | "fiscal_approve";
const ACTIONS: Record<Action, { key: string; actor: string }> = {
  save: { key: "deliveries.manage", actor: U },
  submit: { key: "deliveries.manage", actor: U },
  decide: { key: "deliveries.approve", actor: M },
  fiscal_create: { key: "fiscal_documents.create", actor: U },
  fiscal_view: { key: "fiscal_documents.view", actor: CEO },
  fiscal_approve: { key: "fiscal_documents.approve", actor: CEO },
};
async function scenario(
  action: Action,
  mode: "allowed" | "missing" | "deny" | "foreign" | "inactive",
) {
  const x = await startedRequest();
  const { key, actor } = ACTIONS[action];
  let run: (w: string) => Promise<unknown>;
  if (action === "save") run = (w) => save(x.r, { w });
  else if (action === "submit") {
    const d = await save(x.r);
    run = (w) => submit(x.r, d, 1, U, w);
  } else if (action === "decide") {
    const d = await save(x.r);
    await submit(x.r, d);
    run = (w) => decide2(x.r, d, { w });
  } else if (action === "fiscal_create")
    run = (w) =>
      user(
        U,
        (tx) =>
          tx`select hiring_fiscal_reserve(${w},${x.r.id},'nota.pdf','application/pdf',100,${randomUUID()})`,
      );
  else {
    const doc = await uploaded(x.r);
    run =
      action === "fiscal_view"
        ? (w) => openDoc(x.r, doc.id, CEO, w)
        : (w) => review(x.r, doc.id, CEO, w);
  }
  const full = prefix("professional") + "." + key + ".workspace";
  if (mode === "missing")
    await db`delete from job_role_permission_overrides where role_id=${actor} and permission_key=${full}`;
  if (mode === "deny")
    await db`update job_role_permission_overrides set effect='deny' where role_id=${actor} and permission_key=${full}`;
  if (mode === "inactive")
    await db`update workspace_members set status='inactive' where user_id=${actor}`;
  // Returns the observable outcome; each named test asserts it.
  return run(mode === "foreign" ? B : W).then(
    (v) => (v ? "ok" : "empty"),
    (e: Error) => e.message,
  );
}
it("ops save delivery allowed", async () => expect(await scenario("save", "allowed")).toBe("ok"));
it("ops save delivery rejects missing key", async () =>
  expect(await scenario("save", "missing")).toContain("Sem permissão"));
it("ops save delivery rejects explicit deny", async () =>
  expect(await scenario("save", "deny")).toContain("Sem permissão"));
it("ops save delivery rejects foreign workspace", async () =>
  expect(await scenario("save", "foreign")).toContain("Sem permissão"));
it("ops save delivery rejects inactive member", async () =>
  expect(await scenario("save", "inactive")).toContain("Sem permissão"));
it("ops submit delivery allowed", async () =>
  expect(await scenario("submit", "allowed")).toBe("ok"));
it("ops submit delivery rejects missing key", async () =>
  expect(await scenario("submit", "missing")).toContain("Sem permissão"));
it("ops submit delivery rejects explicit deny", async () =>
  expect(await scenario("submit", "deny")).toContain("Sem permissão"));
it("ops submit delivery rejects foreign workspace", async () =>
  expect(await scenario("submit", "foreign")).toContain("Sem permissão"));
it("ops submit delivery rejects inactive member", async () =>
  expect(await scenario("submit", "inactive")).toContain("Sem permissão"));
it("ops decide delivery allowed", async () =>
  expect(await scenario("decide", "allowed")).toBe("ok"));
it("ops decide delivery rejects missing key", async () =>
  expect(await scenario("decide", "missing")).toContain("Sem permissão"));
it("ops decide delivery rejects explicit deny", async () =>
  expect(await scenario("decide", "deny")).toContain("Sem permissão"));
it("ops decide delivery rejects foreign workspace", async () =>
  expect(await scenario("decide", "foreign")).toContain("Sem permissão"));
it("ops decide delivery rejects inactive member", async () =>
  expect(await scenario("decide", "inactive")).toContain("Sem permissão"));
it("ops fiscal upload allowed", async () =>
  expect(await scenario("fiscal_create", "allowed")).toBe("ok"));
it("ops fiscal upload rejects missing key", async () =>
  expect(await scenario("fiscal_create", "missing")).toContain("Sem permissão"));
it("ops fiscal upload rejects explicit deny", async () =>
  expect(await scenario("fiscal_create", "deny")).toContain("Sem permissão"));
it("ops fiscal upload rejects foreign workspace", async () =>
  expect(await scenario("fiscal_create", "foreign")).toContain("Sem permissão"));
it("ops fiscal upload rejects inactive member", async () =>
  expect(await scenario("fiscal_create", "inactive")).toContain("Sem permissão"));
it("ops fiscal download allowed", async () =>
  expect(await scenario("fiscal_view", "allowed")).toBe("ok"));
it("ops fiscal download rejects missing key", async () =>
  expect(await scenario("fiscal_view", "missing")).toContain("Sem permissão"));
it("ops fiscal download rejects explicit deny", async () =>
  expect(await scenario("fiscal_view", "deny")).toContain("Sem permissão"));
it("ops fiscal download rejects foreign workspace", async () =>
  expect(await scenario("fiscal_view", "foreign")).toContain("Sem permissão"));
it("ops fiscal download rejects inactive member", async () =>
  expect(await scenario("fiscal_view", "inactive")).toContain("Sem permissão"));
it("ops fiscal review allowed", async () =>
  expect(await scenario("fiscal_approve", "allowed")).toBe("ok"));
it("ops fiscal review rejects missing key", async () =>
  expect(await scenario("fiscal_approve", "missing")).toContain("Sem permissão"));
it("ops fiscal review rejects explicit deny", async () =>
  expect(await scenario("fiscal_approve", "deny")).toContain("Sem permissão"));
it("ops fiscal review rejects foreign workspace", async () =>
  expect(await scenario("fiscal_approve", "foreign")).toContain("Sem permissão"));
it("ops fiscal review rejects inactive member", async () =>
  expect(await scenario("fiscal_approve", "inactive")).toContain("Sem permissão"));

it("ops deliveries and fiscal documents require an authorized start", async () => {
  const x = await signed();
  await expect(save(x.r)).rejects.toThrow("início autorizado");
  await expect(reserve(x.r)).rejects.toThrow("início autorizado");
});
it("ops acceptance is explicit, versioned and later edits keep history but reopen the delivery", async () => {
  const x = await startedRequest();
  const d = await save(x.r);
  await submit(x.r, d);
  const first = await decide2(x.r, d);
  expect(
    (await db`select status,version from hiring_execution_deliveries where id=${d}`)[0],
  ).toMatchObject({ status: "accepted", version: 1 });
  await expect(save(x.r, { delivery: d, version: 1 })).rejects.toThrow("Justifique");
  await save(x.r, {
    delivery: d,
    version: 1,
    reason: "Critério ajustado com o cliente",
    title: "Entrega revisada",
  });
  const row = (await db`select status,version from hiring_execution_deliveries where id=${d}`)[0];
  expect(row).toMatchObject({ status: "open", version: 2 });
  expect(
    (await db`select count(*)::int n from hiring_execution_delivery_decisions where id=${first}`)[0]
      .n,
  ).toBe(1);
  const ctx = await opsContext(x.r.id);
  const types = ctx.deliveries[0].history.map((h: { type: string }) => h.type);
  expect(types).toEqual(["version", "submission", "accepted", "version"]);
  await expect(
    db`update hiring_execution_delivery_decisions set reason='alterado' where id=${first}`,
  ).rejects.toThrow("imutável");
});
it("ops stale version or hash cannot be accepted", async () => {
  const x = await startedRequest();
  const d = await save(x.r);
  await submit(x.r, d);
  await expect(decide2(x.r, d, { hash: "f".repeat(64) })).rejects.toThrow("STALE");
  const old = await currentHash(d);
  await save(x.r, { delivery: d, version: 1, reason: "Mudança de período combinada" });
  await submit(x.r, d, 2);
  await expect(decide2(x.r, d, { version: 1, hash: old })).rejects.toThrow("STALE");
  await expect(decide2(x.r, d, { version: 2, hash: old })).rejects.toThrow("STALE");
  await expect(decide2(x.r, d, { version: 2 })).resolves.toBeTruthy();
});
it("ops only the named responsible decides and never the author or submitter", async () => {
  const x = await startedRequest();
  await expect(save(x.r, { responsible: U })).rejects.toThrow("não pode ser o responsável");
  const d = await save(x.r);
  await submit(x.r, d);
  await expect(decide2(x.r, d, { u: CEO })).rejects.toThrow("responsável nomeado");
  const d2 = await save(x.r, { u: M, responsible: CEO });
  await submit(x.r, d2, 1, U);
  await expect(decide2(x.r, d2, { u: CEO })).resolves.toBeTruthy();
  await db`delete from job_role_permission_overrides where role_id=${D} and permission_key=${prefix("professional") + ".deliveries.approve.workspace"}`;
  await expect(save(x.r, { responsible: D })).rejects.toThrow("sem permissão de aceitar");
});
it("ops broken signature or changed request blocks new acceptance without deleting history", async () => {
  const x = await startedRequest();
  const d = await save(x.r);
  await submit(x.r, d);
  await db`update hiring_contract_evidence set revoked_at=now() where contract_id=${x.k}`;
  await expect(decide2(x.r, d)).rejects.toThrow("assinatura íntegra");
  await expect(reserve(x.r)).rejects.toThrow("assinatura íntegra");
  expect(
    (
      await db`select count(*)::int n from hiring_execution_delivery_versions where delivery_id=${d}`
    )[0].n,
  ).toBe(1);
  expect((await opsContext(x.r.id)).proof_problem).toContain("assinatura íntegra");
});
it("ops project and milestone use canonical references without touching billing fields", async () => {
  const x = await startedRequest();
  const P = randomUUID(),
    P2 = randomUUID(),
    MS = randomUUID(),
    L2 = randomUUID();
  await db`insert into legal_entities(id,workspace_id,name) values(${L2},${W},'Outra WK')`;
  await db`insert into projects(id,workspace_id,name) values(${P},${W},'Projeto real')`;
  await db`insert into projects(id,workspace_id,name,legal_entity_id) values(${P2},${W},'Projeto outra WK',${L2})`;
  await db`insert into project_milestones(id,workspace_id,project_id,name,billable,bill_amount) values(${MS},${W},${P},'Marco 1',true,5000)`;
  await expect(save(x.r, { project: P2 })).rejects.toThrow("Entidade WK do projeto");
  const foreignEntityContract = randomUUID(),
    projectByContract = randomUUID();
  await db`insert into contracts(id,workspace_id,title,role,contracting_legal_entity_id) values(${foreignEntityContract},${W},'Outra entidade contratual','provider',${L2})`;
  await db`insert into projects(id,workspace_id,name,contract_id) values(${projectByContract},${W},'Projeto por contrato',${foreignEntityContract})`;
  await expect(save(x.r, { project: projectByContract })).rejects.toThrow("Entidade WK do projeto");
  await expect(save(x.r, { project: P2, milestone: MS })).rejects.toThrow();
  await expect(save(x.r, { milestone: MS })).rejects.toThrow("Marco exige projeto");
  const foreignProject = randomUUID();
  await db`insert into projects(id,workspace_id,name) values(${foreignProject},${B},'Projeto estrangeiro')`;
  await expect(save(x.r, { project: foreignProject })).rejects.toThrow("indisponível");
  const d = await save(x.r, { project: P, milestone: MS });
  expect(d).toBeTruthy();
  expect(
    (
      await db`select billable,bill_amount::text a,financial_entry_id from project_milestones where id=${MS}`
    )[0],
  ).toMatchObject({ billable: true, a: "5000", financial_entry_id: null });
});
it("ops retries reject changed delivery, submission, decision and fiscal payloads", async () => {
  const x = await startedRequest();
  const op = randomUUID();
  const d = await save(x.r, { op });
  await expect(save(x.r, { op, title: "Alteração indevida na repetição" })).rejects.toThrow(
    "outros dados",
  );
  const submissionOp = randomUUID();
  await submit(x.r, d, 1, U, W, submissionOp);
  await expect(submit(x.r, d, 2, U, W, submissionOp)).rejects.toThrow("outros dados");
  const decisionOp = randomUUID();
  await decide2(x.r, d, { op: decisionOp });
  await expect(decide2(x.r, d, { op: decisionOp, decision: "rejected" })).rejects.toThrow(
    "outros dados",
  );
  const fiscalOp = randomUUID();
  const doc = await reserve(x.r, U, W, "application/pdf", 100, fiscalOp);
  await expect(reserve(x.r, U, W, "image/png", 100, fiscalOp)).rejects.toThrow("outros dados");
  await putObject(doc.path);
  await register(x.r, doc.id);
  await expect(register(x.r, doc.id, { amount: 1600 })).rejects.toThrow("já registrado");
  const reviewOp = randomUUID();
  await review(x.r, doc.id, CEO, W, undefined, "verified", reviewOp);
  await expect(review(x.r, doc.id, CEO, W, undefined, "rejected", reviewOp)).rejects.toThrow(
    "outros dados",
  );
  expect(
    (
      await db`select count(*)::int n from hiring_execution_delivery_versions where delivery_id=${d}`
    )[0].n,
  ).toBe(1);
  expect(
    (
      await db`select count(*)::int n from hiring_fiscal_document_reviews where document_id=${doc.id}`
    )[0].n,
  ).toBe(1);
});
it("ops concurrent decisions with the same operation are idempotent and different operations decide once", async () => {
  const x = await startedRequest();
  const d = await save(x.r);
  await submit(x.r, d);
  const op = randomUUID();
  const [a, b] = await Promise.all([decide2(x.r, d, { op }), decide2(x.r, d, { op })]);
  expect(a).toBe(b);
  const d2 = await save(x.r);
  await submit(x.r, d2);
  const res = await Promise.allSettled([
    decide2(x.r, d2),
    decide2(x.r, d2, { decision: "rejected" }),
  ]);
  expect(res.filter((y) => y.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      await db`select count(*)::int n from hiring_execution_delivery_decisions where delivery_id=${d2}`
    )[0].n,
  ).toBe(1);
});
it("ops read-only view-as cannot write deliveries or fiscal documents", async () => {
  const x = await startedRequest();
  const session = randomUUID();
  await db`insert into view_as_sessions values(${session},'role',null)`;
  const ro = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    db.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "authenticated", session_id: session })},true)`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      return fn(tx);
    });
  await expect(
    ro(
      (tx) =>
        tx`select hiring_delivery_save(${W},${x.r.id},null,null,'Entrega','Critério suficientemente descrito.',current_date,current_date,${M},null,null,null,${randomUUID()})`,
    ),
  ).rejects.toThrow("permissão");
  await expect(
    ro(
      (tx) =>
        tx`select hiring_fiscal_reserve(${W},${x.r.id},'n.pdf','application/pdf',10,${randomUUID()})`,
    ),
  ).rejects.toThrow("permissão");
  expect(
    (await ro((tx) => tx`select hiring_execution_ops_context(${W},${x.r.id}) v`))[0].v
      .can_manage_deliveries,
  ).toBe(false);
});
it("ops fiscal values, tax ids and files stay private without the fiscal view key", async () => {
  const x = await startedRequest();
  const doc = await uploaded(x.r);
  await db`delete from job_role_permission_overrides where role_id=${M} and permission_key=${prefix("professional") + ".fiscal_documents.view.workspace"}`;
  const ctx = await opsContext(x.r.id, M);
  expect(ctx.fiscal).toBeNull();
  expect(JSON.stringify(ctx)).not.toContain(PJ);
  expect(JSON.stringify(ctx)).not.toContain("1500");
  await expect(user(M, (tx) => tx`select amount from hiring_fiscal_documents`)).rejects.toThrow(
    "permission denied",
  );
  await expect(user(M, (tx) => tx`select * from hiring_execution_deliveries`)).rejects.toThrow(
    "permission denied",
  );
  expect(
    (
      await user(M, (tx) => tx`select count(*)::int n from storage.objects where name=${doc.path}`)
    )[0].n,
  ).toBe(0);
  expect(
    (
      await user(
        CEO,
        (tx) => tx`select count(*)::int n from storage.objects where name=${doc.path}`,
      )
    )[0].n,
  ).toBe(1);
  const full = await opsContext(x.r.id, CEO);
  expect(full.fiscal[0]).toMatchObject({
    issuer_tax_id: PJ,
    taker_tax_id: WK,
    currency: "BRL",
    status: "registered",
  });
});
it("ops storage accepts uploads only into a fresh reservation of the caller", async () => {
  const x = await startedRequest();
  const res = await reserve(x.r);
  await expect(putObject(res.path, CEO)).rejects.toThrow();
  await expect(putObject(`${W}/${x.r.id}/${randomUUID()}`)).rejects.toThrow();
  await expect(register(x.r, res.id)).rejects.toThrow("Upload não concluído");
  await putObject(res.path, U, 999);
  await expect(register(x.r, res.id)).rejects.toThrow("tamanho divergente");
});
it("ops fiscal upload enforces type, size and SHA-256 format", async () => {
  const x = await startedRequest();
  await expect(reserve(x.r, U, W, "application/x-msdownload")).rejects.toThrow("Tipo de arquivo");
  await expect(reserve(x.r, U, W, "application/pdf", 10485761)).rejects.toThrow("10 MB");
  const res = await reserve(x.r);
  await putObject(res.path);
  await expect(register(x.r, res.id, { hash: "abc" })).rejects.toThrow("SHA-256");
});
it("ops fiscal CNPJ issuer and taker must match canonical records", async () => {
  const x = await startedRequest();
  const res = await reserve(x.r);
  await putObject(res.path);
  await expect(register(x.r, res.id, { issuer: SUP })).rejects.toThrow("emitente diverge");
  await expect(register(x.r, res.id, { taker: SUP })).rejects.toThrow("tomador");
  await expect(register(x.r, res.id, { type: "payroll_evidence" })).rejects.toThrow("PJ exige");
  await db`update people set cnpj=null where id=${D}`;
  await expect(register(x.r, res.id)).rejects.toThrow("formalização mudaram");
});
it("ops CLT requires payroll evidence issued by the WK entity", async () => {
  const x = await startedRequest("professional", "clt");
  const res = await reserve(x.r);
  await putObject(res.path);
  await expect(register(x.r, res.id)).rejects.toThrow("CLT exige");
  await expect(register(x.r, res.id, { type: "payroll_evidence", issuer: WK })).rejects.toThrow(
    "não tem tomador",
  );
  await expect(
    register(x.r, res.id, { type: "payroll_evidence", issuer: WK, taker: null, number: "2026-11" }),
  ).resolves.toBeTruthy();
});
it("ops freelance requires an explicit modality without inferred fiscal policy", async () => {
  const x = await startedRequest("professional", "freelance");
  const res = await reserve(x.r);
  await putObject(res.path);
  await expect(register(x.r, res.id, { type: "nfse" })).rejects.toThrow("modalidade explícita");
  await expect(
    register(x.r, res.id, { type: "freelance_document", modality: "rpa", issuer: SUP }),
  ).rejects.toThrow("emitente diverge");
  await expect(
    register(x.r, res.id, { type: "freelance_document", modality: "rpa", issuer: "12345678901" }),
  ).resolves.toBeTruthy();
});
it("ops supplier invoice uses the supplier company CNPJ", async () => {
  const x = await startedRequest("supplier");
  const res = await reserve(x.r);
  await putObject(res.path);
  await expect(register(x.r, res.id)).rejects.toThrow("emitente diverge");
  await expect(register(x.r, res.id, { issuer: SUP, type: "nfe" })).resolves.toBeTruthy();
});
it("ops duplicate fiscal identity or bytes are rejected", async () => {
  const x = await startedRequest();
  const a = await uploaded(x.r);
  const res = await reserve(x.r);
  await putObject(res.path);
  await expect(register(x.r, res.id, { number: "nf-1 " })).rejects.toThrow("duplicado");
  const bytesDuplicate = await reserve(x.r);
  await putObject(bytesDuplicate.path);
  await expect(
    register(x.r, bytesDuplicate.id, { number: "NF-2", hash: sha(a.id) }),
  ).rejects.toThrow("duplicado");
  const valid = await reserve(x.r);
  await putObject(valid.path);
  await expect(register(x.r, valid.id, { number: "NF-2" })).resolves.toBeTruthy();
});

it("ops fiscal register rejects a hash declared directly without trusted byte attestation", async () => {
  const x = await startedRequest();
  const res = await reserve(x.r);
  await putObject(res.path);
  await expect(
    user(
      U,
      (tx) =>
        tx`select hiring_fiscal_register(${W},${x.r.id},${res.id},${sha(res.id)},'nfse',null,${PJ},${WK},1500,'BRL','NF-DIRECT',current_date,null)`,
    ),
  ).rejects.toThrow("confirmado pelo servidor");
  await expect(
    user(U, async (tx) => {
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "service_role" })},true)`;
      return tx`select hiring_fiscal_attest(${W},${x.r.id},${res.id},${U},${sha(res.id)},100,'application/pdf')`;
    }),
  ).rejects.toThrow("permission denied");
  expect((await db`select status from hiring_fiscal_documents where id=${res.id}`)[0].status).toBe(
    "pending_upload",
  );
});

async function attestScenario(mode: "allowed" | "missing" | "deny" | "foreign" | "inactive") {
  const x = await startedRequest();
  const doc = await reserve(x.r);
  await putObject(doc.path);
  const key = prefix("professional") + ".fiscal_documents.create.workspace";
  if (mode === "missing")
    await db`delete from job_role_permission_overrides where role_id=${U} and permission_key=${key}`;
  if (mode === "deny")
    await db`update job_role_permission_overrides set effect='deny' where role_id=${U} and permission_key=${key}`;
  if (mode === "inactive")
    await db`update workspace_members set status='inactive' where user_id=${U}`;
  return db
    .begin(async (tx) => {
      await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
      await tx.unsafe("SET LOCAL ROLE service_role");
      await tx`select hiring_fiscal_attest(${mode === "foreign" ? B : W},${x.r.id},${doc.id},${U},${sha(doc.id)},100,'application/pdf')`;
    })
    .then(
      () => "ok",
      (e: Error) => e.message,
    );
}
it("ops server attestation allowed for the authorized reservation owner", async () =>
  expect(await attestScenario("allowed")).toBe("ok"));
it("ops server attestation rejects missing owner permission", async () =>
  expect(await attestScenario("missing")).toContain("indisponível"));
it("ops server attestation rejects explicit owner deny", async () =>
  expect(await attestScenario("deny")).toContain("indisponível"));
it("ops server attestation rejects foreign workspace", async () =>
  expect(await attestScenario("foreign")).toContain("indisponível"));
it("ops server attestation rejects inactive owner", async () =>
  expect(await attestScenario("inactive")).toContain("indisponível"));

it("ops restrictive fiscal storage policies contain a broader permissive policy", async () => {
  const x = await startedRequest();
  const doc = await uploaded(x.r);
  await db`delete from job_role_permission_overrides where role_id=${M} and permission_key=${prefix("professional") + ".fiscal_documents.view.workspace"}`;
  await db.unsafe(
    "CREATE POLICY qa_broad_storage ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true)",
  );
  try {
    expect(
      (
        await user(
          M,
          (tx) => tx`select count(*)::int n from storage.objects where name=${doc.path}`,
        )
      )[0].n,
    ).toBe(0);
    expect(
      await user(
        U,
        (tx) => tx`update storage.objects set metadata='{}' where name=${doc.path} returning name`,
      ),
    ).toHaveLength(0);
    expect(
      await user(U, (tx) => tx`delete from storage.objects where name=${doc.path} returning name`),
    ).toHaveLength(0);
    await expect(putObject(`${W}/${x.r.id}/${randomUUID()}`)).rejects.toThrow();
    expect(
      (await db`select count(*)::int n from storage.objects where name=${doc.path}`)[0].n,
    ).toBe(1);
  } finally {
    await db.unsafe("DROP POLICY qa_broad_storage ON storage.objects");
  }
});
it("ops fiscal amount must be finite and positive after rounding", async () => {
  const x = await startedRequest();
  const doc = await reserve(x.r);
  await putObject(doc.path);
  await expect(register(x.r, doc.id, { amount: Number.NaN })).rejects.toThrow("valor positivo");
  await expect(register(x.r, doc.id, { amount: Number.POSITIVE_INFINITY })).rejects.toThrow(
    "valor positivo",
  );
  await expect(register(x.r, doc.id, { amount: 0.001 })).rejects.toThrow("valor positivo");
  await expect(register(x.r, doc.id, { amount: 1 })).resolves.toBeTruthy();
});
it("ops finance review is explicit, hash-bound, separated from the uploader and immutable", async () => {
  const x = await startedRequest();
  const doc = await uploaded(x.r);
  await expect(review(x.r, doc.id, U)).rejects.toThrow("Quem enviou");
  await expect(review(x.r, doc.id, M)).rejects.toThrow("responsável Financeiro");
  await expect(review(x.r, doc.id, CEO, W, "0".repeat(64))).rejects.toThrow("STALE");
  await review(x.r, doc.id);
  await expect(review(x.r, doc.id)).rejects.toThrow("STALE");
  await expect(db`update hiring_fiscal_documents set amount=1 where id=${doc.id}`).rejects.toThrow(
    "imutável",
  );
  await expect(db`delete from hiring_fiscal_documents where id=${doc.id}`).rejects.toThrow(
    "imutável",
  );
  const kinds = (
    await db`select kind from hiring_fiscal_document_events where document_id=${doc.id} order by created_at`
  ).map((e) => e.kind);
  expect(kinds).toEqual(["reserved", "registered", "verified"]);
  const opened = await openDoc(x.r, doc.id);
  expect(opened).toMatchObject({ path: doc.path, sha256: sha(doc.id) });
});
it("ops batch B creates no payable, payment, invite or engagement change", async () => {
  const x = await startedRequest();
  const d = await save(x.r);
  await submit(x.r, d);
  await decide2(x.r, d);
  const doc = await uploaded(x.r);
  await review(x.r, doc.id);
  const sql = readFileSync(BATCH_B, "utf8");
  expect(sql).not.toMatch(
    /financial_entries|financial_payments|bank_payments|hiring_employment_invite|UPDATE\s+(public\.)?(projects|project_milestones|services|contract_attachments|contracts)\b/i,
  );
  expect(
    (await db`select count(*)::int n from hiring_engagements where hiring_request_id=${x.r.id}`)[0]
      .n,
  ).toBe(1);
});
