import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { disposablePostgresStorageArgs } from "../../../tests/fixtures/disposable-postgres-storage";

// Disposable PostgreSQL uses the production RBAC functions and canonical permission catalogue.
const MIGRATION = "drizzle/migrations/0487_purchase_technical_proposals.sql";
const PG = "/Applications/Postgres.app/Contents/Versions/16/bin/";
const useNative = process.platform === "darwin" && process.env.TECHERP_NATIVE_PG === "1";
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-purchase-proposal-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000001",
  O = "10000000-0000-4000-8000-000000000002";
const R = "30000000-0000-4000-8000-000000000001",
  C = "40000000-0000-4000-8000-000000000001",
  OTHER = "40000000-0000-4000-8000-000000000002";
const WK = "50000000-0000-4000-8000-000000000001",
  SUP = "60000000-0000-4000-8000-000000000001";
const VIEW = "techcontracts.purchase_proposals.view.workspace",
  MANAGE = "techcontracts.purchase_proposals.manage.workspace",
  TEMPLATES = "techcontracts.purchase_proposal_templates.manage.workspace";
const HASH = "a".repeat(64),
  SHA = "b".repeat(64);
const KEYS = [
  VIEW,
  MANAGE,
  TEMPLATES,
  "techcontracts.contracts.view.workspace",
  "techcontracts.contracts.update.workspace",
  "techcontracts.signature_evidence.view.workspace",
  "techcontracts.signature_evidence.manage.workspace",
];
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
  const start =
    [
      source.indexOf("CREATE OR REPLACE FUNCTION public." + name + "("),
      source.indexOf("CREATE FUNCTION public." + name + "("),
    ].find((value) => value >= 0) ?? -1;
  if (start < 0) throw Error("Missing production function: " + name);
  const tail = source.slice(start),
    opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error("Missing production body: " + name);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error("Incomplete production body: " + name);
  return tail.slice(0, end + opening[1].length) + ";";
}

beforeAll(async () => {
  temporary = mkdtempSync(join(tmpdir(), "techerp-purchase-proposal-"));
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
  await db.unsafe("DROP TABLE permissions; DROP TYPE perm_action;");
  const canonical = readFileSync(
    "supabase/migrations/20260702145220_0423591a-1165-453f-8ced-e86718fead46.sql",
    "utf8",
  );
  await db.unsafe(
    canonical.slice(0, canonical.indexOf("CREATE TABLE IF NOT EXISTS public.permission_sets")),
  );
  for (const [file, name] of [
    ["0031_workspace_members_status_inactive.sql", "is_workspace_member"],
    ["0127_rbac_wk_vis_local_per_role.sql", "user_effective_permissions"],
    ["0120_activities_team_scope_active_membership.sql", "my_team_member_pairs"],
    ["0046_view_as_role_only_readonly.sql", "is_read_only_view"],
    ["0216_work_core_prepare.sql", "work_access_context"],
    ["0218_order3_completion_prepare.sql", "work_action_prefix"],
    ["0218_order3_completion_prepare.sql", "work_context_access"],
  ])
    await db.unsafe(sourceFunction("drizzle/migrations/" + file, name));
  await db.unsafe(`
    ALTER TABLE companies ADD COLUMN name text,ADD COLUMN legal_name text,ADD COLUMN cnpj text,ADD COLUMN deleted_at timestamptz;
    ALTER TABLE contacts ADD COLUMN first_name text,ADD COLUMN last_name text,ADD COLUMN deleted_at timestamptz;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE workspace_branding(workspace_id uuid PRIMARY KEY,logo_url text);
    CREATE TABLE legal_entities(id uuid PRIMARY KEY,workspace_id uuid,name text,cnpj text);
    CREATE TABLE contracts(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,role text,status text,title text,body_html text,
      hiring_request_origin uuid,counterparty_kind text,counterparty_company_id uuid,counterparty_contact_id uuid,contracting_legal_entity_id uuid,legal_entity_id uuid,total_value numeric,currency text,starts_at date,ends_at date,signed_at timestamptz);
    CREATE TABLE contract_legacy_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,contract_id uuid);
    CREATE TABLE hiring_contract_evidence(workspace_id uuid,contract_id uuid,document_id uuid,kind text,revoked_at timestamptz);
    CREATE TABLE esign_documents(id uuid PRIMARY KEY,workspace_id uuid,status text);
    CREATE TABLE contract_forsign_operations(workspace_id uuid,contract_id uuid,status text);
    CREATE TABLE work_resource_catalog(resource text PRIMARY KEY,table_name name,responsible_columns text[],parent_column name,parent_resource text,shared boolean);
    INSERT INTO work_resource_catalog VALUES('techcontracts.contracts','contracts',ARRAY['assigned_to','owner_id'],NULL,NULL,false);
    CREATE FUNCTION user_has_permission(_user_id uuid,_workspace_id uuid,_permission_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT EXISTS(SELECT 1 FROM user_effective_permissions(_user_id,_workspace_id) k WHERE k=_permission_key)$$;
    CREATE FUNCTION sales_record_access(r text,k uuid,a text) RETURNS boolean LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Purchase file flow must not query a sales source';END$$;
    CREATE FUNCTION hiring_formalization_private_access(w uuid,i uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
    CREATE FUNCTION hiring_formalization_access(w uuid,i uuid,a text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
    CREATE FUNCTION hiring_contract_fingerprint_without_attachments(c uuid) RETURNS text LANGUAGE sql STABLE AS $$SELECT '${HASH}'::text$$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,user_metadata jsonb);
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT SELECT ON storage.objects TO authenticated;
    CREATE ROLE sandbox_exec NOLOGIN BYPASSRLS;
    CREATE ROLE techerp_request_writer NOLOGIN BYPASSRLS;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role,sandbox_exec,techerp_request_writer;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role,sandbox_exec,techerp_request_writer;
  `);
  const attachments = readFileSync("drizzle/migrations/0366_contract_attachments.sql", "utf8");
  const start = attachments.indexOf("CREATE TABLE public.contract_attachments (");
  await db.unsafe(attachments.slice(start, attachments.indexOf(");", start) + 2));
  await db.unsafe(
    "ALTER TABLE contract_attachments ADD COLUMN sha256 text,ADD COLUMN source_stamp text,ADD COLUMN source_name text,ADD COLUMN source_snapshot_path text,ADD COLUMN source_snapshot_sha256 text;",
  );
  for (const name of [
    "work_record_context_access",
    "work_record_access",
    "work_area_authorize",
    "work_subject_context",
  ])
    await db.unsafe(sourceFunction("drizzle/migrations/0218_order3_completion_prepare.sql", name));
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0379_hiring_formalization_integrity.sql",
      "hiring_formalization_document_locked",
    ),
  );
  // The production attachment fingerprint is tested with a deterministic parent
  // base: audience metadata must not rewrite an unreviewed historical seal.
  await db.unsafe("CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;");
  for (const name of ["contract_attachment_source_stamp", "hiring_contract_fingerprint"])
    await db.unsafe(
      sourceFunction("drizzle/migrations/0367_contract_signature_packages.sql", name),
    );
  await db.unsafe(readFileSync(MIGRATION, "utf8"));
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0309_hiring_signature_evidence.sql",
      "hiring_signature_access",
    ),
  );
  await db.unsafe(
    "CREATE FUNCTION hiring_contract_esign_body_without_attachments(w uuid,k uuid) RETURNS text LANGUAGE sql STABLE AS $$SELECT body_html FROM contracts WHERE id=k AND workspace_id=w$$;",
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0367_contract_signature_packages.sql",
      "contract_attachment_signing_context",
    ),
  );
  const audienceFile = "drizzle/migrations/0488_purchase_document_audience.sql";
  const audienceSource = readFileSync(audienceFile, "utf8");
  await db.unsafe(
    audienceSource.slice(
      audienceSource.indexOf("ALTER TABLE public.contract_attachments"),
      audienceSource.indexOf("UPDATE public.contract_attachments"),
    ),
  );
  const reviewStart = audienceSource.indexOf(
    "CREATE TABLE public.contract_attachment_audience_reviews(",
  );
  await db.unsafe(audienceSource.slice(reviewStart, audienceSource.indexOf(");", reviewStart) + 2));
  for (const name of [
    "contract_attachment_audience_default",
    "contract_attachment_audience_stamp",
    "contract_attachment_audience_allowed",
    "contract_document_audience_valid",
    "contract_document_audience_assert",
    "contract_attachment_audience_check",
    "contract_attachment_access_check",
    "purchase_proposal_classify_attachment",
    "contract_attachment_storage_allowed",
  ])
    await db.unsafe(sourceFunction(audienceFile, name));
  await db.unsafe(
    "ALTER FUNCTION hiring_contract_fingerprint(uuid) RENAME TO hiring_contract_fingerprint_before_audience;",
  );
  await db.unsafe(sourceFunction(audienceFile, "hiring_contract_fingerprint"));
  await db.unsafe(
    "ALTER FUNCTION contract_attachment_signing_context(uuid,text) RENAME TO contract_attachment_signing_context_before_audience;",
  );
  await db.unsafe(sourceFunction(audienceFile, "contract_attachment_signing_context"));
  const sensitiveStart = audienceSource.indexOf(
    "CREATE POLICY contract_attachment_sensitive_content",
  );
  await db.unsafe(
    audienceSource.slice(sensitiveStart, audienceSource.indexOf(";", sensitiveStart) + 1),
  );
  await db.unsafe(`CREATE TRIGGER contract_attachment_audience_default BEFORE INSERT ON contract_attachments FOR EACH ROW EXECUTE FUNCTION contract_attachment_audience_default();
    ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON contracts,contract_attachments TO authenticated;
    CREATE POLICY view_contract ON contracts FOR SELECT TO authenticated USING(work_record_access('techcontracts.contracts',id,'view'));
    ALTER TABLE contract_attachments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY view_attachment ON contract_attachments FOR SELECT TO authenticated USING(work_record_access('techcontracts.contracts',contract_id,'view'));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY attachment_storage ON storage.objects FOR SELECT TO authenticated USING(bucket_id='contract-attachments' AND contract_attachment_storage_allowed(name,false));
  `);
  // Execute the actual companion ACL cleanup, including inherited custom roles.
  const aclStart = audienceSource.indexOf("DO $audience_acl$");
  await db.unsafe(audienceSource.slice(aclStart));
  await db`insert into workspaces(id) values(${W}),(${B})`;
  await db`insert into auth.users(id) values(${U}),(${O})`;
  await db`insert into profiles(id,active_workspace_id) values(${U},${W}),(${O},${W})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${W},${U}),(${W},${O}),(${B},${U})`;
  await db`insert into job_roles(id,workspace_id) values(${R},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${R},${U},${W},${U})`;
  for (const key of KEYS) {
    await db`insert into permissions(key,module,resource,action,scope,label_pt,is_system) values(${key},'fixture','fixture','view','workspace',${key},true) on conflict do nothing`;
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${R},${key},'grant')`;
  }
  await db`insert into workspace_branding(workspace_id,logo_url) values(${W},'https://wk.invalid/logo.png'),(${B},'https://other.invalid/private-logo.png')`;
  await db`insert into legal_entities(id,workspace_id,name,cnpj) values(${WK},${W},'WK compradora','11111111000111')`;
  await db`insert into companies(id,workspace_id,name,legal_name,cnpj) values(${SUP},${W},'Prestadora','Prestadora Legal','22222222000122')`;
  await db`insert into contracts(id,workspace_id,owner_id,role,status,title,body_html,counterparty_kind,counterparty_company_id,contracting_legal_entity_id,total_value,currency) values(${C},${W},${U},'client','draft','SALE TITLE MUST NOT LEAK','SALE SECRET BODY','company',${SUP},${WK},900,'BRL'),(${OTHER},${B},${U},'client','draft','foreign','foreign','company',${SUP},${WK},900,'BRL')`;
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
type Options = {
  missing?: string;
  deny?: string;
  inactive?: boolean;
  workspace?: string;
  readOnly?: boolean;
  setup?: (tx: postgres.TransactionSql) => Promise<void>;
};
async function subject(fn: (tx: postgres.TransactionSql) => Promise<void>, options: Options = {}) {
  const rollback = new Error("rollback fixture");
  try {
    await db.begin(async (tx) => {
      if (options.setup) await options.setup(tx);
      await tx`update profiles set active_workspace_id=${options.workspace ?? W} where id=${U}`;
      if (options.inactive)
        await tx`update workspace_members set status='inactive' where user_id=${U} and workspace_id=${W}`;
      if (options.missing)
        await tx`delete from job_role_permission_overrides where role_id=${R} and permission_key=${options.missing}`;
      if (options.deny)
        await tx`update job_role_permission_overrides set effect='deny' where role_id=${R} and permission_key=${options.deny}`;
      const session = randomUUID();
      if (options.readOnly)
        await tx`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "authenticated", session_id: session })},true)`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await fn(tx);
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
}
const DESIGN = { version: 1, pages: [{ id: "page", elements: [] }] };
const DATA = {
  title: "Compra técnica",
  scope: "Implementação independente da venda",
  exclusions: "Operação",
  acceptanceCriteria: "Critérios expressos por marco",
  hours: 9,
  hourlyRate: 100,
  businessDays: 3,
  startsOn: null,
  endsOn: null,
  paymentTerms: "10 dias úteis após aceite e NF",
  responsibilities: "Desenvolvimento prestadora, implantação WK",
  warrantyDays: 90,
  milestones: [
    {
      id: "m1",
      title: "Entrega",
      description: "Entrega técnica",
      acceptanceCriteria: "Teste de aceite expresso",
      hours: 9,
      businessDays: 3,
    },
  ],
};
async function context(tx: postgres.TransactionSql, contract = C) {
  const [row] = await tx`select purchase_proposal_context(${contract}::uuid) as r`;
  return row.r;
}
async function template(tx: postgres.TransactionSql) {
  const [row] =
    await tx`select purchase_proposal_template_save(${C}::uuid,null,'Modelo genérico',${tx.json(DESIGN)},0) as r`;
  return row.r;
}
async function save(tx: postgres.TransactionSql, id: string, expected = 0, data = DATA) {
  const hash = (await context(tx)).contractHash;
  const [row] =
    await tx`select purchase_proposal_save(${C}::uuid,${id}::uuid,${tx.json(data)},${tx.json(DESIGN)},${expected},${hash}) as r`;
  return row.r;
}

it("allowed: installs local model and immutable own purchase revision without sales fields", async () => {
  await subject(async (tx) => {
    const t = await template(tx),
      d = await save(tx, t.id),
      c = await context(tx);
    expect(d.version).toBe(1);
    expect(c.canManage).toBe(true);
    expect(c.templates).toHaveLength(1);
    expect(d.parties.supplier.name).toBe("Prestadora Legal");
    expect(d.parties.wk.name).toBe("WK compradora");
    expect(JSON.stringify(c)).not.toContain("SALE");
    expect(c.branding.logoUrl).toBe("https://wk.invalid/logo.png");
    expect(JSON.stringify(c)).not.toContain("other.invalid");
    expect(c.documents[0].data.hours).toBe(9);
    const next = await save(tx, t.id, 1);
    expect(next.version).toBe(2);
    expect((await context(tx)).documents).toHaveLength(2);
  });
});
it("missing key: parent visibility never reveals purchase values, model or documents", async () => {
  await subject(
    async (tx) => {
      const c = await context(tx);
      expect(c.canView).toBe(false);
      expect(c.documents).toEqual([]);
      expect(c.templates).toEqual([]);
      expect(c.parties).toBeUndefined();
      expect(c.contract).toBeUndefined();
      expect(c.contractHash).toBeNull();
    },
    { missing: VIEW },
  );
});
it("deny wins: explicitly denied economic permission blocks direct save RPC", async () => {
  await subject(
    async (tx) => {
      expect((await context(tx)).canView).toBe(false);
      await expect(template(tx)).rejects.toMatchObject({ code: "42501" });
    },
    { deny: VIEW },
  );
});
it("other workspace: direct context and mutation reject foreign contract", async () => {
  await subject(async (tx) => {
    expect((await context(tx, OTHER)).canView).toBe(false);
    await expect(
      tx`select purchase_proposal_template_save(${OTHER}::uuid,null,'Modelo',${tx.json(DESIGN)},0)`,
    ).rejects.toMatchObject({ code: "42501" });
  });
});
it("inactive: even retained local role grants cannot read or write documents", async () => {
  await subject(
    async (tx) => {
      expect((await context(tx)).canView).toBe(false);
      await expect(template(tx)).rejects.toMatchObject({ code: "42501" });
    },
    { inactive: true },
  );
});
it("read-only impersonation retains economic read but cannot create model or document", async () => {
  await subject(
    async (tx) => {
      const c = await context(tx);
      expect(c.canView).toBe(true);
      expect(c.canManage).toBe(false);
      expect(c.canManageTemplates).toBe(false);
      await expect(template(tx)).rejects.toMatchObject({ code: "42501" });
    },
    { readOnly: true },
  );
});
it("technical role without economic key receives only flags", async () => {
  await subject(
    async (tx) => {
      const c = await context(tx);
      expect(Object.keys(c).sort()).toEqual(
        [
          "blockedReason",
          "canGenerate",
          "canManage",
          "canManageTemplates",
          "canView",
          "contractHash",
          "documents",
          "isPurchase",
          "templates",
        ].sort(),
      );
    },
    { missing: VIEW },
  );
});
it("model management is separate from document management", async () => {
  await subject(
    async (tx) => {
      expect((await context(tx)).canManage).toBe(true);
      await expect(template(tx)).rejects.toMatchObject({ code: "42501" });
    },
    { missing: TEMPLATES },
  );
});
it("parent record update permission is required for preparation", async () => {
  await subject(
    async (tx) => {
      const c = await context(tx);
      expect(c.canView).toBe(true);
      expect(c.canManage).toBe(false);
      await expect(template(tx)).rejects.toMatchObject({ code: "42501" });
    },
    { missing: "techcontracts.contracts.update.workspace" },
  );
});
it("purchase scope rejects wrong role and signed or legacy contracts", async () => {
  for (const field of ["role", "signature", "legacy", "governed"]) {
    await subject(
      async (tx) => {
        const c = await context(tx);
        expect(c.canManage).toBe(false);
      },
      {
        setup: async (tx) => {
          if (field === "role") await tx`update contracts set role='provider' where id=${C}`;
          if (field === "signature")
            await tx`insert into contract_forsign_operations(workspace_id,contract_id,status) values(${W},${C},'sent')`;
          if (field === "legacy")
            await tx`insert into contract_legacy_records(workspace_id,contract_id) values(${W},${C})`;
          if (field === "governed")
            await tx`update contracts set hiring_request_origin=${randomUUID()} where id=${C}`;
        },
      },
    );
  }
});
it("stale document revisions and changed contract hash fail before insert", async () => {
  await subject(async (tx) => {
    const t = await template(tx);
    await save(tx, t.id);
    await expect(save(tx, t.id)).rejects.toMatchObject({ code: "40001" });
  });
  await subject(async (tx) => {
    const t = await template(tx);
    await expect(
      tx`select purchase_proposal_save(${C}::uuid,${t.id}::uuid,${tx.json(DATA)},${tx.json(DESIGN)},0,${"0".repeat(64)})`,
    ).rejects.toMatchObject({ code: "40001" });
  });
});
it("invalid arithmetic, date or sales payload never becomes a purchase revision", async () => {
  for (const payload of [
    { ...DATA, hours: 10 },
    { ...DATA, hourlyRate: 101 },
    { ...DATA, startsOn: "2026-02-31" },
    { ...DATA, dealId: "sale-secret" },
  ]) {
    await subject(async (tx) => {
      const t = await template(tx);
      await expect(save(tx, t.id, 0, payload as typeof DATA)).rejects.toBeDefined();
    });
  }
});
it("reserve is idempotent and finalize requires matching uploaded PDF provenance", async () => {
  await subject(async (tx) => {
    const t = await template(tx),
      d = await save(tx, t.id);
    const [a] = await tx`select purchase_proposal_prepare(${C}::uuid,${d.id}::uuid) as r`;
    const [b] = await tx`select purchase_proposal_prepare(${C}::uuid,${d.id}::uuid) as r`;
    expect(a.r.id).toBe(b.r.id);
    await expect(
      tx`select purchase_proposal_finish(${C}::uuid,${d.id}::uuid,${SHA})`,
    ).rejects.toMatchObject({ code: "23514" });
  });
});
it("complete generation keeps revision snapshot and returns same attachment on retry", async () => {
  await subject(async (tx) => {
    const t = await template(tx),
      d = await save(tx, t.id);
    const [a] = await tx`select purchase_proposal_prepare(${C}::uuid,${d.id}::uuid) as r`;
    await tx.unsafe("RESET ROLE");
    await tx`insert into storage.objects(bucket_id,name,metadata,user_metadata) values('contract-attachments',${a.r.path},${tx.json({ size: 123, mimetype: "application/pdf" })},${tx.json({ sha256: SHA })})`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    const [f] = await tx`select purchase_proposal_finish(${C}::uuid,${d.id}::uuid,${SHA}) as r`;
    expect(f.r.status).toBe("generated");
    expect(f.r.attachmentId).toBe(a.r.id);
    expect(f.r.data).toEqual(DATA);
    const [retry] = await tx`select purchase_proposal_prepare(${C}::uuid,${d.id}::uuid) as r`;
    expect(retry.r.generated).toBe(true);
    expect(retry.r.document.attachmentId).toBe(a.r.id);
  });
});
it("private tables and helper RPCs revoke broad authenticated, service and bypass defaults", async () => {
  for (const role of [
    "anon",
    "authenticated",
    "service_role",
    "sandbox_exec",
    "techerp_request_writer",
  ]) {
    for (const table of ["purchase_proposal_templates", "contract_purchase_proposals"]) {
      const [r] =
        await db`select has_table_privilege(${role},${table},'SELECT,INSERT,UPDATE,DELETE') as allowed`;
      expect(r.allowed).toBe(false);
    }
    for (const signature of [
      "purchase_proposal_access(uuid,text)",
      "purchase_proposal_parties(uuid)",
      "purchase_proposal_validate_data(jsonb,numeric)",
    ]) {
      const [r] =
        await db`select has_function_privilege(${role},${signature},'EXECUTE') as allowed`;
      expect(r.allowed).toBe(false);
    }
  }
});
it("raw SQL cannot rewrite persisted purchase document content", async () => {
  await subject(async (tx) => {
    const t = await template(tx),
      d = await save(tx, t.id);
    await tx.unsafe("RESET ROLE");
    await expect(
      tx`update contract_purchase_proposals set data=${tx.json({ ...DATA, scope: "tampered" })} where id=${d.id}`,
    ).rejects.toMatchObject({ code: "23514" });
  });
});
it("model revision changes cannot rewrite a saved document snapshot", async () => {
  await subject(async (tx) => {
    const t = await template(tx),
      d = await save(tx, t.id);
    const next = { ...DESIGN, pages: [{ id: "changed", elements: [] }] };
    const [updated] =
      await tx`select purchase_proposal_template_save(${C}::uuid,${t.id}::uuid,'Novo modelo',${tx.json(next)},1) as r`;
    expect(updated.r.revision).toBe(2);
    const c = await context(tx);
    expect(c.documents[0].templateRevision).toBe(1);
    expect(c.documents[0].design).toEqual(DESIGN);
    expect(c.documents[0].id).toBe(d.id);
  });
});
it("explicit manage denial leaves document read available but blocks direct generation", async () => {
  await subject(
    async (tx) => {
      const c = await context(tx);
      expect(c.canView).toBe(true);
      expect(c.canGenerate).toBe(false);
      await expect(
        tx`select purchase_proposal_prepare(${C}::uuid,${randomUUID()}::uuid)`,
      ).rejects.toMatchObject({ code: "42501" });
    },
    { deny: MANAGE },
  );
});
it("own scope grants remain confined to the parent record owner", async () => {
  await subject(
    async (tx) => {
      expect((await context(tx)).canManage).toBe(true);
    },
    {
      setup: async (tx) => {
        for (const action of ["view", "update"]) {
          const key = `techcontracts.contracts.${action}.own`;
          await tx`insert into permissions(key,module,resource,action,scope,label_pt,is_system) values(${key},'techcontracts','contracts',${action},'own',${key},true)`;
          await tx`update job_role_permission_overrides set permission_key=${key} where role_id=${R} and permission_key=${`techcontracts.contracts.${action}.workspace`}`;
        }
      },
    },
  );
  await subject(
    async (tx) => {
      expect((await context(tx)).canView).toBe(false);
    },
    {
      setup: async (tx) => {
        await tx`update contracts set owner_id=${O} where id=${C}`;
        const key = "techcontracts.contracts.view.own";
        await tx`insert into permissions(key,module,resource,action,scope,label_pt,is_system) values(${key},'techcontracts','contracts','view','own',${key},true)`;
        await tx`update job_role_permission_overrides set permission_key=${key} where role_id=${R} and permission_key='techcontracts.contracts.view.workspace'`;
      },
    },
  );
});
it("new document versions cannot finalize a previously reserved stale version", async () => {
  await subject(async (tx) => {
    const t = await template(tx),
      d = await save(tx, t.id);
    await tx`select purchase_proposal_prepare(${C}::uuid,${d.id}::uuid)`;
    await save(tx, t.id, 1);
    await expect(
      tx`select purchase_proposal_finish(${C}::uuid,${d.id}::uuid,${SHA})`,
    ).rejects.toMatchObject({ code: "40001" });
  });
});
it("team scope resolves only same-workspace active group members", async () => {
  const group = randomUUID();
  await subject(
    async (tx) => {
      expect((await context(tx)).canManage).toBe(true);
    },
    {
      setup: async (tx) => {
        await tx`update contracts set owner_id=${O} where id=${C}`;
        await tx`insert into user_groups(id,workspace_id) values(${group},${W})`;
        await tx`insert into user_group_members(group_id,user_id) values(${group},${U}),(${group},${O})`;
        for (const action of ["view", "update"]) {
          const key = `techcontracts.contracts.${action}.team`;
          await tx`insert into permissions(key,module,resource,action,scope,label_pt,is_system) values(${key},'techcontracts','contracts',${action},'team',${key},true)`;
          await tx`update job_role_permission_overrides set permission_key=${key} where role_id=${R} and permission_key=${`techcontracts.contracts.${action}.workspace`}`;
        }
      },
    },
  );
  await subject(
    async (tx) => {
      expect((await context(tx)).canView).toBe(false);
    },
    {
      setup: async (tx) => {
        await tx`update contracts set owner_id=${O} where id=${C}`;
        await tx`insert into user_groups(id,workspace_id) values(${group},${B})`;
        await tx`insert into user_group_members(group_id,user_id) values(${group},${U}),(${group},${O})`;
        const key = "techcontracts.contracts.view.team";
        await tx`insert into permissions(key,module,resource,action,scope,label_pt,is_system) values(${key},'techcontracts','contracts','view','team',${key},true)`;
        await tx`update job_role_permission_overrides set permission_key=${key} where role_id=${R} and permission_key='techcontracts.contracts.view.workspace'`;
      },
    },
  );
});
it("inactive administrator cannot bypass membership or economic denial", async () => {
  await subject(
    async (tx) => {
      expect((await context(tx)).canView).toBe(false);
    },
    {
      inactive: true,
      setup: async (tx) => {
        await tx`update workspace_members set role='admin' where workspace_id=${W} and user_id=${U}`;
      },
    },
  );
  await subject(
    async (tx) => {
      expect((await context(tx)).canView).toBe(false);
    },
    {
      deny: VIEW,
      setup: async (tx) => {
        await tx`update workspace_members set role='admin' where workspace_id=${W} and user_id=${U}`;
      },
    },
  );
});
it("missing current parties blocks mutation while preserving readable historical snapshot", async () => {
  await subject(async (tx) => {
    const t = await template(tx);
    await save(tx, t.id);
    await tx.unsafe("RESET ROLE");
    await tx`update companies set deleted_at=now() where id=${SUP}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    const c = await context(tx);
    expect(c.canView).toBe(true);
    expect(c.canManage).toBe(false);
    expect(c.parties).toBeNull();
    expect(c.documents[0].parties.supplier.name).toBe("Prestadora Legal");
    expect(c.blockedReason).toContain("próprio contrato de compra");
  });
});

async function generated(tx: postgres.TransactionSql) {
  const t = await template(tx),
    d = await save(tx, t.id);
  const [reserved] = await tx`select purchase_proposal_prepare(${C}::uuid,${d.id}::uuid) as r`;
  await tx.unsafe("RESET ROLE");
  await tx`insert into storage.objects(bucket_id,name,metadata,user_metadata) values('contract-attachments',${reserved.r.path},${tx.json({ size: 123, mimetype: "application/pdf" })},${tx.json({ sha256: SHA })})`;
  await tx.unsafe("SET LOCAL ROLE authenticated");
  const [finished] =
    await tx`select purchase_proposal_finish(${C}::uuid,${d.id}::uuid,${SHA}) as r`;
  return { document: finished.r, path: reserved.r.path, id: reserved.r.id };
}
it("integrated 0487/0488: save reserve finish produces trusted supplier PDF and exact signing manifest", async () => {
  await subject(async (tx) => {
    const created = await generated(tx),
      c = await context(tx);
    const [attachment] =
      await tx`select audience,commercial_sensitive,audience_reviewed_by,ready,sha256 from contract_attachments where id=${created.id}`;
    expect(attachment).toEqual({
      audience: "supplier",
      commercial_sensitive: true,
      audience_reviewed_by: U,
      ready: true,
      sha256: SHA,
    });
    expect(c.contractHash).not.toBe(HASH);
    const [policy] =
      await tx`select contract_attachment_audience_check(${C}::uuid,${c.contractHash}) as r`;
    expect(policy.r.audience).toBe("supplier");
    expect(policy.r.attachments).toHaveLength(1);
    const [signing] =
      await tx`select contract_attachment_signing_context(${C}::uuid,${c.contractHash}) as r`;
    expect(signing.r.attachments).toHaveLength(1);
    expect(signing.r.attachments[0].id).toBe(created.id);
    expect(signing.r.attachments[0].stamp).toBe(SHA);
    expect(await tx`select name from storage.objects where name=${created.path}`).toHaveLength(1);
  });
});
it("integrated economic denial hides generated attachment metadata and raw storage bytes", async () => {
  await subject(async (tx) => {
    const created = await generated(tx);
    await tx.unsafe("RESET ROLE");
    await tx`update job_role_permission_overrides set effect='deny' where role_id=${R} and permission_key=${VIEW}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect((await context(tx)).documents).toEqual([]);
    expect(await tx`select id from contract_attachments where id=${created.id}`).toHaveLength(0);
    expect(await tx`select name from storage.objects where name=${created.path}`).toHaveLength(0);
    await expect(
      tx`select contract_attachment_audience_check(${C}::uuid,null)`,
    ).rejects.toMatchObject({ code: "42501" });
  });
});
it("integrated removal preserves immutable revision, price, snapshot and original SHA", async () => {
  await subject(async (tx) => {
    const created = await generated(tx),
      before = (await context(tx)).documents[0];
    await tx.unsafe("RESET ROLE");
    await tx`delete from contract_attachments where id=${created.id}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    const after = (await context(tx)).documents[0];
    expect(after.attachmentId).toBeNull();
    expect(after.status).toBe("generated");
    expect(after.sha256).toBe(SHA);
    expect(after.data).toEqual(before.data);
    expect(after.design).toEqual(before.design);
    expect(after.parties).toEqual(before.parties);
  });
});
it("integrated unreviewed legacy fingerprint remains byte-identical until explicit review", async () => {
  await subject(async (tx) => {
    const id = randomUUID(),
      path = `${W}/${C}/${id}`;
    await tx.unsafe("RESET ROLE");
    await tx`insert into contract_attachments(id,workspace_id,contract_id,kind,file_name,storage_path,ready,sha256,created_by) values(${id},${W},${C},'file','original-legado.pdf',${path},true,${SHA},${U})`;
    const [legacy] =
      await tx`select hiring_contract_fingerprint_before_audience(${C}::uuid) old_hash,hiring_contract_fingerprint(${C}::uuid) current_hash`;
    expect(legacy.current_hash).toBe(legacy.old_hash);
    await tx`update contract_attachments set audience='supplier',audience_reviewed_by=${U},audience_reviewed_at=now() where id=${id}`;
    const [reviewed] = await tx`select hiring_contract_fingerprint(${C}::uuid) current_hash`;
    expect(reviewed.current_hash).not.toBe(legacy.old_hash);
  });
});
it("integrated signing filters explicitly internal files without exposing them to the supplier", async () => {
  await subject(async (tx) => {
    const created = await generated(tx),
      id = randomUUID(),
      path = `${W}/${C}/${id}`;
    await tx.unsafe("RESET ROLE");
    await tx`insert into contract_attachments(id,workspace_id,contract_id,kind,file_name,storage_path,ready,sha256,created_by) values(${id},${W},${C},'file','memo-interno.pdf',${path},true,${SHA},${U})`;
    await tx`update contract_attachments set audience='internal',audience_reviewed_by=${U},audience_reviewed_at=now() where id=${id}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    const c = await context(tx);
    const [signing] =
      await tx`select contract_attachment_signing_context(${C}::uuid,${c.contractHash}) as r`;
    expect(signing.r.attachments.map((row: { id: string }) => row.id)).toEqual([created.id]);
    expect(JSON.stringify(signing.r)).not.toContain("memo-interno");
  });
});
it("direct SQL RPC rejects extreme price outside exact monetary precision", async () => {
  await subject(
    async (tx) => {
      const t = await template(tx);
      const data = {
        ...DATA,
        hours: 1000000,
        hourlyRate: 100000000,
        milestones: [{ ...DATA.milestones[0], hours: 1000000 }],
      };
      await expect(save(tx, t.id, 0, data)).rejects.toMatchObject({
        code: "23514",
        message: "O valor da compra excede o limite de precisão monetária.",
      });
    },
    {
      setup: async (tx) => {
        await tx`update contracts set total_value=0 where id=${C}`;
      },
    },
  );
});
