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
const container = "techerp-attachments-ci-" + randomUUID();
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
  if (started) dockerRun("rm", "-f", container);
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
it("attachments allow active authorized member and idempotent source links", () =>
  subject(async (tx) => {
    expect((await rpc(tx, "sources"))[0].result).toHaveLength(2);
    for (let i = 0; i < 2; i++) await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
    await rpc(tx, "link", { kind: "proposal", source_id: IDs[2] });
    const rows = (await rpc(tx, "list"))[0].result;
    expect(rows).toHaveLength(2);
    expect(rows.some((x: { name: string }) => x.name.includes("versão 2"))).toBe(true);
    await rpc(tx, "remove", { id: rows[0].id });
    expect((await rpc(tx, "list"))[0].result).toHaveLength(1);
  }));
it("attachments reject missing permission", async () => {
  await expect(
    subject(
      async (tx) => {
        await rpc(tx, "reserve", { name: "teste.pdf" });
      },
      { keys: false },
    ),
  ).rejects.toThrow();
});
it("attachments reject explicit deny", async () => {
  await expect(
    subject(
      async (tx) => {
        await rpc(tx, "reserve", { name: "teste.pdf" });
      },
      { deny: true },
    ),
  ).rejects.toThrow();
});
it("attachments reject foreign workspace", async () => {
  await expect(
    subject(
      async (tx) => {
        await rpc(tx, "reserve", { name: "teste.pdf" });
      },
      { workspace: B },
    ),
  ).rejects.toThrow();
});
it("attachments reject inactive member", async () => {
  await expect(
    subject(
      async (tx) => {
        await rpc(tx, "reserve", { name: "teste.pdf" });
      },
      { inactive: true },
    ),
  ).rejects.toThrow();
});
it("attachments reject writes for read-only permissions", async () => {
  await expect(
    subject(
      async (tx) => {
        await rpc(tx, "reserve", { name: "teste.pdf" });
      },
      { readOnlyPermissions: true },
    ),
  ).rejects.toThrow();
});
it("attachments hide pending files and enforce immutable storage", () =>
  subject(async (tx) => {
    const file = (await rpc(tx, "reserve", { name: "teste.pdf" }))[0].result;
    expect((await rpc(tx, "list"))[0].result).toHaveLength(0);
    await tx`insert into storage.objects(bucket_id,name,metadata) values('contract-attachments',${file.path},${tx.json({ size: 12 })}::jsonb)`;
    await rpc(tx, "finish", { id: file.id, sha256: "a".repeat(64) });
    expect((await rpc(tx, "list"))[0].result).toHaveLength(1);
    expect(await tx`select * from storage.objects where name=${file.path}`).toHaveLength(1);
    expect(
      await tx`update storage.objects set metadata='{}' where name=${file.path} returning name`,
    ).toHaveLength(0);
    expect(
      await tx`delete from storage.objects where name=${file.path} returning name`,
    ).toHaveLength(0);
    await rpc(tx, "remove", { id: file.id });
    expect(await tx`select * from storage.objects where name=${file.path}`).toHaveLength(0);
  }));
it("attachments deny direct metadata writes", async () => {
  await expect(
    subject(async (tx) => {
      await tx`delete from contract_attachments`;
    }),
  ).rejects.toThrow("permission denied");
});
it("attachments do not disclose revoked commercial sources", () =>
  subject(async (tx) => {
    await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
    await tx.unsafe("RESET ROLE");
    await tx`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${R} and permission_key='techsales.quotes.view.workspace'`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect((await rpc(tx, "list"))[0].result).toHaveLength(0);
    expect(await tx`select * from contract_attachments`).toHaveLength(0);
  }));
it("attachments reject a commercial source from an unrelated deal", async () => {
  await expect(
    subject(async (tx) => {
      await tx.unsafe("RESET ROLE");
      await tx`update quotes set deal_id=NULL where id=${IDs[1]}`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
    }),
  ).rejects.toThrow("Documento comercial indisponível");
});
it("attachments reject missing upload and path traversal", async () => {
  await expect(
    subject(async (tx) => {
      const file = (await rpc(tx, "reserve", { name: "teste.pdf" }))[0].result;
      await rpc(tx, "finish", { id: file.id, sha256: "a".repeat(64) });
    }),
  ).rejects.toThrow("Upload não concluído");
  await expect(
    subject(async (tx) => {
      await rpc(tx, "reserve", { name: "../teste.pdf" });
    }),
  ).rejects.toThrow("Nome de arquivo inválido");
});
it("attachments cannot write storage without an authorized reservation", async () => {
  await expect(
    subject(async (tx) => {
      await tx`insert into storage.objects(bucket_id,name,metadata) values('contract-attachments','foreign/path',${tx.json({ size: 12 })})`;
    }),
  ).rejects.toThrow("row-level security");
});

async function fingerprint(tx: postgres.TransactionSql) {
  await tx.unsafe("RESET ROLE");
  const hash = (await tx`select hiring_contract_fingerprint(${IDs[0]}) value`)[0].value as string;
  await tx.unsafe("SET LOCAL ROLE authenticated");
  return hash;
}
it("signature package preserves old fingerprint when there are no attachments", () =>
  subject(async (tx) => {
    const hash = await fingerprint(tx);
    await tx.unsafe("RESET ROLE");
    expect(
      (await tx`select hiring_contract_fingerprint_without_attachments(${IDs[0]}) value`)[0].value,
    ).toBe(hash);
  }));
it("signature package invalidates the version on source changes and refuses stale input", async () => {
  await expect(
    subject(async (tx) => {
      await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
      const hash = await fingerprint(tx);
      await tx.unsafe("RESET ROLE");
      await tx`update quotes set title='Cotação revisada' where id=${IDs[1]}`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      expect(await fingerprint(tx)).not.toBe(hash);
      await tx`select contract_attachment_signing_context(${IDs[0]},${hash})`;
    }),
  ).rejects.toThrow("anexos alterados");
});
it("signature package requires all selected source permissions", async () => {
  await expect(
    subject(async (tx) => {
      await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
      const hash = await fingerprint(tx);
      await tx.unsafe("RESET ROLE");
      await tx`delete from job_role_permission_overrides where role_id=${R} and permission_key='techsales.quotes.view.workspace'`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx`select contract_attachment_signing_context(${IDs[0]},${hash})`;
    }),
  ).rejects.toThrow("anexo comercial");
});
it("signature package includes selected sources for an authorized active member", () =>
  subject(async (tx) => {
    await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
    const hash = await fingerprint(tx);
    const c = (await tx`select contract_attachment_signing_context(${IDs[0]},${hash}) value`)[0]
      .value;
    expect(c.attachments).toHaveLength(1);
    expect(c.attachments[0].stamp).toHaveLength(64);
    expect(c.body).toContain("Contrato");
  }));
it("signature package rejects missing permission", async () => {
  await expect(
    subject(
      async (tx) => {
        await tx`select contract_attachment_signing_context(${IDs[0]},${"a".repeat(64)})`;
      },
      { keys: false },
    ),
  ).rejects.toThrow("Sem permissão");
});
it("signature package rejects explicit deny", async () => {
  await expect(
    subject(
      async (tx) => {
        await tx`select contract_attachment_signing_context(${IDs[0]},${"a".repeat(64)})`;
      },
      { deny: true },
    ),
  ).rejects.toThrow("Sem permissão");
});
it("signature package rejects foreign workspace", async () => {
  await expect(
    subject(
      async (tx) => {
        await tx`select contract_attachment_signing_context(${IDs[0]},${"a".repeat(64)})`;
      },
      { workspace: B },
    ),
  ).rejects.toThrow("Sem permissão");
});
it("signature package rejects inactive member", async () => {
  await expect(
    subject(
      async (tx) => {
        await tx`select contract_attachment_signing_context(${IDs[0]},${"a".repeat(64)})`;
      },
      { inactive: true },
    ),
  ).rejects.toThrow("Sem permissão");
});
it("signature package cannot be forged directly by an authenticated client", async () => {
  await expect(
    subject(async (tx) => {
      await tx`select contract_signature_package_store(${W},${IDs[0]},${U},${"a".repeat(64)},'fake/path',${"b".repeat(64)},'[]'::jsonb,1)`;
    }),
  ).rejects.toThrow("permission denied");
});
it("signature package is mandatory before native body preparation with annexes", async () => {
  await expect(
    subject(async (tx) => {
      await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
      await tx.unsafe("RESET ROLE");
      await tx`select hiring_contract_esign_body(${W},${IDs[0]})`;
    }),
  ).rejects.toThrow("Prepare o pacote");
});
it("signature package seals the PDF identity into the native signature body", () =>
  subject(async (tx) => {
    await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
    const hash = await fingerprint(tx);
    const path = `${W}/${IDs[0]}/${hash}/packet.pdf`,
      digest = "b".repeat(64);
    const stamp = (await tx`select contract_attachment_signing_context(${IDs[0]},${hash}) value`)[0]
      .value.attachments[0].stamp;
    const sourcePath = `${W}/${IDs[0]}/${hash}/quote.pdf`;
    const manifest = [
      {
        id: (await rpc(tx, "list"))[0].result[0].id,
        kind: "quote",
        stamp,
        source_pdf_path: sourcePath,
        name: "Cotação <teste>",
        sha256: "c".repeat(64),
      },
    ];
    await tx.unsafe("RESET ROLE");
    await tx`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-packages',${path},${tx.json({ sha256: digest })})`;
    await tx`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-packages',${sourcePath},${tx.json({ sha256: "c".repeat(64) })})`;
    await tx.unsafe("SET LOCAL ROLE service_role");
    const row = (
      await tx`select contract_signature_package_store(${W},${IDs[0]},${U},${hash},${path},${digest},${tx.json(manifest)},3) value`
    )[0].value;
    expect(row.sha256).toBe(digest);
    await tx.unsafe("RESET ROLE");
    const body = (await tx`select hiring_contract_esign_body(${W},${IDs[0]}) value`)[0]
      .value as string;
    expect(body).toContain(`pacote PDF de SHA-256 ${digest}`);
    expect(body).toContain("Cotação &lt;teste&gt;");
    const document = (
      await tx`insert into esign_documents(workspace_id,owner_id,title,body,status,content_hash,sealed_at) values(${W},${U},'Contrato',${body},'sent','sealed',now()) returning id`
    )[0].id;
    const secret = "allowed-signer-token-0000001";
    await tx`insert into esign_signers(document_id,workspace_id,owner_id,name,email,sign_order,public_token) values(${document},${W},${U},'Cliente','cliente@example.test',1,${secret})`;
    await tx`insert into hiring_contract_evidence(document_id,workspace_id,contract_id,contract_hash,kind) values(${document},${W},${IDs[0]},${hash},'native')`;
    await tx.unsafe("SET LOCAL ROLE service_role");
    expect((await tx`select contract_esign_public(${secret},'view') value`)[0].value.canSign).toBe(
      true,
    );
    await tx.unsafe("RESET ROLE");

    expect((await tx`select hiring_contract_fingerprint(${IDs[0]}) value`)[0].value).toBe(hash);
    await tx`update quotes set title='Outra versão futura' where id=${IDs[1]}`;
    expect((await tx`select hiring_contract_fingerprint(${IDs[0]}) value`)[0].value).toBe(hash);

    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect(
      await tx`select * from storage.objects where bucket_id='contract-signature-packages'`,
    ).toHaveLength(0);
  }));

it("signature package rejects a direct signature when its package was revoked or not registered", async () => {
  await expect(
    subject(async (tx) => {
      await tx.unsafe("RESET ROLE");
      const document = (
        await tx`insert into esign_documents(workspace_id,owner_id,title,body,status) values(${W},${U},'Contrato','<!--techerp:contract-package:unregistered:hash-->','sent') returning id`
      )[0].id;
      const secret = "invalid-packet-signer-token-0001";
      await tx`insert into esign_signers(document_id,workspace_id,owner_id,name,email,sign_order,public_token) values(${document},${W},${U},'Cliente','cliente@example.test',1,${secret})`;
      await tx.unsafe("SET LOCAL ROLE service_role");
      await tx`select contract_esign_public(${secret},'sign','Cliente Teste')`;
    }),
  ).rejects.toThrow("Pacote de assinatura revogado");
});

it("signature package rejects an empty main contract before assembling annexes", async () => {
  await expect(
    subject(async (tx) => {
      await rpc(tx, "link", { kind: "quote", source_id: IDs[1] });
      await tx.unsafe("RESET ROLE");
      await tx`update contracts set body_html='' where id=${IDs[0]}`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      const hash = await fingerprint(tx);
      await tx`select contract_attachment_signing_context(${IDs[0]},${hash})`;
    }),
  ).rejects.toThrow("Preencha o corpo do contrato");
});

it("foreign workspace fixture is active and has its own workspace grants", () =>
  subject(
    async (tx) => {
      const context = (await tx`select work_access_context() value`)[0].value;
      expect(context.workspace).toBe(B);
      expect(context.keys["techcontracts.contracts.view.workspace"]).toBe(true);
    },
    { workspace: B },
  ));

it("anonymous legacy storage grants cannot disclose contract attachments or packages", () =>
  subject(async (tx) => {
    await tx.unsafe("RESET ROLE");
    await tx`insert into storage.objects(bucket_id,name,metadata) values('contract-attachments','private-test-file',${tx.json({ size: 12 })}),('contract-signature-packages','private-test-package',${tx.json({ size: 12 })})`;
    await tx`select set_config('request.jwt.claims','{}',true)`;
    await tx.unsafe("SET LOCAL ROLE anon");
    expect(await tx`select * from storage.objects`).toHaveLength(0);
  }));
