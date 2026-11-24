import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

const mockClientRef: { current: SupabaseClient | null } = { current: null };

vi.mock("../supabase", () => ({
  supabaseForUser: () => {
    if (!mockClientRef.current) throw new Error("mockClientRef not configured");
    return mockClientRef.current;
  },
  unauthenticated: () => ({
    content: [{ type: "text" as const, text: "Não autenticado. Conecte-se novamente ao TechERP." }],
    isError: true as const,
  }),
}));

import listDealsTool from "./list-deals";

const makeCtx = (userId: string | null) =>
  ({
    isAuthenticated: () => Boolean(userId),
    getUserId: () => userId,
    getUserEmail: () => (userId ? "user@wk.test" : null),
    getToken: () => (userId ? "oauth-token" : null),
  }) as unknown as ToolContext;

describe("MCP list_deals handler boundary", () => {
  it("routes reads through protectSalesClient -> shared_fields_deals after work_access_context and sales_area_authorize", async () => {
    const calls: { from: string[]; select: string[]; ops: Array<[string, unknown[]]> } = {
      from: [],
      select: [],
      ops: [],
    };
    const rpcCalls: Array<{ name: string; args: unknown }> = [];
    const rows = [
      {
        id: "d1",
        name: "Negócio WK",
        value: null,
        currency: "BRL",
        stage: "proposal",
        expected_close_date: "2026-12-20",
        company_id: "c1",
        primary_contact_id: "ct1",
        updated_at: "2026-11-24T12:00:00Z",
      },
    ];
    const builder = {
      select: (...args: unknown[]) => {
        calls.select.push(String(args[0]));
        calls.ops.push(["select", args]);
        return builder;
      },
      eq: (...args: unknown[]) => (calls.ops.push(["eq", args]), builder),
      is: (...args: unknown[]) => (calls.ops.push(["is", args]), builder),
      order: (...args: unknown[]) => (calls.ops.push(["order", args]), builder),
      limit: (...args: unknown[]) => (calls.ops.push(["limit", args]), builder),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    mockClientRef.current = {
      from: (table: string) => (calls.from.push(table), builder),
      rpc: async (name: string, args: unknown) => {
        rpcCalls.push({ name, args });
        if (name === "work_access_context")
          return { data: { workspace: "w1", actor: "u1" }, error: null };
        if (name === "sales_area_authorize") return { data: true, error: null };
        return { data: null, error: null };
      },
    } as unknown as SupabaseClient;

    const companyId = "11111111-1111-4111-8111-111111111111";
    const res = await listDealsTool.handler(
      { stage: "proposal", company_id: companyId, limit: 25 },
      makeCtx("u1"),
    );
    expect(res.isError).toBeFalsy();
    expect(rpcCalls).toEqual([
      { name: "work_access_context", args: {} },
      { name: "sales_area_authorize", args: { r: "techsales.deals", a: "view", t: null, i: null } },
    ]);
    expect(calls.from).toEqual(["shared_fields_deals"]);
    expect(calls.select).toEqual([
      "id,name,value,currency,stage,expected_close_date,company_id,primary_contact_id,updated_at",
    ]);
    expect(calls.ops).toContainEqual(["eq", ["workspace_id", "w1"]]);
    expect(calls.ops).toContainEqual(["is", ["deleted_at", null]]);
    expect(calls.ops).toContainEqual(["order", ["updated_at", { ascending: false }]]);
    expect(calls.ops).toContainEqual(["limit", [25]]);
    expect(calls.ops).toContainEqual(["eq", ["stage", "proposal"]]);
    expect(calls.ops).toContainEqual(["eq", ["company_id", companyId]]);
    expect((res.structuredContent as { deals: unknown[] }).deals).toEqual(rows);
  });

  it("fails closed without querying deals when sales_area_authorize or active workspace fails", async () => {
    const fromSpy = vi.fn();
    mockClientRef.current = {
      from: fromSpy,
      rpc: async (name: string) =>
        name === "work_access_context"
          ? { data: { workspace: "w1", actor: "u1" }, error: null }
          : { data: null, error: { message: "Sem permissão para esta ação comercial." } },
    } as unknown as SupabaseClient;

    const res = await listDealsTool.handler(
      { stage: undefined, company_id: undefined, limit: 10 },
      makeCtx("u1"),
    );
    expect(res.isError).toBe(true);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

// Real isolated PostgreSQL/RLS/view/masking tests using production SQL functions and views.
// Never touches DATABASE_URL or production rows; every test runs in BEGIN ... ROLLBACK.
const ID = {
  W_WK: "184b9435-0a9b-4334-9e89-8854dc883f5d",
  W_OTHER: "284b9435-0a9b-4334-9e89-8854dc883f5d",
  U_ALLOWED: "10000000-0000-4000-8000-000000000011",
  U_TEAM_MGR: "10000000-0000-4000-8000-000000000012",
  U_TEAM_REP: "10000000-0000-4000-8000-000000000013",
  U_OWN: "10000000-0000-4000-8000-000000000014",
  U_NO_KEY: "10000000-0000-4000-8000-000000000015",
  U_DENY: "10000000-0000-4000-8000-000000000016",
  U_FOREIGN: "10000000-0000-4000-8000-000000000017",
  U_INACTIVE: "10000000-0000-4000-8000-000000000018",
  U_MASKED: "10000000-0000-4000-8000-000000000019",
  U_HIDDEN: "10000000-0000-4000-8000-000000000020",
  R_WS: "30000000-0000-4000-8000-000000000011",
  R_TEAM: "30000000-0000-4000-8000-000000000012",
  R_OWN: "30000000-0000-4000-8000-000000000013",
  R_DENY: "30000000-0000-4000-8000-000000000014",
  R_MASKED: "30000000-0000-4000-8000-000000000015",
  R_HIDDEN: "30000000-0000-4000-8000-000000000016",
  S_WS: "40000000-0000-4000-8000-000000000011",
  S_TEAM: "40000000-0000-4000-8000-000000000012",
  S_OWN: "40000000-0000-4000-8000-000000000013",
  C_ALPHA: "50000000-0000-4000-8000-000000000001",
  C_BETA: "50000000-0000-4000-8000-000000000002",
  D_OWN: "60000000-0000-4000-8000-000000000001",
  D_TEAM: "60000000-0000-4000-8000-000000000002",
  D_OTHER_REP: "60000000-0000-4000-8000-000000000003",
  D_DELETED: "60000000-0000-4000-8000-000000000004",
  D_FOREIGN: "60000000-0000-4000-8000-000000000005",
  GRP: "70000000-0000-4000-8000-000000000001",
} as const;

let db: ReturnType<typeof postgres>;
let cleanup: () => void = () => {};

function sourceFunction(file: string, name: string) {
  const src = readFileSync(file, "utf8");
  const start = src.indexOf(
    `CREATE OR REPLACE FUNCTION ${name.includes(".") ? name : `public.${name}`}(`,
  );
  if (start < 0) throw Error(`Missing production function: ${name} in ${file}`);
  const tail = src.slice(start);
  const open = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  const end = open ? tail.indexOf(open[1], open.index + open[0].length) : -1;
  if (!open || end < 0) throw Error(`Incomplete SQL function: ${name}`);
  return `${tail.slice(0, end + open[1].length)};`;
}

async function startDisposablePostgres(): Promise<ReturnType<typeof postgres>> {
  let initdbPath = "";
  try {
    initdbPath = execFileSync("bash", ["-c", "readlink -f $(command -v initdb)"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
  } catch {
    initdbPath = "";
  }
  if (initdbPath && existsSync(initdbPath)) {
    const bin = join(initdbPath, "..");
    const dir = mkdtempSync(join(tmpdir(), "techerp-list-deals-pg-"));
    const data = join(dir, "data");
    const sock = join(dir, "sock");
    const log = join(dir, "pg.log");
    const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
    const runPg = (cmd: string, args: string[]) =>
      isRoot
        ? execFileSync("runuser", ["-u", "nobody", "--", join(bin, cmd), ...args], {
            encoding: "utf8",
            timeout: 30000,
          })
        : execFileSync(join(bin, cmd), args, { encoding: "utf8", timeout: 30000 });
    mkdirSync(data);
    mkdirSync(sock);
    writeFileSync(log, "");
    chmodSync(dir, 0o755);
    if (isRoot) execFileSync("chown", ["-R", "nobody", data, sock, log]);
    const port = 55400 + Math.floor(Math.random() * 500);
    runPg("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-sync"]);
    runPg("pg_ctl", [
      "-D",
      data,
      "-l",
      log,
      "-w",
      "-o",
      `-p ${port} -k ${sock} -c listen_addresses='' -c fsync=off`,
      "start",
    ]);
    cleanup = () => {
      try {
        runPg("pg_ctl", ["-D", data, "-m", "immediate", "stop"]);
      } catch {
        /* ignore */
      }
      rmSync(dir, { recursive: true, force: true });
    };
    return postgres({
      host: sock,
      port,
      database: "postgres",
      username: "postgres",
      max: 1,
      connect_timeout: 5,
      onnotice: () => {},
    });
  }
  const docker =
    process.platform === "darwin"
      ? "/Applications/Docker.app/Contents/Resources/bin/docker"
      : "docker";
  const host = execFileSync(
    docker,
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8", timeout: 10000 },
  ).trim();
  if (!host.startsWith("unix://")) throw new Error("Only a local Unix Docker socket is allowed.");
  const name = `techerp-list-deals-ci-${randomUUID()}`;
  const dir = mkdtempSync(join(tmpdir(), "techerp-list-deals-ci-"));
  const pw = randomUUID() + randomUUID();
  const envFile = join(dir, "postgres.env");
  writeFileSync(envFile, `POSTGRES_DB=techerp_list_deals\nPOSTGRES_PASSWORD=${pw}\n`, {
    mode: 0o600,
  });
  execFileSync(
    docker,
    [
      "--host",
      host,
      "run",
      "-d",
      "--rm",
      "--name",
      name,
      "--env-file",
      envFile,
      "-p",
      "127.0.0.1::5432",
      "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b",
      "-c",
      "fsync=off",
    ],
    { encoding: "utf8", timeout: 90000 },
  );
  cleanup = () => {
    try {
      execFileSync(docker, ["--host", host, "rm", "-f", name], { timeout: 15000 });
    } catch {
      /* ignore */
    }
    rmSync(dir, { recursive: true, force: true });
  };
  const port = Number(
    execFileSync(docker, ["--host", host, "port", name, "5432/tcp"], {
      encoding: "utf8",
      timeout: 10000,
    })
      .trim()
      .split(":")[1],
  );
  const client = postgres({
    host: "127.0.0.1",
    port,
    database: "techerp_list_deals",
    username: "postgres",
    password: pw,
    max: 1,
    connect_timeout: 2,
    onnotice: () => {},
  });
  for (let i = 0; i < 80; i++) {
    try {
      await client`SELECT 1`;
      return client;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("Disposable PostgreSQL did not become ready");
}

async function asUser<T>(
  userId: string,
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>,
): Promise<T> {
  let out!: T;
  let caught: unknown = null;
  const rollback = Symbol("rollback");
  try {
    await db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
      try {
        out = await fn(tx as unknown as ReturnType<typeof postgres>);
      } catch (err) {
        caught = err;
      }
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
  if (caught) throw caught;
  return out;
}

describe("MCP list_deals real PostgreSQL/RLS/masking in isolated DB with rollback", () => {
  beforeAll(async () => {
    db = await startDisposablePostgres();
    await db.unsafe(readFileSync("tests/fixtures/permission-postgres-ci.sql", "utf8"));
    await db.unsafe(`
      CREATE ROLE techerp_shared_fields NOLOGIN NOSUPERUSER NOBYPASSRLS;
      GRANT authenticated TO techerp_shared_fields;
      GRANT USAGE ON SCHEMA public TO techerp_shared_fields;
      CREATE FUNCTION public.hiring_restricted_roles(_u uuid, _w uuid) RETURNS TABLE(role_id uuid) LANGUAGE sql STABLE AS $$ SELECT NULL::uuid WHERE false $$;
    `);
    const prodFns: Array<[string, string]> = [
      ["drizzle/migrations/0031_workspace_members_status_inactive.sql", "is_workspace_member"],
      ["drizzle/migrations/0127_rbac_wk_vis_local_per_role.sql", "user_effective_permissions"],
      [
        "drizzle/migrations/0120_activities_team_scope_active_membership.sql",
        "my_team_member_pairs",
      ],
      ["drizzle/migrations/0046_view_as_role_only_readonly.sql", "is_read_only_view"],
      ["drizzle/migrations/0216_work_core_prepare.sql", "work_access_context"],
      ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_access_context"],
      ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_context_access"],
      ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_record_context_access"],
      ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_record_access"],
      ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_area_authorize"],
      ["drizzle/migrations/0228_order5_fields_prepare.sql", "shared_field_context"],
    ];
    for (const [file, name] of prodFns) await db.unsafe(sourceFunction(file, name));
    await db.unsafe(`
      ALTER TABLE deals ADD COLUMN name text, ADD COLUMN value numeric, ADD COLUMN currency text DEFAULT 'BRL',
        ADD COLUMN stage text, ADD COLUMN company_id uuid, ADD COLUMN primary_contact_id uuid,
        ADD COLUMN expected_close_date date, ADD COLUMN notes text, ADD COLUMN created_at timestamptz DEFAULT now(),
        ADD COLUMN updated_at timestamptz DEFAULT now(), ADD COLUMN pipeline_id uuid, ADD COLUMN external_ids jsonb,
        ADD COLUMN stage_id text, ADD COLUMN hs_raw jsonb, ADD COLUMN description text, ADD COLUMN dealtype text,
        ADD COLUMN hs_priority text, ADD COLUMN hs_deal_stage_probability numeric, ADD COLUMN hubspot_owner_id text,
        ADD COLUMN hs_object_id text, ADD COLUMN hs_createdate timestamptz, ADD COLUMN hs_lastmodifieddate timestamptz,
        ADD COLUMN closed_lost_reason text, ADD COLUMN closed_won_reason text, ADD COLUMN num_associated_contacts integer,
        ADD COLUMN custom_fields jsonb, ADD COLUMN deleted_at timestamptz, ADD COLUMN assigned_user_id uuid,
        ADD COLUMN closed_at timestamptz, ADD COLUMN lost_at timestamptz, ADD COLUMN stage_substatus_id uuid,
        ADD COLUMN lead_id uuid, ADD COLUMN source text, ADD COLUMN service_line text;
      INSERT INTO shared_field_catalog VALUES ('techsales.deals','deals','value',true,ARRAY['value']), ('techsales.deals','deals','hs_raw',false,ARRAY['value']);
      REVOKE ALL ON public.deals FROM PUBLIC, anon, authenticated;
      GRANT SELECT(id,owner_id,name,currency,stage,company_id,primary_contact_id,expected_close_date,notes,created_at,updated_at,pipeline_id,external_ids,stage_id,description,dealtype,hs_priority,hs_deal_stage_probability,hubspot_owner_id,hs_object_id,hs_createdate,hs_lastmodifieddate,closed_lost_reason,closed_won_reason,num_associated_contacts,custom_fields,workspace_id,deleted_at,assigned_user_id,assigned_to,closed_at,lost_at,stage_substatus_id,lead_id,source,service_line) ON public.deals TO authenticated;
      GRANT SELECT ON public.deals TO techerp_shared_fields;
      ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
      CREATE POLICY sales_view ON public.deals FOR SELECT TO authenticated
        USING (public.sales_context_access(public.sales_access_context(), workspace_id, 'techsales.deals', 'view', ARRAY[COALESCE(assigned_to, owner_id)]));
    `);
    const m0228 = readFileSync("drizzle/migrations/0228_order5_fields_prepare.sql", "utf8");
    const vStart = m0228.indexOf("CREATE VIEW public.shared_fields_deals ");
    const vEnd = m0228.indexOf("GRANT SELECT ON public.shared_fields_deals TO authenticated;");
    await db.unsafe(
      m0228.slice(
        vStart,
        vEnd + "GRANT SELECT ON public.shared_fields_deals TO authenticated;".length,
      ),
    );
    await db.unsafe(`
      INSERT INTO workspaces(id, created_by, status) VALUES ('${ID.W_WK}', '${ID.U_ALLOWED}', 'active'), ('${ID.W_OTHER}', '${ID.U_FOREIGN}', 'active');
      INSERT INTO permissions(key, module, resource, action, scope) VALUES ('techsales.deals.view.workspace','crm','techsales.deals','view','workspace'), ('techsales.deals.view.team','crm','techsales.deals','view','team'), ('techsales.deals.view.own','crm','techsales.deals','view','own');
      INSERT INTO permission_sets(id, workspace_id, module) VALUES ('${ID.S_WS}','${ID.W_WK}','crm'), ('${ID.S_TEAM}','${ID.W_WK}','crm'), ('${ID.S_OWN}','${ID.W_WK}','crm');
      INSERT INTO permission_set_items(set_id, permission_key) VALUES ('${ID.S_WS}','techsales.deals.view.workspace'), ('${ID.S_TEAM}','techsales.deals.view.team'), ('${ID.S_OWN}','techsales.deals.view.own');
      INSERT INTO job_roles(id, workspace_id, data_scope) VALUES ('${ID.R_WS}','${ID.W_WK}','workspace'), ('${ID.R_TEAM}','${ID.W_WK}','team'), ('${ID.R_OWN}','${ID.W_WK}','own'), ('${ID.R_DENY}','${ID.W_WK}','workspace'), ('${ID.R_MASKED}','${ID.W_WK}','workspace'), ('${ID.R_HIDDEN}','${ID.W_WK}','workspace');
      INSERT INTO job_role_sets(role_id, set_id) VALUES ('${ID.R_WS}','${ID.S_WS}'), ('${ID.R_TEAM}','${ID.S_TEAM}'), ('${ID.R_OWN}','${ID.S_OWN}'), ('${ID.R_DENY}','${ID.S_WS}'), ('${ID.R_MASKED}','${ID.S_WS}'), ('${ID.R_HIDDEN}','${ID.S_WS}');
      INSERT INTO job_role_permission_overrides(workspace_id, role_id, permission_key, effect, created_by) VALUES ('${ID.W_WK}','${ID.R_DENY}','techsales.deals.view.workspace','deny','${ID.U_ALLOWED}');
      INSERT INTO field_permission_rules(resource, field, mode, workspace_id, role_id, set_id) VALUES ('techsales.deals','value','masked','${ID.W_WK}','${ID.R_MASKED}',NULL), ('techsales.deals','value','hidden','${ID.W_WK}','${ID.R_HIDDEN}',NULL);
      INSERT INTO profiles(id, active_workspace_id) VALUES ('${ID.U_ALLOWED}','${ID.W_WK}'), ('${ID.U_TEAM_MGR}','${ID.W_WK}'), ('${ID.U_TEAM_REP}','${ID.W_WK}'), ('${ID.U_OWN}','${ID.W_WK}'), ('${ID.U_NO_KEY}','${ID.W_WK}'), ('${ID.U_DENY}','${ID.W_WK}'), ('${ID.U_FOREIGN}','${ID.W_OTHER}'), ('${ID.U_INACTIVE}','${ID.W_WK}'), ('${ID.U_MASKED}','${ID.W_WK}'), ('${ID.U_HIDDEN}','${ID.W_WK}');
      INSERT INTO workspace_members(workspace_id, user_id, role, status) VALUES ('${ID.W_WK}','${ID.U_ALLOWED}','member','active'), ('${ID.W_WK}','${ID.U_TEAM_MGR}','member','active'), ('${ID.W_WK}','${ID.U_TEAM_REP}','member','active'), ('${ID.W_WK}','${ID.U_OWN}','member','active'), ('${ID.W_WK}','${ID.U_NO_KEY}','member','active'), ('${ID.W_WK}','${ID.U_DENY}','member','active'), ('${ID.W_OTHER}','${ID.U_FOREIGN}','admin','active'), ('${ID.W_WK}','${ID.U_INACTIVE}','admin','inactive'), ('${ID.W_WK}','${ID.U_MASKED}','member','active'), ('${ID.W_WK}','${ID.U_HIDDEN}','member','active');
      INSERT INTO user_job_roles(role_id, user_id, workspace_id, owner_id) VALUES ('${ID.R_WS}','${ID.U_ALLOWED}','${ID.W_WK}','${ID.U_ALLOWED}'), ('${ID.R_TEAM}','${ID.U_TEAM_MGR}','${ID.W_WK}','${ID.U_TEAM_MGR}'), ('${ID.R_OWN}','${ID.U_OWN}','${ID.W_WK}','${ID.U_OWN}'), ('${ID.R_DENY}','${ID.U_DENY}','${ID.W_WK}','${ID.U_DENY}'), ('${ID.R_MASKED}','${ID.U_MASKED}','${ID.W_WK}','${ID.U_MASKED}'), ('${ID.R_HIDDEN}','${ID.U_HIDDEN}','${ID.W_WK}','${ID.U_HIDDEN}');
      INSERT INTO user_groups(id, workspace_id) VALUES ('${ID.GRP}', '${ID.W_WK}');
      INSERT INTO user_group_members(group_id, user_id) VALUES ('${ID.GRP}','${ID.U_TEAM_MGR}'), ('${ID.GRP}','${ID.U_TEAM_REP}');
      INSERT INTO deals(id, workspace_id, owner_id, assigned_to, name, value, currency, stage, company_id, updated_at, deleted_at, hs_raw) VALUES
        ('${ID.D_OWN}','${ID.W_WK}','${ID.U_OWN}','${ID.U_OWN}','Negócio Próprio',15000,'BRL','proposal','${ID.C_ALPHA}','2026-11-24T15:00:00Z',NULL,'{"secret":1}'),
        ('${ID.D_TEAM}','${ID.W_WK}','${ID.U_TEAM_REP}','${ID.U_TEAM_REP}','Negócio Equipe',25000,'BRL','negotiation','${ID.C_BETA}','2026-11-24T16:00:00Z',NULL,'{"secret":2}'),
        ('${ID.D_OTHER_REP}','${ID.W_WK}','${ID.U_ALLOWED}','${ID.U_ALLOWED}','Negócio Workspace',40000,'BRL','proposal','${ID.C_ALPHA}','2026-11-24T17:00:00Z',NULL,'{"secret":3}'),
        ('${ID.D_DELETED}','${ID.W_WK}','${ID.U_ALLOWED}','${ID.U_ALLOWED}','Negócio Excluído',99000,'BRL','proposal','${ID.C_ALPHA}','2026-11-24T18:00:00Z','2026-11-24T18:05:00Z','{"secret":4}'),
        ('${ID.D_FOREIGN}','${ID.W_OTHER}','${ID.U_FOREIGN}','${ID.U_FOREIGN}','Negócio Outro Tenant',77000,'BRL','proposal','${ID.C_ALPHA}','2026-11-24T19:00:00Z',NULL,'{"secret":5}');
    `);
  }, 90000);

  afterAll(async () => {
    if (db) await db.end({ timeout: 2 }).catch(() => {});
    cleanup();
  });

  const querySharedDeals = (
    tx: ReturnType<typeof postgres>,
    workspaceId: string,
    opts?: { stage?: string; companyId?: string; limit?: number },
  ) => tx`
    SELECT id, name, value, currency, stage, expected_close_date, company_id, primary_contact_id, updated_at, hs_raw
    FROM public.shared_fields_deals
    WHERE workspace_id = ${workspaceId}::uuid AND deleted_at IS NULL
      AND (${opts?.stage ?? null}::text IS NULL OR stage = ${opts?.stage ?? null}::text)
      AND (${opts?.companyId ?? null}::uuid IS NULL OR company_id = ${opts?.companyId ?? null}::uuid)
    ORDER BY updated_at DESC LIMIT ${opts?.limit ?? 50}
  `;

  const authView = (tx: ReturnType<typeof postgres>) =>
    tx`SELECT public.sales_area_authorize('techsales.deals', 'view', NULL, NULL)`;

  it("direct SELECT including value on public.deals remains denied by column ACL (migration 0230)", async () => {
    await expect(
      asUser(ID.U_ALLOWED, (tx) => tx`SELECT id, value FROM public.deals`),
    ).rejects.toThrow(/permission denied for table deals/i);
  });

  it("mcp list_deals SQL allows authorized active member across workspace, team and own scopes", async () => {
    const wsRows = await asUser(
      ID.U_ALLOWED,
      async (tx) => (await authView(tx), querySharedDeals(tx, ID.W_WK)),
    );
    expect(wsRows.map((r) => r.id)).toEqual([ID.D_OTHER_REP, ID.D_TEAM, ID.D_OWN]);
    expect(Number(wsRows[0]?.value)).toBe(40000);
    const filtered = await asUser(ID.U_ALLOWED, (tx) =>
      querySharedDeals(tx, ID.W_WK, { stage: "proposal", companyId: ID.C_ALPHA, limit: 1 }),
    );
    expect(filtered.map((r) => r.id)).toEqual([ID.D_OTHER_REP]);
    const teamRows = await asUser(
      ID.U_TEAM_MGR,
      async (tx) => (await authView(tx), querySharedDeals(tx, ID.W_WK)),
    );
    expect(teamRows.map((r) => r.id)).toEqual([ID.D_TEAM]);
    const ownRows = await asUser(
      ID.U_OWN,
      async (tx) => (await authView(tx), querySharedDeals(tx, ID.W_WK)),
    );
    expect(ownRows.map((r) => r.id)).toEqual([ID.D_OWN]);
    expect(Number(ownRows[0]?.value)).toBe(15000);
  });

  it("mcp list_deals SQL rejects missing permission", async () => {
    await expect(asUser(ID.U_NO_KEY, authView)).rejects.toThrow(/Sem permissão/i);
    expect(await asUser(ID.U_NO_KEY, (tx) => querySharedDeals(tx, ID.W_WK))).toEqual([]);
  });

  it("mcp list_deals SQL respects explicit deny override", async () => {
    await expect(asUser(ID.U_DENY, authView)).rejects.toThrow(/Sem permissão/i);
    expect(await asUser(ID.U_DENY, (tx) => querySharedDeals(tx, ID.W_WK))).toEqual([]);
  });

  it("mcp list_deals SQL isolates foreign workspace", async () => {
    const res = await asUser(ID.U_FOREIGN, async (tx) => ({
      ws: (
        (await tx`SELECT public.work_access_context()`)[0]?.work_access_context as {
          workspace?: string;
        }
      )?.workspace,
      wkRows: await querySharedDeals(tx, ID.W_WK),
      ownWsRows: await querySharedDeals(tx, ID.W_OTHER),
    }));
    expect(res.ws).toBe(ID.W_OTHER);
    expect(res.wkRows).toEqual([]);
    expect(res.ownWsRows.map((r) => r.id)).toEqual([ID.D_FOREIGN]);
  });

  it("mcp list_deals SQL rejects inactive workspace member", async () => {
    const ws = await asUser(
      ID.U_INACTIVE,
      async (tx) =>
        (
          (await tx`SELECT public.work_access_context()`)[0]?.work_access_context as {
            workspace?: string;
          }
        )?.workspace,
    );
    expect(ws).toBeUndefined();
    await expect(asUser(ID.U_INACTIVE, authView)).rejects.toThrow(/Sem permissão/i);
    expect(await asUser(ID.U_INACTIVE, (tx) => querySharedDeals(tx, ID.W_WK))).toEqual([]);
  });

  it("mcp list_deals SQL masks deal value to NULL when field_permission_rules marks it masked or hidden", async () => {
    const masked = await asUser(
      ID.U_MASKED,
      async (tx) => (await authView(tx), querySharedDeals(tx, ID.W_WK)),
    );
    expect(masked.map((r) => r.id)).toEqual([ID.D_OTHER_REP, ID.D_TEAM, ID.D_OWN]);
    expect(masked.every((r) => r.value === null && r.hs_raw === null)).toBe(true);
    const hidden = await asUser(
      ID.U_HIDDEN,
      async (tx) => (await authView(tx), querySharedDeals(tx, ID.W_WK)),
    );
    expect(hidden.map((r) => r.id)).toEqual([ID.D_OTHER_REP, ID.D_TEAM, ID.D_OWN]);
    expect(hidden.every((r) => r.value === null && r.hs_raw === null)).toBe(true);
  });
});
