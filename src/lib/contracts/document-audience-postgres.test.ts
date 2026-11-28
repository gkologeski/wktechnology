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
const container = "techerp-audience-ci-" + randomUUID();
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
    start = source.search(
      new RegExp(
        "CREATE(?: OR REPLACE)? FUNCTION " +
          (name.includes(".") ? name : "public." + name).replaceAll(".", "\\.") +
          "\\(",
      ),
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
  await db.unsafe(readFileSync("tests/fixtures/permission-postgres-ci.sql", "utf8"));
  for (const [file, name] of [
    ["drizzle/migrations/0031_workspace_members_status_inactive.sql", "is_workspace_member"],
    ["drizzle/migrations/0127_rbac_wk_vis_local_per_role.sql", "user_effective_permissions"],
    ["drizzle/migrations/0120_activities_team_scope_active_membership.sql", "my_team_member_pairs"],
    ["drizzle/migrations/0046_view_as_role_only_readonly.sql", "is_read_only_view"],
    ["drizzle/migrations/0216_work_core_prepare.sql", "work_access_context"],
    ["drizzle/migrations/0216_work_core_prepare.sql", "work_context_access"],
    ["drizzle/migrations/0210_finance_core_actions.sql", "finance_access_context"],
    ["drizzle/migrations/0214_finance_business_prepare.sql", "finance_business_access"],
    ["drizzle/migrations/0214_finance_business_prepare.sql", "finance_business_authorize"],
    ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_access_context"],
    ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_context_access"],
  ])
    await db.unsafe(sourceFunction(file, name));
  await db.unsafe(`CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE SCHEMA storage; GRANT USAGE ON SCHEMA storage TO authenticated;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
 GRANT USAGE ON SCHEMA storage TO anon;GRANT SELECT ON storage.objects TO anon;
 CREATE POLICY legacy_fixture_storage ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
 CREATE TABLE contracts(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,deal_id uuid,quote_id uuid,proposal_id uuid);
 CREATE TABLE quotes(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,deal_id uuid,title text);
 CREATE TABLE proposals(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,deal_id uuid,title text,version int);
 GRANT SELECT ON quotes,proposals TO authenticated;
 CREATE TABLE work_resource_catalog(resource text PRIMARY KEY,table_name name,responsible_columns text[],parent_column name,parent_resource text,shared boolean);
 INSERT INTO work_resource_catalog VALUES('techcontracts.contracts','contracts',ARRAY['assigned_to','owner_id'],NULL,NULL,false);`);
  for (const name of [
    "work_action_prefix",
    "work_context_access",
    "work_record_context_access",
    "work_record_access",
    "work_area_authorize",
  ])
    await db.unsafe(sourceFunction("drizzle/migrations/0218_order3_completion_prepare.sql", name));
  const sales = readFileSync("drizzle/migrations/0222_order4_sales_prepare.sql", "utf8");
  const tail = sales.slice(
    sales.lastIndexOf("CREATE OR REPLACE FUNCTION public.sales_record_access("),
  );
  await db.unsafe(tail.slice(0, tail.indexOf("END $$;") + 7));
  for (const name of ["shared_storage_session_access", "shared_storage_object_access"])
    await db.unsafe(
      sourceFunction(
        name === "shared_storage_session_access"
          ? "drizzle/migrations/0227_order5_shared_prepare.sql"
          : "drizzle/migrations/0234_order5_legacy_storage_prepare.sql",
        name,
      ),
    );
  await db.unsafe(`CREATE POLICY shared_storage_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(public.shared_storage_object_access(bucket_id,name,'view'));
  CREATE POLICY shared_storage_create ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.shared_storage_object_access(bucket_id,name,'create'));`);
  await db.unsafe(readFileSync("drizzle/migrations/0366_contract_attachments.sql", "utf8"));
  await db`insert into workspaces(id) values(${W}),(${B})`;
  await db`insert into auth.users(id) values(${U})`;
  await db`insert into profiles(id,active_workspace_id) values(${U},${W})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${W},${U})`;
  await db`insert into job_roles(id,workspace_id) values(${R},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${R},${U},${W},${U})`;
  await db`insert into contracts(id,workspace_id,owner_id,deal_id) values(${IDs[0]},${W},${U},${IDs[2]})`;
  await db`insert into quotes(id,workspace_id,owner_id,deal_id,title) values(${IDs[1]},${W},${U},${IDs[2]},'Cotação de teste')`;
  await db`insert into proposals(id,workspace_id,owner_id,deal_id,title,version) values(${IDs[2]},${W},${U},${IDs[2]},'Proposta de teste',2)`;
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", "-v", container);
  if (nativeStarted)
    execFileSync(pgBin + "pg_ctl", ["-D", join(temporary, "data"), "-m", "fast", "-w", "stop"], {
      stdio: "pipe",
      timeout: 15000,
    });
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}, 30000);

beforeAll(async () => {
  await db.unsafe(`CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions;
 ALTER TABLE storage.objects ADD COLUMN user_metadata jsonb;
 ALTER TABLE profiles ADD COLUMN full_name text;
 ALTER TABLE contracts ADD COLUMN title text DEFAULT 'Contrato',ADD COLUMN number text,ADD COLUMN contracting_legal_entity_id uuid,ADD COLUMN counterparty_company_id uuid,ADD COLUMN starts_at date,ADD COLUMN ends_at date,ADD COLUMN total_value numeric,ADD COLUMN currency text,ADD COLUMN body_html text DEFAULT '<p>Contrato de teste</p>';
 ALTER TABLE quotes ADD COLUMN company_id uuid,ADD COLUMN contact_id uuid,ADD COLUMN template_id uuid;
 ALTER TABLE proposals ADD COLUMN company_id uuid,ADD COLUMN contact_id uuid,ADD COLUMN quote_id uuid;
 ALTER TABLE companies ADD COLUMN name text,ADD COLUMN cnpj text,ADD COLUMN website text;
 ALTER TABLE contacts ADD COLUMN first_name text,ADD COLUMN last_name text,ADD COLUMN email text;
 CREATE TABLE legal_entities(id uuid PRIMARY KEY,workspace_id uuid,name text,cnpj text);
 CREATE TABLE hiring_contract_evidence(document_id uuid,workspace_id uuid,contract_id uuid,contract_hash text,kind text,revoked_at timestamptz);
 CREATE TYPE esign_doc_status AS ENUM('draft','sent','partially_signed','completed','declined','expired','canceled');
 CREATE TYPE esign_signer_status AS ENUM('pending','viewed','signed','declined');
 CREATE TABLE esign_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,title text,description text,body text,status esign_doc_status,ordered boolean DEFAULT false,expires_at timestamptz,sent_at timestamptz,completed_at timestamptz,content_hash text,sealed_at timestamptz);
 CREATE TABLE esign_signers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid,workspace_id uuid,owner_id uuid,name text,email text,sign_order int,status esign_signer_status DEFAULT 'pending',public_token text,signed_name text,signature_data text,signed_at timestamptz,declined_at timestamptz,decline_reason text,viewed_at timestamptz,ip_address text,user_agent text);
 CREATE TABLE esign_audit(document_id uuid,workspace_id uuid,signer_id uuid,owner_id uuid,event text,metadata jsonb,ip_address text,user_agent text);
 CREATE TABLE ats_offers(id uuid,esign_document_id uuid);
 CREATE TABLE services(id uuid PRIMARY KEY,workspace_id uuid,contract_id uuid,name text,quantity numeric,unit_price numeric,currency text);
 CREATE TABLE quote_line_items(id uuid PRIMARY KEY,workspace_id uuid,quote_id uuid,service_catalog_id uuid,contracting_preset_id uuid);
 CREATE TABLE deal_line_items(id uuid PRIMARY KEY,workspace_id uuid,deal_id uuid,service_catalog_id uuid,contracting_preset_id uuid);
 CREATE TABLE service_catalog(id uuid PRIMARY KEY,workspace_id uuid,name text);
 CREATE TABLE contracting_presets(id uuid PRIMARY KEY,workspace_id uuid,name text);
 CREATE TABLE quote_templates(id uuid PRIMARY KEY,workspace_id uuid,html text);
 GRANT USAGE ON SCHEMA extensions TO authenticated;`);
  await db.unsafe(
    sourceFunction(
      "supabase/migrations/20260702201807_dbc392d9-6c74-4c4e-a34f-e3949206f95f.sql",
      "user_has_permission",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0309_hiring_signature_evidence.sql",
      "hiring_signature_access",
    ),
  );
  await db.unsafe(readFileSync("drizzle/migrations/0367_contract_signature_packages.sql", "utf8"));
}, 30000);
async function subject(
  fn: (tx: postgres.TransactionSql) => Promise<void>,
  options: {
    keys?: boolean;
    deny?: boolean;
    inactive?: boolean;
    workspace?: string;
    readOnly?: boolean;
    readOnlyPermissions?: boolean;
  } = {},
) {
  const rollback = new Error("rollback");
  try {
    await db.begin(async (tx) => {
      await tx`update profiles set active_workspace_id=${options.workspace ?? W} where id=${U}`;
      if (options.inactive)
        await tx`update workspace_members set status='inactive' where user_id=${U}`;
      const keys = [
        "techcontracts.contracts.view.workspace",
        "techcontracts.contracts.update.workspace",
        "techsales.quotes.view.workspace",
        "techsales.proposals.view.workspace",
        "techcontracts.signature_evidence.view.workspace",
        "techcontracts.signature_evidence.manage.workspace",
        "techcontracts.esign_share.manage.workspace",
        "techcontracts.purchase_proposals.view.workspace",
        "techcontracts.purchase_proposals.manage.workspace",
        "techcontracts.contract_acceptance.manage.workspace",
      ];
      for (const key of keys) {
        if (options.keys !== false && (!options.readOnlyPermissions || !key.includes(".update.")))
          await tx`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${R},${key},${options.deny ? "deny" : "grant"})`;
      }
      if (options.deny) {
        const set = "40000000-0000-4000-8000-0000000000d1";
        await tx`insert into permission_sets(id,workspace_id,module) values(${set},${W},'techcontracts')`;
        await tx`insert into user_permission_sets(user_id,set_id,workspace_id,owner_id) values(${U},${set},${W},${U})`;
        for (const key of keys)
          await tx`insert into permission_set_items(set_id,permission_key) values(${set},${key})`;
      }
      if (options.workspace && options.workspace !== W) {
        const role = "30000000-0000-4000-8000-0000000000b8";
        await tx`insert into workspace_members(workspace_id,user_id,status) values(${options.workspace},${U},'active')`;
        await tx`insert into job_roles(id,workspace_id) values(${role},${options.workspace})`;
        await tx`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${role},${U},${options.workspace},${U})`;
        for (const key of keys)
          await tx`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${options.workspace},${role},${key},'grant')`;
      }
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "authenticated" })},true)`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await fn(tx);
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
}
const rpc = (
  tx: postgres.TransactionSql,
  action: string,
  data: Record<string, string | number | null> = {},
) => tx`select contract_attachment_manage(${IDs[0]},${action},${tx.json(data)}::jsonb) result`;

beforeAll(async () => {
  // Structural fixtures for adjacent modules. All audience decisions, record
  // visibility, active-membership, effective permissions and storage gates below
  // are loaded verbatim from production SQL, not authorization stubs.
  await db.unsafe(`CREATE ROLE techerp_request_writer NOLOGIN NOSUPERUSER NOBYPASSRLS;
   ALTER TABLE contracts ADD COLUMN role text DEFAULT 'provider',ADD COLUMN hiring_request_origin uuid,ADD COLUMN parent_contract_id uuid,
    ADD COLUMN legal_entity_id uuid,ADD COLUMN status text DEFAULT 'draft',ADD COLUMN payment_terms jsonb;
   ALTER TABLE services ADD COLUMN description text,ADD COLUMN type text,ADD COLUMN cadence text;
   ALTER TABLE workspaces ADD COLUMN name text;
   ALTER TABLE proposals ADD COLUMN status text,ADD COLUMN locked boolean,ADD COLUMN sent_at timestamptz,ADD COLUMN public_token text;
   CREATE TABLE contract_templates(id uuid PRIMARY KEY,workspace_id uuid,role text);
   CREATE TABLE contract_drafts(id uuid PRIMARY KEY,workspace_id uuid,title text,body_html text,status text,client_decided_at timestamptz,client_name text,hiring_request_origin uuid,template_id uuid,prepared_terms jsonb DEFAULT '{}',public_token uuid,proposal_id uuid);
   CREATE TABLE contract_purchase_sales(workspace_id uuid,purchase_contract_id uuid,sale_contract_id uuid);
   CREATE TABLE contract_forsign_operations(workspace_id uuid,contract_id uuid,status text,created_by uuid);
   CREATE TABLE contract_esign_deliveries(workspace_id uuid,contract_id uuid,actor_id uuid);
   ALTER TABLE hiring_contract_evidence ADD COLUMN recorded_by uuid;
   CREATE TABLE contract_commercial_acceptances(id uuid PRIMARY KEY,revoked_at timestamptz,client_name text,accepted_at date);
   CREATE TABLE contract_commercial_acceptance_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,contract_id uuid,content_hash text,token_hash text,snapshot jsonb,created_by uuid,expires_at timestamptz,revoked_at timestamptz,accepted_id uuid);
   CREATE FUNCTION hiring_formalization_preview_access(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
   CREATE SCHEMA sales_private;`);
  // Exact table definitions are reused so trusted provenance is checked against
  // the same version/attachment/hash constraints as the production writer.
  const purchase = readFileSync("drizzle/migrations/0487_purchase_technical_proposals.sql", "utf8");
  await db.unsafe(
    purchase.slice(
      purchase.indexOf("CREATE TABLE public.purchase_proposal_templates("),
      purchase.indexOf("CREATE INDEX contract_purchase_proposals_contract"),
    ),
  );
  for (const [file, name] of [
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "work_subject_context"],
    [
      "drizzle/migrations/0379_hiring_formalization_integrity.sql",
      "hiring_formalization_document_locked",
    ],
    [
      "drizzle/migrations/0468_contract_attachments_all_served_sales.sql",
      "contract_attachment_manage",
    ],
    ["drizzle/migrations/0487_purchase_technical_proposals.sql", "purchase_proposal_access"],
    [
      "drizzle/migrations/0487_purchase_technical_proposals.sql",
      "purchase_proposal_mutation_problem",
    ],
    [
      "drizzle/migrations/0483_contract_commercial_acceptance.sql",
      "contract_commercial_content_hash",
    ],
    ["drizzle/migrations/0483_contract_commercial_acceptance.sql", "contract_commercial_authorize"],
    [
      "drizzle/migrations/0483_contract_commercial_acceptance.sql",
      "contract_commercial_annexes_visible",
    ],
    [
      "drizzle/migrations/0483_contract_commercial_acceptance.sql",
      "contract_commercial_issue_link",
    ],
    [
      "drizzle/migrations/0483_contract_commercial_acceptance.sql",
      "contract_commercial_public_get",
    ],
    [
      "drizzle/migrations/0485_contract_acceptance_public_attachments.sql",
      "contract_commercial_public_attachment",
    ],
  ])
    await db.unsafe(sourceFunction(file, name));
  const ctxResolver = readFileSync(
    "drizzle/migrations/0328_sales_capabilities_single_context.sql",
    "utf8",
  );
  await db.unsafe(
    ctxResolver.slice(
      ctxResolver.indexOf("DO $mig$"),
      ctxResolver.indexOf("-- Same result as before"),
    ),
  );
  await db.unsafe(`CREATE ROLE sandbox_exec NOLOGIN NOSUPERUSER BYPASSRLS;
    ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO sandbox_exec;
    ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO sandbox_exec;
    GRANT EXECUTE ON FUNCTION contract_attachment_manage(uuid,text,jsonb),contract_attachment_signing_context(uuid,text),contract_signature_package_store(uuid,uuid,uuid,text,text,text,jsonb,integer) TO sandbox_exec;`);
  await db.unsafe(readFileSync("drizzle/migrations/0488_purchase_document_audience.sql", "utf8"));
}, 30000);

async function purchase(tx: postgres.TransactionSql) {
  await tx.unsafe("RESET ROLE");
  await tx`update contracts set role='client',deal_id=NULL where id=${IDs[0]}`;
  await tx.unsafe("SET LOCAL ROLE authenticated");
}
async function upload(tx: postgres.TransactionSql, name = "Documento de teste.pdf") {
  const reserved = (await rpc(tx, "reserve", { name }))[0].result;
  await tx`insert into storage.objects(bucket_id,name,metadata) values('contract-attachments',${reserved.path},${tx.json({ size: 12 })})`;
  await rpc(tx, "finish", { id: reserved.id, sha256: "a".repeat(64) });
  return reserved as { id: string; path: string };
}
async function contentHash(tx: postgres.TransactionSql) {
  await tx.unsafe("RESET ROLE");
  const hash = (await tx`select hiring_contract_fingerprint(${IDs[0]}) value`)[0].value;
  await tx.unsafe("SET LOCAL ROLE authenticated");
  return hash as string;
}
const check = (tx: postgres.TransactionSql, hash: string | null = null) =>
  tx`select contract_attachment_audience_check(${IDs[0]},${hash}) value`;

it("permits the active authorized member and separates all sale sources from purchase", () =>
  subject(async (tx) => {
    await purchase(tx);
    expect((await rpc(tx, "sources"))[0].result).toEqual([]);
    expect((await check(tx))[0].value.audience).toBe("supplier");
    expect((await tx`select hiring_attachment_policy(${IDs[0]}) value`)[0].value.is_purchase).toBe(
      true,
    );
  }));
it("rejects missing permission", async () => {
  await expect(
    subject(
      async (tx) => {
        await check(tx);
      },
      { keys: false },
    ),
  ).rejects.toThrow();
});
it("rejects explicit deny even with a granting permission set", async () => {
  await expect(
    subject(
      async (tx) => {
        await check(tx);
      },
      { deny: true },
    ),
  ).rejects.toThrow();
});
it("rejects another active workspace with its own grants", async () => {
  await expect(
    subject(
      async (tx) => {
        await check(tx);
      },
      { workspace: B },
    ),
  ).rejects.toThrow();
});
it("rejects inactive membership", async () => {
  await expect(
    subject(
      async (tx) => {
        await check(tx);
      },
      { inactive: true },
    ),
  ).rejects.toThrow();
});
it("does not inherit customer references through a direct purchase insert or changed origin", async () => {
  await expect(
    subject(async (tx) => {
      await tx.unsafe("RESET ROLE");
      await tx`insert into contracts(id,workspace_id,owner_id,role,proposal_id) values(${randomUUID()},${W},${U},'client',${IDs[2]})`;
    }),
  ).rejects.toThrow("Compra independente");
  await expect(
    subject(async (tx) => {
      await tx.unsafe("RESET ROLE");
      await tx`update contracts set role='client' where id=${IDs[0]}`;
    }),
  ).rejects.toThrow("Compra independente");
});
it("rejects purchase quote/proposal linking even when the caller can read the customer source", async () => {
  await expect(
    subject(async (tx) => {
      await purchase(tx);
      await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
    }),
  ).rejects.toThrow("Cotações e propostas de venda pertencem ao cliente");
});
it("preserves old mixed documents and frozen bytes, but blocks a new purchase preview", async () => {
  await expect(
    subject(async (tx) => {
      await rpc(tx, "link", { kind: "proposal", source_id: IDs[2] });
      await purchase(tx);
      expect((await rpc(tx, "list"))[0].result).toHaveLength(1);
      await check(tx);
    }),
  ).rejects.toThrow("Revise o público");
});
it("requires explicit review and versions the public selection without rewriting bytes", () =>
  subject(async (tx) => {
    await purchase(tx);
    const file = await upload(tx);
    const hash = await contentHash(tx);
    expect((await rpc(tx, "list"))[0].result[0]).toMatchObject({
      audience: "internal",
      review_required: true,
      commercial_sensitive: true,
    });
    await rpc(tx, "review", { id: file.id, audience: "supplier" });
    const reviewedHash = await contentHash(tx);
    expect((await check(tx, reviewedHash))[0].value.attachments).toEqual([
      { id: file.id, audience: "supplier", commercial_sensitive: true },
    ]);
    expect(reviewedHash).not.toBe(hash);
    expect((await tx`select sha256 from contract_attachments where id=${file.id}`)[0].sha256).toBe(
      "a".repeat(64),
    );
    expect(await tx`select * from contract_attachment_audience_reviews`).toHaveLength(1);
  }));
it("blocks unknown uploads from both native and ForSign preparation", async () => {
  await expect(
    subject(async (tx) => {
      await purchase(tx);
      await upload(tx);
      const hash = await contentHash(tx);
      await tx`select contract_attachment_signing_context(${IDs[0]},${hash})`;
    }),
  ).rejects.toThrow("Revise o público");
  await expect(
    subject(async (tx) => {
      await purchase(tx);
      await upload(tx);
      await tx.unsafe("RESET ROLE");
      await tx`insert into contract_forsign_operations(workspace_id,contract_id,status) values(${W},${IDs[0]},'creating')`;
    }),
  ).rejects.toThrow("Revise o público");
});
it("requires economic access for list, raw metadata, storage and download", () =>
  subject(async (tx) => {
    await purchase(tx);
    const file = await upload(tx);
    await tx.unsafe("RESET ROLE");
    await tx`delete from job_role_permission_overrides where role_id=${R} and permission_key='techcontracts.purchase_proposals.view.workspace'`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect((await rpc(tx, "list"))[0].result).toEqual([]);
    expect(await tx`select * from contract_attachments`).toHaveLength(0);
    expect(await tx`select * from storage.objects where name=${file.path}`).toHaveLength(0);
  }));
it("does not allow a generated supplier PDF to be relabeled for customer access", async () => {
  await expect(
    subject(async (tx) => {
      await purchase(tx);
      const file = await upload(tx);
      await rpc(tx, "review", { id: file.id, audience: "client" });
    }),
  ).rejects.toThrow("Público incompatível");
  await expect(
    subject(async (tx) => {
      await purchase(tx);
      const file = await upload(tx);
      await rpc(tx, "review", { id: file.id, audience: "technical_shared" });
    }),
  ).rejects.toThrow("Público incompatível");
});
it("refuses re-review after an existing native signature dispatch", async () => {
  await expect(
    subject(async (tx) => {
      await purchase(tx);
      const file = await upload(tx);
      await rpc(tx, "review", { id: file.id, audience: "supplier" });
      await tx.unsafe("RESET ROLE");
      const doc = (
        await tx`insert into esign_documents(workspace_id,status) values(${W},'sent') returning id`
      )[0].id;
      await tx`insert into hiring_contract_evidence(document_id,workspace_id,contract_id,kind) values(${doc},${W},${IDs[0]},'native')`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await rpc(tx, "review", { id: file.id, audience: "supplier" });
    }),
  ).rejects.toThrow("Documento em assinatura");
});
it("rejects stale hashes and tampered cross-contract download ids", async () => {
  await expect(
    subject(async (tx) => {
      await check(tx, "b".repeat(64));
    }),
  ).rejects.toThrow("alterados");
  await expect(
    subject(async (tx) => {
      await tx`select contract_attachment_access_check(${IDs[0]},${randomUUID()})`;
    }),
  ).rejects.toThrow("Anexo indisponível");
});
it("rejects direct access to private and pre-audience functions", () =>
  subject(async (tx) => {
    const hidden = [
      "contract_document_audience_valid(uuid,uuid,boolean)",
      "contract_document_audience_assert(uuid,uuid,uuid,text)",
      "contract_attachment_manage_before_audience(uuid,text,jsonb)",
      "contract_attachment_signing_context_before_audience(uuid,text)",
      "contract_signature_package_store_before_audience(uuid,uuid,uuid,text,text,text,jsonb,integer)",
      "contract_commercial_public_get_before_audience(text)",
      "purchase_proposal_classify_attachment(uuid,uuid)",
    ];
    for (const fn of hidden) {
      expect(
        (await tx`select has_function_privilege('authenticated',${fn},'EXECUTE') value`)[0].value,
      ).toBe(false);
      expect(
        (await tx`select has_function_privilege('service_role',${fn},'EXECUTE') value`)[0].value,
      ).toBe(false);
      expect(
        (await tx`select has_function_privilege('sandbox_exec',${fn},'EXECUTE') value`)[0].value,
      ).toBe(false);
    }
    expect(
      (
        await tx`select has_table_privilege('sandbox_exec','contract_attachment_audience_reviews','SELECT') value`
      )[0].value,
    ).toBe(false);
  }));
it("retains unchanged customer quote/proposal behavior", () =>
  subject(async (tx) => {
    await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
    const hash = await contentHash(tx);
    const context = (
      await tx`select contract_attachment_signing_context(${IDs[0]},${hash}) value`
    )[0].value;
    expect(context.attachments).toHaveLength(1);
    expect((await check(tx, hash))[0].value.audience).toBe("client");
  }));
it("does not manufacture trusted provenance from an arbitrary uploaded PDF", async () => {
  await expect(
    subject(async (tx) => {
      await purchase(tx);
      const file = await upload(tx);
      await tx.unsafe("RESET ROLE");
      await tx`select purchase_proposal_classify_attachment(${randomUUID()},${file.id})`;
    }),
  ).rejects.toThrow("Proveniência");
});
it("classifies only its own generated, reviewed and hash-matched purchase version", () =>
  subject(async (tx) => {
    await purchase(tx);
    const file = await upload(tx);
    await tx.unsafe("RESET ROLE");
    const template = (
      await tx`insert into purchase_proposal_templates(workspace_id,name,design,created_by,updated_by) values(${W},'Modelo teste','{}',${U},${U}) returning id`
    )[0].id;
    const doc = (
      await tx`insert into contract_purchase_proposals(workspace_id,contract_id,version,template_id,template_revision,data,design,parties,contract_hash,status,attachment_id,sha256,created_by,reviewed_by,reviewed_at)
    values(${W},${IDs[0]},1,${template},1,'{}','{}','{}',${"b".repeat(64)},'generated',${file.id},${"a".repeat(64)},${U},${U},now()) returning id`
    )[0].id;
    await tx`select purchase_proposal_classify_attachment(${doc},${file.id})`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect((await check(tx))[0].value.attachments).toEqual([
      { id: file.id, audience: "supplier", commercial_sensitive: true },
    ]);
  }));
it("rejects foreign, swapped and hash-divergent generated attachment identities", async () => {
  await expect(
    subject(async (tx) => {
      await purchase(tx);
      const file = await upload(tx);
      await tx.unsafe("RESET ROLE");
      const template = (
        await tx`insert into purchase_proposal_templates(workspace_id,name,design,created_by,updated_by) values(${W},'Modelo teste','{}',${U},${U}) returning id`
      )[0].id;
      const doc = (
        await tx`insert into contract_purchase_proposals(workspace_id,contract_id,version,template_id,template_revision,data,design,parties,contract_hash,status,attachment_id,sha256,created_by,reviewed_by,reviewed_at)
     values(${W},${IDs[0]},1,${template},1,'{}','{}','{}',${"b".repeat(64)},'generated',${file.id},${"c".repeat(64)},${U},${U},now()) returning id`
      )[0].id;
      await tx`select purchase_proposal_classify_attachment(${doc},${file.id})`;
    }),
  ).rejects.toThrow("Proveniência");
});
it("never discloses data through malformed or unknown public tokens", () =>
  subject(async (tx) => {
    await tx.unsafe("RESET ROLE");
    await tx.unsafe("SET LOCAL ROLE service_role");
    for (const token of ["", "tampered", "b".repeat(64)]) {
      expect((await tx`select contract_commercial_public_get(${token}) value`)[0].value).toBeNull();
      expect(
        (await tx`select contract_commercial_public_attachment(${token},${randomUUID()}) value`)[0]
          .value,
      ).toBeNull();
    }
  }));
it("supplier draft capabilities omit sales tokens and all sale/customer backreferences", () =>
  subject(async (tx) => {
    await tx.unsafe("RESET ROLE");
    const template = randomUUID(),
      token = randomUUID();
    await tx`insert into contract_templates(id,workspace_id,role) values(${template},${W},'client')`;
    await tx`update proposals set status='accepted',locked=true,sent_at=now(),public_token='never-expose-customer-token' where id=${IDs[2]}`;
    await tx`insert into contract_drafts(id,workspace_id,title,body_html,status,template_id,public_token,proposal_id) values(${randomUUID()},${W},'Minuta da compra','<p>Compra</p>','sent',${template},${token},${IDs[2]})`;
    await tx.unsafe("SET LOCAL ROLE service_role");
    const result = (await tx`select contract_draft_public_get(${token}) value`)[0].value;
    expect(result.document_audience).toBe("supplier");
    expect(result.proposal_public_token).toBeNull();
    expect(JSON.stringify(result)).not.toContain(IDs[2]);
    expect(JSON.stringify(result)).not.toContain("never-expose-customer-token");
  }));

it("keeps explicitly reviewed internal files out of previews, manifests and public attachment capabilities", () =>
  subject(async (tx) => {
    const internal = await upload(tx, "Custos privados da prestadora.pdf");
    const external = await upload(tx, "Condições do cliente.pdf");
    await rpc(tx, "review", { id: internal.id, audience: "internal" });
    await rpc(tx, "review", { id: external.id, audience: "client" });
    const hash = await contentHash(tx);
    const context = (
      await tx`select contract_attachment_signing_context(${IDs[0]},${hash}) value`
    )[0].value;
    expect(context.attachments.map((x: { id: string }) => x.id)).toEqual([external.id]);
    expect(JSON.stringify(context)).not.toContain(internal.id);
    const list = (await rpc(tx, "list"))[0].result;
    expect(list.find((x: { id: string }) => x.id === internal.id)).toMatchObject({
      signature_included: false,
      sharing_blocked: false,
      review_required: false,
    });
    await tx.unsafe("RESET ROLE");
    const commercialHash = (await tx`select contract_commercial_content_hash(${IDs[0]}) value`)[0]
      .value;
    const token = "c".repeat(64);
    await tx`insert into contract_commercial_acceptance_links(workspace_id,contract_id,content_hash,token_hash,snapshot,created_by,expires_at)
   values(${W},${IDs[0]},${commercialHash},encode(extensions.digest(convert_to(${token},'UTF8'),'sha256'),'hex'),${tx.json(
     {
       title: "Condições do cliente",
       attachments: [
         { id: internal.id, name: "Custos privados da prestadora.pdf" },
         { id: external.id, name: "Condições do cliente.pdf" },
       ],
     },
   )},${U},now()+interval '1 day')`;
    await tx.unsafe("SET LOCAL ROLE service_role");
    const publicDoc = (await tx`select contract_commercial_public_get(${token}) value`)[0].value;
    expect(publicDoc.attachments.map((x: { id: string }) => x.id)).toEqual([external.id]);
    expect(JSON.stringify(publicDoc)).not.toContain("Custos privados");
    expect(
      (await tx`select contract_commercial_public_attachment(${token},${internal.id}) value`)[0]
        .value,
    ).toBeNull();
    expect(
      (await tx`select contract_commercial_public_attachment(${token},${external.id}) value`)[0]
        .value.attachmentId,
    ).toBe(external.id);
  }));
it("allows a contract with only reviewed internal files without requiring an empty PDF package", () =>
  subject(async (tx) => {
    const file = await upload(tx, "Memória interna.pdf");
    await rpc(tx, "review", { id: file.id, audience: "internal" });
    const hash = await contentHash(tx);
    expect(
      (await tx`select contract_attachment_signing_context(${IDs[0]},${hash}) value`)[0].value
        .attachments,
    ).toEqual([]);
    await tx.unsafe("RESET ROLE");
    await tx.unsafe("SET LOCAL ROLE service_role");
    const body = (await tx`select hiring_contract_esign_body(${W},${IDs[0]}) value`)[0].value;
    expect(body).toContain("Contrato de teste");
    expect(body).not.toContain("Memória interna");
  }));
it("requires classification for a new governed dispatch too", async () => {
  await expect(
    subject(async (tx) => {
      await tx.unsafe("RESET ROLE");
      await tx`update contracts set hiring_request_origin=${randomUUID()},role='client',deal_id=NULL where id=${IDs[0]}`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await upload(tx);
      await check(tx);
    }),
  ).rejects.toThrow("Revise o público");
});
it("preserves receipt of an already completed external operation without a new share", () =>
  subject(async (tx) => {
    await tx.unsafe("RESET ROLE");
    await tx`insert into contract_forsign_operations(workspace_id,contract_id,status) values(${W},${IDs[0]},'completed')`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await upload(tx, "Original legado já enviado.pdf");
    await tx.unsafe("RESET ROLE");
    await tx`insert into hiring_contract_evidence(workspace_id,contract_id,kind) values(${W},${IDs[0]},'external')`;
    expect(
      await tx`select * from hiring_contract_evidence where contract_id=${IDs[0]} and kind='external'`,
    ).toHaveLength(1);
    expect(
      (await tx`select contract_document_audience_valid(${W},${IDs[0]},true) value`)[0].value,
    ).toBe(true);
    expect(
      (await tx`select contract_document_audience_valid(${W},${IDs[0]},false) value`)[0].value,
    ).toBe(false);
  }));

it("denies a direct native or ForSign dispatch after the actor loses economic visibility", async () => {
  for (const table of ["contract_forsign_operations", "hiring_contract_evidence"]) {
    await expect(
      subject(async (tx) => {
        await purchase(tx);
        const file = await upload(tx);
        await rpc(tx, "review", { id: file.id, audience: "supplier" });
        await tx.unsafe("RESET ROLE");
        await tx`delete from job_role_permission_overrides where role_id=${R} and permission_key='techcontracts.purchase_proposals.view.workspace'`;
        // Simulates the write inside the canonical SECURITY DEFINER/server writer,
        // bypassing the renderer/cache path while preserving the real caller JWT.
        if (table === "contract_forsign_operations")
          await tx`insert into contract_forsign_operations(workspace_id,contract_id,status,created_by) values(${W},${IDs[0]},'creating',${U})`;
        else
          await tx`insert into hiring_contract_evidence(workspace_id,contract_id,kind,recorded_by) values(${W},${IDs[0]},'native',${U})`;
      }),
    ).rejects.toThrow("Sem permissão para compartilhar");
  }
});
it("rechecks the explicit initiating actor on a service-only ForSign insert", () =>
  subject(async (tx) => {
    await purchase(tx);
    const file = await upload(tx);
    await rpc(tx, "review", { id: file.id, audience: "supplier" });
    await tx.unsafe("RESET ROLE");
    await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
    await tx`insert into contract_forsign_operations(workspace_id,contract_id,status,created_by) values(${W},${IDs[0]},'creating',${U})`;
    expect(await tx`select * from contract_forsign_operations where created_by=${U}`).toHaveLength(
      1,
    );
  }));
