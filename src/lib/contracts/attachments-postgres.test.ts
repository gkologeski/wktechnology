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
      for (const key of [
        "techcontracts.contracts.view.workspace",
        "techcontracts.contracts.update.workspace",
        "techsales.quotes.view.workspace",
        "techsales.proposals.view.workspace",
      ]) {
        if (options.keys !== false && (!options.readOnlyPermissions || !key.includes(".update.")))
          await tx`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${R},${key},${options.deny ? "deny" : "grant"})`;
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
const rpc = (tx: postgres.TransactionSql, action: string, data: Record<string, string | number | null> = {}) =>
  tx`select contract_attachment_manage(${IDs[0]},${action},${tx.json(data)}::jsonb) result`;
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
    await rpc(tx, "finish", { id: file.id });
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
      await rpc(tx, "finish", { id: file.id });
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
