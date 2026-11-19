import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import {
  chownSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// LEGADO-REGULARIZA lote A. Real PostgreSQL with production resolver bodies and the prepared 0385.
// Never reads a configured URL: nix PG17 when present, macOS TECHERP_NATIVE_PG=1 (Postgres.app 16, private socket), otherwise Docker PG17 pinned by digest on a local Unix socket (CI).
const PREPARED = "drizzle/migrations/0385_contract_legacy_regularization.sql";
const W = "aaaaaaaa-0000-4000-8000-0000000000c1",
  B = "aaaaaaaa-0000-4000-8000-0000000000c2",
  U = "bbbbbbbb-0000-4000-8000-0000000000c1",
  V = "bbbbbbbb-0000-4000-8000-0000000000c2",
  L = "cccccccc-0000-4000-8000-0000000000c1",
  C = "dddddddd-0000-4000-8000-0000000000c1",
  K = "eeeeeeee-0000-4000-8000-0000000000c1",
  DEAL = "ffffffff-0000-4000-8000-0000000000c1";
const SHA = "a".repeat(64);
let root = "",
  started = false;
let db: ReturnType<typeof postgres>;
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
const container = "techerp-contract-legacy-ci-" + randomUUID();
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
  const delimiter = tail.match(/AS\s+(\$[a-zA-Z_]*\$)/i)?.[1] ?? "$$";
  const first = tail.indexOf(delimiter),
    end = tail.indexOf(delimiter, first + delimiter.length);
  return tail.slice(0, tail.indexOf(";", end) + 1);
}
const allKeys = [
  "techcontracts.imports.manage.workspace",
  "techcontracts.contracts.create.workspace",
  "techcontracts.legacy_contracts.view.workspace",
  "techcontracts.legacy_contracts.create.workspace",
  "techcontracts.legacy_contracts.approve.workspace",
  "techcontracts.contracts.view.workspace",
  "techcontracts.contracts.update.workspace",
];
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "contract-legacy-pg-"));
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
      `-k ${root} -h '' -p 55461 -F -c jit=off`,
      "-w",
      "start",
    ]);
    started = true;
    db = postgres({
      host: root,
      port: 55461,
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
    "CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO authenticated;",
  );
  await db.unsafe(`CREATE TYPE contract_status AS ENUM('draft','in_review','in_negotiation','awaiting_signature','active','renewing','ended','terminated');
    ALTER TABLE contracts ADD owner_id uuid, ADD assigned_to uuid, ADD counterparty_company_id uuid, ADD parent_contract_id uuid, ADD number text,
      ADD status contract_status NOT NULL DEFAULT 'draft', ADD starts_at date, ADD ends_at date, ADD auto_renew boolean DEFAULT false, ADD body_html text,
      ADD public_token text, ADD signed_at timestamptz, ADD signed_pdf_path text, ADD metadata jsonb DEFAULT '{}', ADD signature_provider text,
      ADD signature_document_id text, ADD signature_operation_id text, ADD source_file_path text, ADD imported_from text, ADD document_kind text,
      ADD proposal_id uuid, ADD quote_id uuid, ADD hiring_request_origin uuid, ADD currency text, ADD payment_method text, ADD payment_terms jsonb,
      ADD notice_days int, ADD monthly_value numeric, ADD payment_day smallint, ADD hours_per_month int, ADD readjustment_index text, ADD readjustment_period text,
      ADD late_fee_percent numeric, ADD late_interest_monthly_percent numeric, ADD penalty_percent numeric, ADD amendment_of_id uuid, ADD service_scope text;
    CREATE TABLE contract_signature_packages(contract_id uuid); CREATE TABLE contract_esign_deliveries(contract_id uuid);
    CREATE TABLE contract_forsign_operations(contract_id uuid); CREATE TABLE hiring_contract_evidence(contract_id uuid);
    CREATE TABLE contract_drafts(id uuid,proposal_id uuid,workspace_id uuid,status text,updated_at timestamptz,client_decided_at timestamptz,decided_at timestamptz,deal_id uuid,body_html text,prepared_terms jsonb,revision int);
    CREATE TABLE services(id uuid PRIMARY KEY,workspace_id uuid,contract_id uuid,billing_hold text);
    CREATE TABLE financial_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),contract_id uuid);
    CREATE FUNCTION service_release_signature_billing(p uuid) RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$INSERT INTO financial_entries(contract_id) SELECT contract_id FROM services WHERE contract_id=p AND billing_hold IS NOT NULL RETURNING 1$$;
    CREATE TABLE user_group_members(group_id uuid,user_id uuid);
    CREATE TABLE techerp_api.subject_sessions(txid bigint,user_id uuid,workspace_id uuid);
    CREATE SCHEMA storage; CREATE TABLE storage.objects(bucket_id text,name text,user_metadata jsonb);
    GRANT USAGE ON SCHEMA storage TO authenticated,service_role; GRANT USAGE ON SCHEMA public TO service_role;
    GRANT UPDATE ON contracts TO authenticated;`);
  for (const [f, n] of [
    ["drizzle/migrations/0031_workspace_members_status_inactive.sql", "public.is_workspace_member"],
    ["drizzle/migrations/0046_view_as_role_only_readonly.sql", "public.is_read_only_view"],
    [
      "drizzle/migrations/0315_hiring_role_restrictions.sql",
      "techerp_api.effective_permissions_unchecked",
    ],
    [
      "drizzle/migrations/0249_permission_introspection_boundary.sql",
      "public.permission_metadata_access",
    ],
    [
      "drizzle/migrations/0249_permission_introspection_boundary.sql",
      "public.user_effective_permissions",
    ],
    [
      "drizzle/migrations/0120_activities_team_scope_active_membership.sql",
      "public.my_team_member_pairs",
    ],
    ["drizzle/migrations/0216_work_core_prepare.sql", "public.work_access_context"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "public.work_action_prefix"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "public.work_context_access"],
    ["drizzle/migrations/0219_order3_completion_activate.sql", "public.contract_process_guard"],
    [
      "drizzle/migrations/0361_service_billing_awaits_signature.sql",
      "public.contract_is_signed_for_billing",
    ],
    [
      "drizzle/migrations/0361_service_billing_awaits_signature.sql",
      "public.contracts_release_service_billing_trg",
    ],
  ] as const)
    await db.unsafe(body(f, n));
  await db.unsafe(permission);
  await db.unsafe(
    `INSERT INTO permissions(key) VALUES('techcontracts.contracts.view.workspace'),('techcontracts.contracts.update.workspace');`,
  );
  await db.unsafe(readFileSync(PREPARED, "utf8"));
  await db.unsafe(`ALTER TABLE storage.objects ADD owner uuid, ADD owner_id text;
    CREATE TABLE contract_approvals(id uuid,contract_id uuid);
    GRANT INSERT ON contracts TO authenticated;
    GRANT SELECT(id,status) ON workspaces TO authenticated;
    INSERT INTO permissions(key) VALUES('techcontracts.imports.manage.workspace'),('techcontracts.contracts.create.workspace');`);
  await db.unsafe(
    body(
      "drizzle/migrations/0218_order3_completion_prepare.sql",
      "public.work_contract_source_owned",
    ),
  );
  await db.unsafe(
    body("drizzle/migrations/0218_order3_completion_prepare.sql", "public.work_area_authorize"),
  );
  await db.unsafe(
    body("drizzle/migrations/0218_order3_completion_prepare.sql", "public.work_subject_context"),
  );
  await db.unsafe(
    readFileSync("drizzle/migrations/0387_contract_legacy_import_atomic.sql", "utf8"),
  );
  await db.unsafe(
    readFileSync("drizzle/migrations/0388_contract_legacy_validation_read_boundary.sql", "utf8"),
  );
  // Real existing canonical editor boundary used by the new party fields.
  await db.unsafe(`CREATE TABLE work_resource_catalog(resource text PRIMARY KEY,table_name name NOT NULL,responsible_columns text[] NOT NULL DEFAULT '{}',parent_column name,parent_resource text,shared boolean NOT NULL DEFAULT false);
    INSERT INTO work_resource_catalog VALUES('techcontracts.contracts','contracts',ARRAY['assigned_to','owner_id']::text[],NULL,NULL,false);`);
  for (const name of [
    "public.work_record_context_access",
    "public.work_record_json",
    "public.contract_mutate",
  ])
    await db.unsafe(body("drizzle/migrations/0218_order3_completion_prepare.sql", name));
  await db.unsafe(`REVOKE ALL ON FUNCTION work_record_context_access(jsonb,text,uuid,text,integer),work_record_json(text,uuid),contract_mutate(uuid,jsonb) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION work_record_json(text,uuid),contract_mutate(uuid,jsonb) TO authenticated;`);
  // Actual audit and contract handoff trigger bodies, with inert canonical tables.
  await db.unsafe(`CREATE TABLE contract_events(workspace_id uuid,contract_id uuid,actor_id uuid,event_type text,payload jsonb);
    CREATE TABLE proposals(id uuid);
    CREATE TABLE contract_handoff_settings(workspace_id uuid);
    CREATE TABLE contract_handoffs(workspace_id uuid,proposal_id uuid,step text,status text,contract_id uuid);
    ALTER TABLE contract_approvals ADD workspace_id uuid, ADD superseded_at timestamptz, ADD status text, ADD stage text, ADD sort_order int;
  `);
  for (const [f, n] of [
    ["drizzle/migrations/0219_order3_completion_activate.sql", "public.contract_change_audit"],
    ["drizzle/migrations/0362_contract_handoffs.sql", "public.contract_handoff_enqueue"],
    ["drizzle/migrations/0362_contract_handoffs.sql", "public.contract_handoff_source_event"],
  ] as const)
    await db.unsafe(body(f, n));
  await db.unsafe(`CREATE TRIGGER work_contract_change_audit AFTER UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contract_change_audit();
    CREATE TRIGGER contract_handoff_contract AFTER INSERT OR UPDATE OF status ON contracts FOR EACH ROW EXECUTE FUNCTION contract_handoff_source_event();`);

  await db.unsafe(`CREATE TRIGGER contract_accepted_draft_guard BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contract_accepted_draft_guard();
    CREATE TRIGGER zzzz_contract_process_guard BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contract_process_guard();
    CREATE TRIGGER zz_contracts_release_service_billing AFTER UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contracts_release_service_billing_trg();
    GRANT SELECT ON contracts TO service_role;`);
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
  if (started && !useNative) dockerRun("rm", "-f", container);
  if (root) rmSync(root, { recursive: true, force: true });
});

async function reset(contract: Record<string, unknown> = {}) {
  await db.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL session_replication_role=replica;
      DO $c$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN('permissions','work_resource_catalog') LOOP EXECUTE format('DELETE FROM public.%I',t.tablename);END LOOP;END $c$;
      DELETE FROM storage.objects; SET LOCAL session_replication_role=origin;`);
    await tx`insert into workspaces(id) values(${W}),(${B})`;
    for (const u of [U, V]) {
      await tx`insert into profiles values(${u},${W})`;
      await tx`insert into workspace_members(workspace_id,user_id) values(${W},${u})`;
      await tx`insert into job_roles values(${u},${W})`;
      await tx`insert into user_job_roles values(${u},${u},${W},null)`;
      await tx`insert into job_role_permission_overrides select ${W},${u},key,'grant' from permissions where key = any(${allKeys})`;
    }
    await tx`insert into legal_entities(id,workspace_id,name) values(${L},${W},'WK fixture')`;
    await tx`insert into companies(id,workspace_id,name) values(${C},${W},'Cliente fixture')`;
    await tx`insert into deals(id,workspace_id,name) values(${DEAL},${W},'Negócio real fixture')`;
    const row = {
      id: K,
      workspace_id: W,
      owner_id: U,
      title: "Contrato legado fixture",
      role: "provider",
      status: "draft",
      counterparty_company_id: C,
      contracting_legal_entity_id: L,
      body_html: "<p>Texto importado do DOCX</p>",
      source_file_path: "imports/legado.docx",
      imported_from: "docx",
      starts_at: "0025-01-01",
      metadata: { commercial_journey_version: 1 },
      ...contract,
    };
    await tx`insert into contracts ${tx(row as unknown as Record<string, string>)}`;
  });
}
async function as<T>(
  u: string | null,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
  claims: Record<string, unknown> = {},
) {
  return db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims',${JSON.stringify(u ? { sub: u, role: "authenticated", ...claims } : claims)},true)`;
    await tx.unsafe(u ? "SET LOCAL ROLE authenticated" : "SET LOCAL ROLE service_role");
    return fn(tx);
  });
}
const err = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as Error).message;
  }
};
const recognize = (u = U, op = randomUUID(), rev: number | null = null, w = W) =>
  as(u, (tx) =>
    tx`select contract_legacy_recognize(${w},${K},${rev},${"Contrato assinado em papel, importado do acervo"},${op}) r`.then(
      (x) => x[0].r,
    ),
  );
async function attachEvidence(sha = SHA, rev = 1) {
  const res = await as(U, (tx) =>
    tx`select contract_legacy_evidence_reserve(${W},${K},${rev},${"original-assinado.pdf"},${1234},${sha},${randomUUID()}) r`.then(
      (x) => x[0].r,
    ),
  );
  await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence',${res.path},${db.json({ sha256: sha, actor_id: U })})`;
  await as(
    null,
    (tx) => tx`select contract_legacy_evidence_attest(${W},${res.evidence_id},${U},${sha},${1234})`,
    { role: "service_role" },
  );
  return res.evidence_id as string;
}
const regularize = (ev: string, over: Record<string, unknown> = {}, u = U, op = randomUUID()) => {
  const a = {
    rev: 1,
    situation: "in_force",
    signed: "2023-03-10",
    confirmed: true,
    starts: "2023-03-15",
    ends: null,
    term: null,
    ar: false,
    arc: false,
    sha: SHA,
    ...over,
  };
  return as(u, (tx) =>
    tx`select contract_legacy_regularize(${W},${K},${a.rev as number},${a.situation as string},${a.signed as string}::date,${a.confirmed as boolean},
    ${a.starts as string}::date,${a.ends as string | null}::date,${a.term as string | null}::date,${a.ar as boolean},${a.arc as boolean},${ev},${a.sha as string},${"Pasta física 2023 / caixa 4"},${"Original assinado conferido pelo jurídico"},${op}) r`.then(
      (x) => x[0].r,
    ),
  );
};
const DENIED = /Sem permissão|somente leitura/;

type Mode = "allowed" | "missing" | "deny" | "foreign" | "inactive";
async function prepare(mode: Mode, key: string) {
  if (mode === "missing")
    await db`delete from job_role_permission_overrides where role_id=${U} and permission_key=${key}`;
  if (mode === "deny")
    await db`update job_role_permission_overrides set effect='deny' where role_id=${U} and permission_key=${key}`;
  if (mode === "inactive")
    await db`update workspace_members set status='inactive' where user_id=${U}`;
}
const scenarios: Mode[] = ["allowed", "missing", "deny", "foreign", "inactive"];
const attestCases = {} as Record<Mode, () => Promise<string>>;
const regularizeCases = {} as Record<Mode, () => Promise<string>>;
for (const mode of scenarios) {
  it(`legacy recognize ${mode}`, async () => {
    await reset();
    await prepare(mode, "techcontracts.legacy_contracts.create.workspace");
    const r = await err(recognize(U, randomUUID(), null, mode === "foreign" ? B : W));
    if (mode === "allowed") expect(r).toBe("ok");
    else expect(r).toMatch(DENIED);
  });
  it(`legacy evidence reserve ${mode}`, async () => {
    await reset();
    await recognize();
    await prepare(mode, "techcontracts.legacy_contracts.approve.workspace");
    const r = await err(
      as(
        U,
        (tx) =>
          tx`select contract_legacy_evidence_reserve(${mode === "foreign" ? B : W},${K},1,'a.pdf',1234,${SHA},${randomUUID()})`,
      ),
    );
    if (mode === "allowed") expect(r).toBe("ok");
    else expect(r).toMatch(DENIED);
  });
  attestCases[mode] = async () => {
    await reset();
    await recognize();
    const res = await as(U, (tx) =>
      tx`select contract_legacy_evidence_reserve(${W},${K},1,'a.pdf',1234,${SHA},${randomUUID()}) r`.then(
        (x) => x[0].r,
      ),
    );
    await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence',${res.path},${db.json({ sha256: SHA, actor_id: U })})`;
    await prepare(mode, "techcontracts.legacy_contracts.approve.workspace");
    const r = await err(
      as(
        null,
        (tx) =>
          tx`select contract_legacy_evidence_attest(${mode === "foreign" ? B : W},${res.evidence_id},${U},${SHA},1234)`,
        { role: "service_role" },
      ),
    );
    if (mode === "allowed") expect(r).toBe("ok");
    else expect(r).toMatch(/indisponível/);
    return r;
  };
  regularizeCases[mode] = async () => {
    await reset();
    await recognize();
    const ev = await attachEvidence();
    await prepare(mode, "techcontracts.legacy_contracts.approve.workspace");
    const r =
      mode === "foreign"
        ? await err(
            as(
              U,
              (tx) =>
                tx`select contract_legacy_regularize(${B},${K},1,'in_force','2023-03-10',true,'2023-03-15',null,null,false,false,${ev},${SHA},'Pasta 2023','Conferido jurídico',${randomUUID()})`,
            ),
          )
        : await err(regularize(ev));
    if (mode === "allowed") expect(r).toBe("ok");
    else expect(r).toMatch(DENIED);
    const [c] = await db`select status::text s from contracts where id=${K}`;
    expect(c.s).toBe(mode === "allowed" ? "active" : "draft");
    return r;
  };
  it(`legacy state view ${mode}`, async () => {
    await reset();
    await prepare(mode, "techcontracts.legacy_contracts.view.workspace");
    const r = await err(
      as(U, (tx) => tx`select contract_legacy_state(${mode === "foreign" ? B : W},${K})`),
    );
    if (mode === "allowed") expect(r).toBe("ok");
    else expect(r).toMatch(DENIED);
  });
}

it("legacy regularize allowed", async () => {
  expect(await regularizeCases.allowed()).toBe("ok");
});
it("legacy server attestation allowed", async () => {
  expect(await attestCases.allowed()).toBe("ok");
});
it("legacy regularize missing", async () => {
  expect(await regularizeCases.missing()).toMatch(DENIED);
});
it("legacy server attestation missing", async () => {
  expect(await attestCases.missing()).toMatch(/indisponível/);
});
it("legacy regularize deny", async () => {
  expect(await regularizeCases.deny()).toMatch(DENIED);
});
it("legacy server attestation deny", async () => {
  expect(await attestCases.deny()).toMatch(/indisponível/);
});
it("legacy regularize foreign", async () => {
  expect(await regularizeCases.foreign()).toMatch(DENIED);
});
it("legacy server attestation foreign", async () => {
  expect(await attestCases.foreign()).toMatch(/indisponível/);
});
it("legacy regularize inactive", async () => {
  expect(await regularizeCases.inactive()).toMatch(DENIED);
});
it("legacy server attestation inactive", async () => {
  expect(await attestCases.inactive()).toMatch(/indisponível/);
});
it("legacy actions require real contract access, not only the legacy key", async () => {
  await reset({ owner_id: V });
  await db`delete from job_role_permission_overrides where role_id=${U} and permission_key like 'techcontracts.contracts.%'`;
  expect(await err(recognize())).toMatch(DENIED);
});
it("view-as read-only session cannot recognize", async () => {
  await reset();
  const s = randomUUID();
  await db`insert into view_as_sessions values(${s},'role',null)`;
  expect(
    await err(
      as(
        U,
        (tx) =>
          tx`select contract_legacy_recognize(${W},${K},null,'Motivo válido',${randomUUID()})`,
        { session_id: s },
      ),
    ),
  ).toMatch(DENIED);
});
it("direct table access and caller-forged classification are impossible", async () => {
  await reset();
  expect(
    await err(
      as(
        U,
        (tx) =>
          tx`insert into contract_legacy_records(workspace_id,contract_id,contract_fingerprint,recognized_by,recognition_reason) values(${W},${K},${SHA},${U},'x')`,
      ),
    ),
  ).toMatch(/permission denied/);
  expect(await err(as(U, (tx) => tx`select * from contract_legacy_records`))).toMatch(
    /permission denied/,
  );
  expect(await err(as(U, (tx) => tx`update contracts set status='active' where id=${K}`))).toMatch(
    /transição/,
  );
  // metadata/imported_from/GUC never classify: a forged flag does not make the guard accept a new deal link.
  await as(U, (tx) => tx`select set_config('app.legacy','on',true)`);
  expect(
    await err(
      as(
        U,
        (tx) =>
          tx`update contracts set metadata=metadata||'{"legacy":true}', imported_from='legacy', deal_id=${DEAL} where id=${K}`,
      ),
    ),
  ).toMatch(/proposta e minuta/);
  expect(
    await err(
      as(U, (tx) => tx`select contract_legacy_evidence_attest(${W},${randomUUID()},${U},${SHA},1)`),
    ),
  ).toMatch(/permission denied/);
});
it("imported active and ended contracts are recognizable; status is kept until human regularization", async () => {
  for (const [status, situation, over] of [
    ["active", "in_force", {}],
    ["ended", "ended", { ends: "2024-01-31" }],
    ["terminated", "terminated", { ends: "2024-12-31", term: "2024-06-30" }],
  ] as const) {
    await reset({ status, signed_at: "2022-01-01T12:00:00Z" });
    const rec = await recognize();
    expect(rec.status).toBe("pending");
    const [row] =
      await db`select r.prior_status, r.prior_signed_at::text p, c.status::text s, c.signed_at::text sa
      from contract_legacy_records r join contracts c on c.id=r.contract_id where c.id=${K}`;
    expect(row).toMatchObject({ prior_status: status, s: status });
    expect(row.p).toBe(row.sa);
    // Pending never moves the canonical status nor accepts a signature by direct update.
    for (const q of ["signed_at=now()", "status='draft'"])
      expect(
        await err(as(U, (tx) => tx.unsafe(`update contracts set ${q} where id='${K}'`))),
      ).toMatch(/Contrato legado/);
    // Not even the table owner bypasses it without the private regularization marker.
    expect(await err(db`update contracts set signed_at=now() where id=${K}`)).toMatch(
      /Contrato legado/,
    );
    const ev = await attachEvidence();
    expect(await err(regularize(ev, { situation, ...over }))).toBe("ok");
    const [after] = await db`select status::text s from contracts where id=${K}`;
    expect(after.s).toBe(status);
    expect(Number((await db`select count(*) n from financial_entries`)[0].n)).toBe(0);
  }
});
it("extracted signature references are eligible, preserved and never proof; real ForSign is rejected", async () => {
  const ref = {
    signature_provider: "forsign",
    signature_document_id: "DOC-EXT-1",
    signature_operation_id: "OP-EXT-1",
  };
  await reset(ref);
  expect((await recognize()).status).toBe("pending");
  // Without attested PDF + human confirmation there is no regularization.
  expect(await err(regularize(randomUUID()))).toMatch(/Envie o PDF/);
  const ev = await attachEvidence();
  expect(await err(regularize(ev, { confirmed: false }))).toMatch(/Confirme/);
  expect(await err(regularize(ev))).toBe("ok");
  const [c] =
    await db`select signature_provider p, signature_document_id d, signature_operation_id o from contracts where id=${K}`;
  expect(c).toEqual({ p: "forsign", d: "DOC-EXT-1", o: "OP-EXT-1" });
  expect(
    await err(as(U, (tx) => tx`update contracts set signature_document_id=null where id=${K}`)),
  ).toMatch(/Contrato legado/);
  await reset(ref);
  await db`insert into contract_forsign_operations(contract_id) values(${K})`;
  expect(await err(recognize())).toMatch(/assinatura em curso/);
});
it("protected origins cannot be converted to legacy", async () => {
  for (const extra of [
    { hiring_request_origin: randomUUID() },
    { proposal_id: randomUUID() },
    { signed_pdf_path: "evidence/assinado.pdf" },
    { status: "awaiting_signature" },
    { metadata: { commercial_journey_version: 1, accepted_proposal: {} } },
    { source_file_path: null },
  ]) {
    await reset(extra);
    expect(await err(recognize())).toMatch(/governado|jornada|assinatura|importados/);
  }
  await reset();
  await db`insert into contract_esign_deliveries values(${K})`;
  expect(await err(recognize())).toMatch(/assinatura em curso/);
});
it("exact replay is idempotent and reused operation with other data conflicts", async () => {
  await reset();
  const op = randomUUID();
  const a = await recognize(U, op);
  const b = await recognize(U, op);
  expect(b.replayed).toBe(true);
  expect(b.id).toBe(a.id);
  expect(
    await err(
      as(
        U,
        (tx) => tx`select contract_legacy_recognize(${W},${K},null,'Outro motivo diferente',${op})`,
      ),
    ),
  ).toMatch(/CONFLICT/);
  const ev = await attachEvidence();
  const op2 = randomUUID();
  await regularize(ev, {}, U, op2);
  expect((await regularize(ev, {}, U, op2)).replayed).toBe(true);
  expect(await err(regularize(ev, { situation: "ended", ends: "2024-01-01" }, U, op2))).toMatch(
    /CONFLICT/,
  );
});
it("concurrent regularizations: only one succeeds", async () => {
  await reset();
  await recognize();
  const ev = await attachEvidence();
  const results = await Promise.all([err(regularize(ev)), err(regularize(ev))]);
  expect(results.filter((r) => r === "ok")).toHaveLength(1);
  expect(results.find((r) => r !== "ok")).toMatch(/já regularizado|STALE/);
  const [n] = await db`select count(*)::int n from contract_legacy_events where kind='regularized'`;
  expect(n.n).toBe(1);
});
it("stale revision, document change after recognition and wrong hash are blocked", async () => {
  await reset();
  await recognize();
  const ev = await attachEvidence();
  expect(await err(regularize(ev, { rev: 2 }))).toMatch(/STALE/);
  expect(await err(regularize(ev, { sha: "b".repeat(64) }))).toMatch(/STALE: hash/);
  await as(U, (tx) => tx`update contracts set body_html='<p>alterado</p>' where id=${K}`);
  expect(await err(regularize(ev))).toMatch(/documento alterado/);
  const re = await recognize(U, randomUUID(), 1);
  expect(re.revision).toBe(2);
  // Evidence of the old revision is superseded and cannot be reused.
  expect(await err(regularize(ev, { rev: 2 }))).toMatch(/Envie o PDF/);
  const ev2 = await attachEvidence("c".repeat(64), 2);
  expect(await err(regularize(ev2, { rev: 2, sha: "c".repeat(64) }))).toBe("ok");
  const [c] = await db`select source_file_path,body_html from contracts where id=${K}`;
  expect(c.source_file_path).toBe("imports/legado.docx");
});
it("private file: forged attestation, missing bytes and mismatched bytes are rejected", async () => {
  await reset();
  await recognize();
  const res = await as(U, (tx) =>
    tx`select contract_legacy_evidence_reserve(${W},${K},1,'a.pdf',1234,${SHA},${randomUUID()}) r`.then(
      (x) => x[0].r,
    ),
  );
  expect(
    await err(
      as(
        null,
        (tx) =>
          tx`select contract_legacy_evidence_attest(${W},${res.evidence_id},${U},${SHA},1234)`,
        { role: "service_role" },
      ),
    ),
  ).toMatch(/não encontrado/);
  await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence',${res.path},${db.json({ sha256: "d".repeat(64), actor_id: U })})`;
  expect(
    await err(
      as(
        null,
        (tx) =>
          tx`select contract_legacy_evidence_attest(${W},${res.evidence_id},${U},${"d".repeat(64)},1234)`,
        { role: "service_role" },
      ),
    ),
  ).toMatch(/difere/);
  expect(
    await err(
      as(
        null,
        (tx) =>
          tx`select contract_legacy_evidence_attest(${W},${res.evidence_id},${V},${SHA},1234)`,
        { role: "service_role" },
      ),
    ),
  ).toMatch(/indisponível/);
  // Not attested: regularization refuses the unconfirmed file.
  expect(await err(regularize(res.evidence_id))).toMatch(/Envie o PDF/);
  expect(
    await err(
      as(
        U,
        (tx) =>
          tx`select contract_legacy_evidence_reserve(${W},${K},1,'minuta.docx',1234,${SHA},${randomUUID()})`,
      ),
    ),
  ).toMatch(/PDF/);
});
it("dates, signature confirmation and auto renewal require human-confirmed plausible values", async () => {
  await reset();
  await recognize();
  const ev = await attachEvidence();
  expect(await err(regularize(ev, { confirmed: false }))).toMatch(/assinatura humana/);
  expect(await err(regularize(ev, { signed: "0025-01-01" }))).toMatch(/implausível/);
  expect(await err(regularize(ev, { starts: "0025-01-01" }))).toMatch(/implausível/);
  expect(await err(regularize(ev, { ends: "2023-01-01" }))).toMatch(/posterior/);
  expect(await err(regularize(ev, { starts: `${new Date().getUTCFullYear() + 2}-01-01` }))).toMatch(
    /Vigência futura/,
  );
  expect(await err(regularize(ev, { ar: true }))).toMatch(/Renovação automática/);
  expect(await err(regularize(ev, { situation: "ended" }))).toMatch(/encerrado exige/);
  expect(await err(regularize(ev, { situation: "terminated", term: "2022-01-01" }))).toMatch(
    /rescisão/,
  );
  expect(await err(regularize(ev, { situation: "terminated", term: "2024-02-01" }))).toBe("ok");
  const [c] = await db`select status::text s from contracts where id=${K}`;
  expect(c.s).toBe("terminated");
});
it("regularization preserves pending billing holds and creates no financial effects", async () => {
  await reset();
  await recognize();
  const ev = await attachEvidence();
  const service = randomUUID();
  await db`insert into services values(${service},${W},${K},'awaiting_signature')`;
  expect(await err(regularize(ev))).toBe("ok");
  expect((await db`select billing_hold from services where id=${service}`)[0].billing_hold).toBe(
    "awaiting_signature",
  );
  expect((await db`select count(*)::int n from financial_entries`)[0].n).toBe(0);
  expect((await db`select count(*)::int n from contract_legacy_apply`)[0].n).toBe(0);
});
it("ordinary signature billing trigger remains active outside legacy regularization", async () => {
  await reset();
  await db`insert into services values(${randomUUID()},${W},${K},'awaiting_signature')`;
  await db`update contracts set status='active' where id=${K}`;
  expect(
    (await db`select count(*)::int n from financial_entries where contract_id=${K}`)[0].n,
  ).toBe(1);
});
it("regularized contract keeps document immutable and only then accepts a real deal link", async () => {
  await reset();
  expect(await err(as(U, (tx) => tx`update contracts set deal_id=${DEAL} where id=${K}`))).toMatch(
    /proposta e minuta/,
  );
  await recognize();
  const ev = await attachEvidence();
  // Pending (not validated) legacy does not bypass the commercial guard.
  expect(await err(as(U, (tx) => tx`update contracts set deal_id=${DEAL} where id=${K}`))).toMatch(
    /proposta e minuta/,
  );
  await regularize(ev);
  expect(await err(as(U, (tx) => tx`update contracts set deal_id=${DEAL} where id=${K}`))).toBe(
    "ok",
  );
  expect(
    await err(as(U, (tx) => tx`update contracts set body_html='<p>x</p>' where id=${K}`)),
  ).toMatch(/imutáve/);
  expect(
    await err(as(U, (tx) => tx`update contracts set source_file_path='outro.pdf' where id=${K}`)),
  ).toMatch(/imutáve/);
  expect(await err(db`delete from contract_legacy_events`)).toMatch(/imutáve/);
  const s = await as(U, (tx) => tx`select contract_legacy_state(${W},${K}) r`.then((x) => x[0].r));
  expect(s.record.status).toBe("regularized");
  expect(JSON.stringify(s)).not.toContain("legacy-contracts/");
});

it("regularized legacy keeps every conferred financial/identity term immutable", async () => {
  await reset({ total_value: "1000", currency: "BRL", payment_method: "pix" });
  await recognize();
  await regularize(await attachEvidence());
  for (const set of [
    "total_value=2000",
    "currency='USD'",
    "payment_terms='{\"x\":1}'",
    "payment_method='boleto'",
    "monthly_value=10",
    "payment_day=5",
    "number='X-1'",
    "notice_days=60",
    "service_scope='Escopo alterado'",
    "signature_provider='forsign'",
    "signed_pdf_path='x.pdf'",
    "counterparty_company_id=null",
  ])
    expect(
      await err(as(U, (tx) => tx.unsafe(`update contracts set ${set} where id='${K}'`))),
    ).toMatch(/imutáveis|não podem ser alterados/);
  expect(
    await err(as(U, (tx) => tx`update contracts set title='Título revisado' where id=${K}`)),
  ).toBe("ok");
});
it("pending legacy cannot be signed natively or have signature/proposal grafted", async () => {
  await reset();
  await recognize();
  for (const t of [
    "contract_signature_packages",
    "contract_esign_deliveries",
    "contract_forsign_operations",
  ])
    expect(await err(db.unsafe(`insert into ${t}(contract_id) values('${K}')`))).toMatch(
      /nova assinatura/,
    );
  expect(
    await err(as(U, (tx) => tx`update contracts set signature_provider='native' where id=${K}`)),
  ).toMatch(/não podem ser alterados/);
  expect(
    await err(as(U, (tx) => tx`update contracts set proposal_id=${randomUUID()} where id=${K}`)),
  ).toMatch(/não podem ser alterados/);
  // Missing data can still be completed through the canonical edit before regularizing (then rebase).
  expect(
    await err(as(U, (tx) => tx`update contracts set ends_at='2026-01-01' where id=${K}`)),
  ).toBe("ok");
});
it("regularized legacy cannot be signed again", async () => {
  await reset();
  await recognize();
  await regularize(await attachEvidence());
  expect(await err(db`insert into contract_signature_packages(contract_id) values(${K})`)).toMatch(
    /nova assinatura/,
  );
});
it("rebase and reserve racing never leave old-revision evidence usable", async () => {
  await reset();
  await recognize();
  await as(U, (tx) => tx`update contracts set body_html='<p>revisado</p>' where id=${K}`);
  const [rb, rs] = await Promise.all([
    err(recognize(U, randomUUID(), 1)),
    err(
      as(
        U,
        (tx) =>
          tx`select contract_legacy_evidence_reserve(${W},${K},1,'a.pdf',1234,${SHA},${randomUUID()})`,
      ),
    ),
  ]);
  expect(rb).toBe("ok");
  expect(rs).toMatch(/STALE|ok/);
  const [n] =
    await db`select count(*)::int n from contract_legacy_evidence where legacy_revision=1 and status<>'superseded'`;
  expect(n.n).toBe(0);
});

async function legacyImportSetup() {
  await reset();
  const path = `${U}/new-original.pdf`;
  await db`insert into storage.objects(bucket_id,name,user_metadata,owner) values('contract-imports',${path},'{}',${U})`;
  return {
    workspace_id: W,
    owner_id: U,
    title: "Acervo importado",
    role: "provider",
    status: "draft",
    body_html: "<p>Texto preservado</p>",
    source_file_path: path,
    imported_from: "pdf",
    metadata: {},
  };
}
const importLegacy = (
  payload: Record<string, unknown>,
  op = randomUUID(),
  w = W,
  reason = "Original do acervo para conferência humana",
) =>
  as(U, (tx) =>
    tx`select contract_legacy_import_create(${w},${tx.json(payload as postgres.JSONValue)},${reason},${op}) r`.then(
      (x) => x[0].r,
    ),
  );
async function importCase(mode: Mode) {
  const payload = await legacyImportSetup();
  await prepare(mode, "techcontracts.legacy_contracts.create.workspace");
  const op = randomUUID();
  const outcome = await err(
    importLegacy(
      { ...payload, workspace_id: mode === "foreign" ? B : W },
      op,
      mode === "foreign" ? B : W,
    ),
  );
  if (mode === "allowed") {
    expect(outcome).toBe("ok");
    expect(
      (await db`select status from contract_legacy_records where contract_id=${op}`)[0].status,
    ).toBe("pending");
  } else {
    expect(outcome).toMatch(/permissão/);
    expect((await db`select count(*)::int n from contracts where id=${op}`)[0].n).toBe(0);
  }

  return outcome;
}
it("legacy import atomic allowed", async () => {
  expect(await importCase("allowed")).toBe("ok");
});
it("legacy import atomic missing", async () => {
  expect(await importCase("missing")).toMatch(/permissão/);
});
it("legacy import atomic deny", async () => {
  expect(await importCase("deny")).toMatch(/permissão/);
});
it("legacy import atomic foreign", async () => {
  expect(await importCase("foreign")).toMatch(/permissão/);
});
it("legacy import atomic inactive", async () => {
  expect(await importCase("inactive")).toMatch(/permissão/);
});
for (const mode of scenarios) {
  it(`legacy indicator ${mode}`, async () => {
    await reset();
    await recognize();
    await prepare(mode, "techcontracts.contracts.view.workspace");
    if (mode === "allowed") {
      await db`delete from job_role_permission_overrides where role_id=${U} and permission_key='techcontracts.legacy_contracts.view.workspace'`;
      expect(
        await as(U, (tx) => tx`select contract_legacy_indicator(${W},${K}) r`.then((x) => x[0].r)),
      ).toEqual({ status: "pending" });
    } else
      expect(
        await err(
          as(U, (tx) => tx`select contract_legacy_indicator(${mode === "foreign" ? B : W},${K})`),
        ),
      ).toMatch(/indisponível/);
  });
}
it("legacy import retries and concurrent requests preserve one contract and original", async () => {
  const payload = await legacyImportSetup(),
    op = randomUUID();
  const [a, b] = await Promise.all([importLegacy(payload, op), importLegacy(payload, op)]);
  expect(a.id).toBe(op);
  expect(b.id).toBe(op);
  expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
  expect(
    (
      await db`select count(*)::int n from contracts where source_file_path=${payload.source_file_path}`
    )[0].n,
  ).toBe(1);
  await expect(importLegacy({ ...payload, title: "Outro conteúdo" }, op)).rejects.toThrow(
    /CONFLICT/,
  );
  await expect(importLegacy(payload, randomUUID())).rejects.toThrow(/já possui contrato/);
  expect((await db`select body_html from contracts where id=${op}`)[0].body_html).toBe(
    payload.body_html,
  );
});
it("legacy import recognition failure rolls back row and rejects unowned source or protected fields", async () => {
  const payload = await legacyImportSetup(),
    op = randomUUID();
  await db`delete from job_role_permission_overrides where role_id=${U} and permission_key='techcontracts.contracts.update.workspace'`;
  await expect(importLegacy(payload, op)).rejects.toThrow(/permissão/);
  expect((await db`select count(*)::int n from contracts where id=${op}`)[0].n).toBe(0);
  await db`insert into job_role_permission_overrides values(${W},${U},'techcontracts.contracts.update.workspace','grant')`;
  await expect(importLegacy({ ...payload, source_file_path: `${V}/foreign.pdf` })).rejects.toThrow(
    /privado/,
  );
  await expect(importLegacy({ ...payload, signature_provider: "native" })).rejects.toThrow(
    /protegidos/,
  );
  await expect(importLegacy({ ...payload, metadata: { accepted_proposal: {} } })).rejects.toThrow(
    /protegidos/,
  );
});
it("legacy approval and signature insertion are serialized with recognition", async () => {
  await reset();
  await recognize();
  await expect(
    db`insert into contract_approvals(id,contract_id) values(${randomUUID()},${K})`,
  ).rejects.toThrow(/novas aprovações/);
  expect((await db`select count(*)::int n from contract_approvals`)[0].n).toBe(0);
});

it("legacy import rejects foreign canonical parties and keeps the original object", async () => {
  const payload = await legacyImportSetup();
  await expect(importLegacy({ ...payload, counterparty_company_id: randomUUID() })).rejects.toThrow(
    /Contraparte/,
  );
  await db`update legal_entities set active=false where id=${L}`;
  await expect(importLegacy({ ...payload, contracting_legal_entity_id: L })).rejects.toThrow(
    /Entidade legal/,
  );
  expect(
    (
      await db`select count(*)::int n from storage.objects where name=${payload.source_file_path}`
    )[0].n,
  ).toBe(1);
});

it.each(["ended", "terminated"] as const)(
  "legacy %s preserves services and creates audit without new signature handoffs",
  async (situation) => {
    await reset({ status: "active" });
    await recognize();
    const ev = await attachEvidence();
    const original = (
      await db`select source_file_path,body_html,parent_contract_id,deal_id from contracts where id=${K}`
    )[0];
    await regularize(ev, {
      situation,
      ends: "2024-12-31",
      term: situation === "terminated" ? "2024-06-30" : null,
    });
    expect(
      (
        await db`select source_file_path,body_html,parent_contract_id,deal_id from contracts where id=${K}`
      )[0],
    ).toEqual(original);
    expect((await db`select count(*)::int n from contract_handoffs`)[0].n).toBe(0);
    expect(
      (await db`select count(*)::int n from contract_events where event_type='status_changed'`)[0]
        .n,
    ).toBe(1);
    expect((await db`select count(*)::int n from financial_entries`)[0].n).toBe(0);
  },
);

it("legacy financial or service changes invalidate reserved document evidence until explicit rebase", async () => {
  await reset({ total_value: "1000", currency: "BRL" });
  await recognize();
  const ev = await attachEvidence();
  await as(
    U,
    (tx) => tx`update contracts set total_value=2000,service_scope='Escopo revisto' where id=${K}`,
  );
  await expect(regularize(ev)).rejects.toThrow(/STALE/);
  expect((await recognize(U, randomUUID(), 1)).revision).toBe(2);
  expect((await db`select status from contract_legacy_evidence where id=${ev}`)[0].status).toBe(
    "superseded",
  );
  expect((await db`select total_value::text v from contracts where id=${K}`)[0].v).toBe("2000");
});

it("legacy preserves the imported original even while pending", async () => {
  await reset();
  await recognize();
  await expect(
    as(U, (tx) => tx`update contracts set source_file_path=null where id=${K}`),
  ).rejects.toThrow(/Original importado/);
  expect((await db`select source_file_path from contracts where id=${K}`)[0].source_file_path).toBe(
    "imports/legado.docx",
  );
});
it("legacy requires an explicit non-null situation even through direct RPC", async () => {
  await reset();
  await recognize();
  const ev = await attachEvidence();
  await expect(regularize(ev, { situation: null, term: "2024-02-01" })).rejects.toThrow(
    /Situação inválida/,
  );
  expect(
    (await db`select status from contract_legacy_records where contract_id=${K}`)[0].status,
  ).toBe("pending");
});
it("legacy supports canonical team access without workspace contract grants", async () => {
  await reset({ assigned_to: V });
  const group = randomUUID();
  await db`insert into user_groups(id,workspace_id,name) values(${group},${W},'Equipe do contrato')`;
  await db`insert into user_group_members(group_id,user_id) values(${group},${U}),(${group},${V})`;
  await db`insert into permissions(key) values('techcontracts.contracts.view.team'),('techcontracts.contracts.update.team') on conflict do nothing`;
  await db`delete from job_role_permission_overrides where role_id=${U} and permission_key in ('techcontracts.contracts.view.workspace','techcontracts.contracts.update.workspace')`;
  await db`insert into job_role_permission_overrides values(${W},${U},'techcontracts.contracts.view.team','grant'),(${W},${U},'techcontracts.contracts.update.team','grant')`;
  expect((await recognize()).status).toBe("pending");
  expect((await regularize(await attachEvidence())).status).toBe("regularized");
});
it("legacy server attestation revalidates the uploader's current contract update access", async () => {
  await reset();
  await recognize();
  const reserve = await as(U, (tx) =>
    tx`select contract_legacy_evidence_reserve(${W},${K},1,'a.pdf',1234,${SHA},${randomUUID()}) r`.then(
      (x) => x[0].r,
    ),
  );
  await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence',${reserve.path},${db.json({ sha256: SHA, actor_id: U })})`;
  await db`delete from job_role_permission_overrides where role_id=${U} and permission_key='techcontracts.contracts.update.workspace'`;
  await expect(
    as(
      null,
      (tx) =>
        tx`select contract_legacy_evidence_attest(${W},${reserve.evidence_id},${U},${SHA},1234)`,
      { role: "service_role" },
    ),
  ).rejects.toThrow(/indisponível/);
  expect(
    (await db`select status from contract_legacy_evidence where id=${reserve.evidence_id}`)[0]
      .status,
  ).toBe("pending_upload");
});

// The helper is callable directly through RPC, not only from the commercial trigger.
async function validatedBy(mode: Mode) {
  await reset();
  await recognize();
  await regularize(await attachEvidence());
  await prepare(mode, "techcontracts.contracts.view.workspace");
  const rows = await as(
    U,
    (tx) => tx`select contract_legacy_validated(${K},${mode === "foreign" ? B : W}) ok`,
  );
  return rows[0].ok;
}
it("legacy validation helper allowed", async () => {
  expect(await validatedBy("allowed")).toBe(true);
});
it("legacy validation helper missing", async () => {
  expect(await validatedBy("missing")).toBe(false);
});
it("legacy validation helper deny", async () => {
  expect(await validatedBy("deny")).toBe(false);
});
it("legacy validation helper foreign", async () => {
  expect(await validatedBy("foreign")).toBe(false);
});
it("legacy validation helper inactive", async () => {
  expect(await validatedBy("inactive")).toBe(false);
});
it("legacy validation helper preserves the trusted service boolean", async () => {
  await reset();
  await recognize();
  await regularize(await attachEvidence());
  await prepare("inactive", "techcontracts.contracts.view.workspace");
  const rows = await as(null, (tx) => tx`select contract_legacy_validated(${K},${W}) ok`, {
    role: "service_role",
  });
  expect(rows[0].ok).toBe(true);
});
it("legacy validation helper rejects a service claim on an authenticated role", async () => {
  await reset();
  await recognize();
  await regularize(await attachEvidence());
  await prepare("missing", "techcontracts.contracts.view.workspace");
  const rows = await as(U, (tx) => tx`select contract_legacy_validated(${K},${W}) ok`, {
    role: "service_role",
  });
  expect(rows[0].ok).toBe(false);
});

async function editCanonicalParties(mode: Mode) {
  await reset({ counterparty_company_id: null, contracting_legal_entity_id: null });
  await prepare(mode, "techcontracts.contracts.update.workspace");
  if (mode === "foreign") await db`update profiles set active_workspace_id=${B} where id=${U}`;
  const result = await err(
    as(
      U,
      (tx) =>
        tx`select contract_mutate(${K},${tx.json({ counterparty_company_id: C, contracting_legal_entity_id: L })})`,
    ),
  );
  const [saved] =
    await db`select counterparty_company_id,contracting_legal_entity_id,status,source_file_path from contracts where id=${K}`;
  expect(saved.counterparty_company_id).toBe(mode === "allowed" ? C : null);
  expect(saved.contracting_legal_entity_id).toBe(mode === "allowed" ? L : null);
  expect(saved.status).toBe("draft");
  expect(saved.source_file_path).toBe("imports/legado.docx");
  return result;
}
it("legacy canonical parties allowed", async () => {
  expect(await editCanonicalParties("allowed")).toBe("ok");
});
it("legacy canonical parties missing", async () => {
  expect(await editCanonicalParties("missing")).toMatch(/permissão|autorizad/);
});
it("legacy canonical parties deny", async () => {
  expect(await editCanonicalParties("deny")).toMatch(/permissão|autorizad/);
});
it("legacy canonical parties foreign", async () => {
  expect(await editCanonicalParties("foreign")).toMatch(/permissão|autorizad/);
});
it("legacy canonical parties inactive", async () => {
  expect(await editCanonicalParties("inactive")).toMatch(/permissão|autorizad/);
});
it("legacy canonical party edit requires rebase before signed evidence", async () => {
  await reset({ counterparty_company_id: null, contracting_legal_entity_id: null });
  await recognize();
  await as(
    U,
    (tx) =>
      tx`select contract_mutate(${K},${tx.json({ counterparty_company_id: C, contracting_legal_entity_id: L })})`,
  );
  const [state] = await as(U, (tx) => tx`select contract_legacy_state(${W},${K}) r`);
  expect(state.r.record.stale).toBe(true);
  const rebased = await recognize(U, randomUUID(), 1);
  expect(rebased.revision).toBe(2);
});
it("legacy canonical parties cannot change after regularization", async () => {
  await reset();
  await recognize();
  await regularize(await attachEvidence());
  const other = randomUUID();
  await db`insert into companies(id,workspace_id,name) values(${other},${W},'Outra contraparte fixture')`;
  await expect(
    as(
      U,
      (tx) =>
        tx`select contract_mutate(${K},${tx.json({ counterparty_company_id: other, contracting_legal_entity_id: L })})`,
    ),
  ).rejects.toThrow(/imutáve|aditivo/i);
  const [c] =
    await db`select counterparty_company_id,source_file_path from contracts where id=${K}`;
  expect(c.counterparty_company_id).toBe(C);
  expect(c.source_file_path).toBe("imports/legado.docx");
});
