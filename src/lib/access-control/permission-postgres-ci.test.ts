import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const container = "techerp-permission-ci-" + randomUUID();
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
const tables = [
  "macros",
  "subscription_types",
  "api_keys",
  "recurring_plans",
  "subscriptions",
  "subscription_invoices",
  "people_documents",
];
let endpoint = "",
  temporary = "",
  started = false;
let db: ReturnType<typeof postgres>;
const accepted: string[] = [];
const expected = 30;
let cleaned = false;
function report() {
  mkdirSync(".verification", { recursive: true });
  writeFileSync(
    ".verification/sql-rls.json",
    JSON.stringify(
      {
        complete: cleaned && accepted.length === expected,
        expected,
        engine: "PostgreSQL",
        authentication: "SQL claims fixture; not GoTrue",
        production_functions: true,
        scenarios: accepted,
        passed: accepted.length,
        production_connections: 0,
        cleaned,
      },
      null,
      2,
    ),
  );
}
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
  report();
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
  const catalog = JSON.parse(
    readFileSync("docs/security/permission-key-catalog.json", "utf8"),
  ).keys;
  await db`insert into permissions(key) select jsonb_array_elements_text(${db.json(catalog)})`;
  await db`insert into workspaces(id,created_by) values(${W},${O}),(${B},${O})`;
  await db`insert into profiles(id,active_workspace_id) values(${U},${W})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${W},${U}),(${B},${U}),(${W},${P})`;
  await db`insert into user_groups(id,workspace_id) values(${R},${W})`;
  await db`insert into user_group_members(group_id,user_id) values(${R},${U}),(${R},${P})`;
  await db`insert into job_roles(id,workspace_id) values(${R},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${R},${U},${W},${W})`;
  for (let i = 0; i < 3; i++) {
    const w = i === 2 ? B : W,
      owner = i === 0 ? U : P,
      id = IDs[i];
    for (const t of ["macros", "subscription_types", "recurring_plans"])
      await db.unsafe(
        `insert into ${t}(id,workspace_id,owner_id,name) values($1,$2,$3,'CI fixture')`,
        [id, w, owner],
      );
    await db`insert into api_keys(id,workspace_id,owner_id,name,key_hash) values(${id},${w},${owner},'CI fixture','not-a-credential')`;
    await db`insert into people(id,workspace_id,owner_id,assigned_to,profile_id) values(${id},${w},${owner},${owner},${owner})`;
    await db`insert into people_documents(id,workspace_id,person_id,created_by,status) values(${id},${w},${id},${owner},'expiring')`;
    await db`insert into subscriptions(id,workspace_id,owner_id,name) values(${id},${w},${owner},'CI fixture')`;
    await db`insert into subscription_invoices(id,workspace_id,owner_id,subscription_id) values(${id},${w},${owner},${id})`;
  }
  for (let i = 0; i < 3; i++) {
    const w = i === 2 ? B : W,
      owner = i === 0 ? U : P,
      id = IDs[i];
    await db`insert into leads(id,workspace_id,owner_id,assigned_to) values(${id},${w},${owner},${owner})`;
    await db`insert into audit_exports(id,owner_id,workspace_id,name,destination,hmac_secret) values(${id},${owner},${w},'CI export','webhook','not-a-secret-fixture')`;
    const payload = {
      workspace_id: w,
      owner_id: owner,
      score: 42,
      portal_token: "not-a-secret-fixture",
    };
    await db`insert into audit_logs(id,workspace_owner_id,actor_user_id,entity,entity_id,action,before,after,metadata) values(${id},${owner},${owner},'leads',${id},'updated',${db.json(payload)},${db.json(payload)},'{"private":"fixture"}')`;
  }
  const functions: [string, string][] = [
    ["0031_workspace_members_status_inactive", "is_workspace_member"],
    ["0031_workspace_members_status_inactive", "current_user_workspaces"],
    ["0127_rbac_wk_vis_local_per_role", "user_effective_permissions"],
    ["0120_activities_team_scope_active_membership", "my_team_member_pairs"],
    ["0046_view_as_role_only_readonly", "is_read_only_view"],
    ["0216_work_core_prepare", "work_access_context"],
    ["0193_hr_action_scope_alignment", "hr_team_contains"],
    ["0201_pipeline_action_scope", "hr_scope_permission"],
    ["0193_hr_action_scope_alignment", "hr_people_access"],
    ["0195_people_resource_actions", "hr_person_resource_access"],
    ["0222_order4_sales_prepare", "sales_access_context"],
    ["0222_order4_sales_prepare", "sales_context_access"],
    ["0222_order4_sales_prepare", "sales_record_context_access"],
    ["0222_order4_sales_prepare", "sales_record_access"],
    ["0228_order5_fields_prepare", "shared_field_context"],
    ["0228_order5_fields_prepare", "shared_field_mode_for"],
    ["0228_order5_fields_prepare", "shared_field_mask_row"],
    ["0179_techprojects_cycle6_api_offline_ops", "techerp_api.leave"],
  ];
  // The immutable original wrapper delegates to the actual current resolver.
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0127_rbac_wk_vis_local_per_role.sql",
      "user_effective_permissions",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "supabase/migrations/20260702201807_dbc392d9-6c74-4c4e-a34f-e3949206f95f.sql",
      "user_has_permission",
    ),
  );
  for (const [file, name] of functions)
    await db.unsafe(sourceFunction("drizzle/migrations/" + file + ".sql", name));
  await db.unsafe(
    "ALTER TABLE people ENABLE ROW LEVEL SECURITY;CREATE POLICY people_read ON people FOR SELECT TO authenticated USING(hr_people_access(workspace_id,'view',profile_id,manager_id,coalesce(assigned_to,created_by,owner_id)));ALTER TABLE people_documents ENABLE ROW LEVEL SECURITY;CREATE POLICY hr_child_view ON people_documents FOR SELECT TO authenticated USING(hr_person_resource_access(workspace_id,person_id,'techpeople.documents','view',created_by,assigned_to));",
  );
  for (const migration of [
    "0239_shared_configuration_permissions",
    "0240_recurring_authorization",
    "0242_document_read_policy",
    "0243_api_key_matrix",
    "0244_api_subject_credential_read",
    "0245_audit_read_boundary",
    "0246_audit_index_service_expression",
    "0247_audit_export_authorization",
  ])
    await db.unsafe(readFileSync("drizzle/migrations/" + migration + ".sql", "utf8"));
}, 180000);
afterAll(async () => {
  try {
    try {
      if (db) await db.end({ timeout: 2 });
    } finally {
      try {
        if (started) dockerRun("rm", "-f", container);
      } finally {
        if (temporary) rmSync(temporary, { recursive: true, force: true });
      }
    }
    cleaned = true;
  } finally {
    report();
  }
}, 30000);
const grants = [
  ...new Set(
    tables.flatMap((t) => {
      const r =
        t === "macros"
          ? "system.automation.macros"
          : t === "subscription_types"
            ? "system.communication.subscription_types"
            : t === "api_keys"
              ? "system.api_keys"
              : t === "subscription_invoices"
                ? "techfinance.invoices"
                : t === "people_documents"
                  ? "techpeople.documents"
                  : "techfinance.recurrences";
      return (
        t === "api_keys"
          ? ["view", "create", "manage", "delete"]
          : ["view", "create", "update", "delete"]
      ).map((a) => r + "." + a + "." + (t === "api_keys" ? "own" : "workspace"));
    }),
  ),
  "techpeople.people.view.workspace",
];
async function subject(
  fn: (tx: postgres.TransactionSql) => Promise<void>,
  options: {
    keys?: string[];
    denies?: string[];
    workspace?: string;
    inactive?: boolean;
    readonly?: boolean;
    apiSubject?: boolean;
    service?: boolean;
    hiddenScore?: boolean;
    boundKey?: string;
  } = {},
) {
  const rollback = new Error("CI rollback");
  try {
    await db.begin(async (tx) => {
      await tx`update profiles set active_workspace_id=${options.workspace ?? W} where id=${U}`;
      if (options.inactive)
        await tx`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
      for (const key of options.keys ?? grants)
        await tx`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${R},${key},'grant')`;
      for (const key of options.denies ?? [])
        await tx`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${R},${key},'deny') on conflict(workspace_id,role_id,permission_key) do update set effect='deny'`;
      if (options.hiddenScore)
        await tx`insert into field_permission_rules(resource,field,mode,workspace_id,role_id) values('techsales.leads','score','hidden',${W},${R})`;
      const session = randomUUID();
      if (options.readonly)
        await tx`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: options.service ? "service_role" : "authenticated", session_id: session })},true)`;
      if (options.boundKey)
        await tx`insert into techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id) values(txid_current(),${U},${W},${options.boundKey})`;
      await tx.unsafe(
        options.service
          ? "SET LOCAL ROLE service_role"
          : options.apiSubject
            ? "SET LOCAL ROLE techerp_api_subject"
            : "SET LOCAL ROLE authenticated",
      );
      expect((await tx`select current_user`)[0].current_user).toBe(
        options.service
          ? "service_role"
          : options.apiSubject
            ? "techerp_api_subject"
            : "authenticated",
      );
      await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function counts(tx: postgres.TransactionSql, expected: number) {
  for (const table of tables)
    expect(Number((await tx.unsafe(`select count(*) n from ${table}`))[0].n), table).toBe(
      table === "api_keys" && expected > 0 ? 1 : expected,
    );
}
it("SQL RLS allows authorized active workspace", async () => {
  await subject(async (tx) => {
    await counts(tx, 2);
    for (const table of ["macros", "subscription_types", "recurring_plans"])
      expect(
        (
          await tx.unsafe(`update ${table} set name='authorized' where id=$1 returning id`, [
            IDs[0],
          ])
        ).length,
      ).toBe(1);
    expect(
      (await tx`update api_keys set revoked_at=now() where id=${IDs[0]} returning id`).length,
    ).toBe(1);
  });
  accepted.push("allowed");
});
it("SQL RLS rejects missing permission", async () => {
  await subject(
    async (tx) => {
      await counts(tx, 0);
      expect(
        (await tx`update macros set name='forbidden' where id=${IDs[0]} returning id`).length,
      ).toBe(0);
    },
    { keys: [] },
  );
  accepted.push("missing_permission");
});
it("SQL RLS preserves explicit deny across macro aliases", async () => {
  await expect(
    subject(
      async (tx) => {
        await counts(tx, 0);
      },
      {
        keys: [...grants, "techservice.macros.view.workspace"],
        denies: grants.filter((k) => k.includes(".view.")),
      },
    ),
  ).resolves.toBeUndefined();
  accepted.push("explicit_deny");
});
it("SQL RLS rejects a foreign selected workspace", async () => {
  await expect(
    subject(
      async (tx) => {
        await counts(tx, 0);
      },
      { workspace: B },
    ),
  ).resolves.toBeUndefined();
  accepted.push("foreign_workspace");
});
it("SQL RLS rejects inactive membership", async () => {
  await expect(
    subject(
      async (tx) => {
        await counts(tx, 0);
      },
      { inactive: true },
    ),
  ).resolves.toBeUndefined();
  accepted.push("inactive_member");
});
it("SQL RLS own scope never turns into workspace visibility", async () => {
  await subject(
    async (tx) => {
      expect((await tx`select id from macros`).map((x) => x.id)).toEqual([IDs[0]]);
    },
    { keys: ["system.automation.macros.view.own"] },
  );
  accepted.push("own_scope");
});
it("SQL RLS keeps browser credential hashes inaccessible", async () => {
  await expect(
    subject(async (tx) => {
      await tx`select key_hash from api_keys`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
  accepted.push("credential_column");
});

it("SQL RLS team scope includes only authorized peers", async () => {
  await subject(
    async (tx) => {
      expect((await tx`select id from macros order by id`).map((x) => x.id)).toEqual(
        IDs.slice(0, 2),
      );
    },
    { keys: ["system.automation.macros.view.team"] },
  );
  accepted.push("team_scope");
});
it("SQL RLS readonly view permits reading but blocks mutations", async () => {
  await subject(
    async (tx) => {
      await counts(tx, 2);
      for (const table of ["macros", "subscription_types", "recurring_plans"])
        expect(
          (
            await tx.unsafe(`update ${table} set name='forbidden' where id=$1 returning id`, [
              IDs[0],
            ])
          ).length,
        ).toBe(0);
      expect(
        (await tx`update api_keys set revoked_at=now() where id=${IDs[0]} returning id`).length,
      ).toBe(0);
    },
    { readonly: true },
  );
  accepted.push("readonly");
});

it("SQL API subject uses only its transaction-bound existing key", async () => {
  await subject(
    async (tx) => {
      expect((await tx`select id from api_keys`).map((x) => x.id)).toEqual([IDs[0]]);
    },
    { keys: [], apiSubject: true, boundKey: IDs[0] },
  );
  accepted.push("api_subject_exact_key");
});
it("SQL API subject cannot read an unbound or foreign-owner key", async () => {
  for (const boundKey of [undefined, IDs[1], IDs[2]])
    await subject(
      async (tx) => {
        expect(await tx`select id from api_keys`).toHaveLength(0);
      },
      { keys: [], apiSubject: true, boundKey },
    );
  accepted.push("api_subject_invalid_binding");
});
it("SQL API subject respects inactive membership and browser cannot use its helper", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from api_keys`).toHaveLength(0);
    },
    { keys: [], apiSubject: true, boundKey: IDs[0], inactive: true },
  );
  await expect(
    subject(async (tx) => {
      await tx`select shared_api_subject_key_read(${IDs[0]},${W},${U})`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
  accepted.push("api_subject_inactive_browser_denied");
});

const auditKeys = ["system.audit.view.workspace", "techsales.leads.view.workspace"];
it("SQL audit allows authorized tenant and record", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from shared_audit_logs`).toHaveLength(2);
    },
    { keys: auditKeys },
  );
  accepted.push("audit_allowed");
});
it("SQL audit denies missing permission", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from shared_audit_logs`).toHaveLength(0);
    },
    { keys: ["techsales.leads.view.workspace"] },
  );
  accepted.push("audit_missing");
});
it("SQL audit denies explicit deny", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from shared_audit_logs`).toHaveLength(0);
    },
    { keys: auditKeys, denies: ["system.audit.view.workspace"] },
  );
  accepted.push("audit_deny");
});
it("SQL audit denies foreign selected workspace", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from shared_audit_logs`).toHaveLength(0);
    },
    { keys: auditKeys, workspace: B },
  );
  accepted.push("audit_foreign");
});
it("SQL audit denies inactive membership", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from shared_audit_logs`).toHaveLength(0);
    },
    { keys: auditKeys, inactive: true },
  );
  accepted.push("audit_inactive");
});
it("SQL audit respects own records and current assignment", async () => {
  await subject(
    async (tx) => {
      expect((await tx`select id from shared_audit_logs`).map((x) => x.id)).toEqual([IDs[0]]);
    },
    { keys: ["system.audit.view.workspace", "techsales.leads.view.own"] },
  );
  accepted.push("audit_own");
});
it("SQL audit hides fields and never emits credential or free-form metadata", async () => {
  await db.begin(async (tx) => {
    await tx`insert into field_permission_rules(resource,field,mode,workspace_id,role_id) values('techsales.leads','score','hidden',${W},${R})`;
    // subject runs on the single client; use a committed fixture and clean it below.
  });
  try {
    await subject(
      async (tx) => {
        const row = (await tx`select * from shared_audit_logs where id=${IDs[0]}`)[0];
        expect(row.before.score).toBeNull();
        expect(row.before).not.toHaveProperty("portal_token");
        expect(row.metadata).toEqual({});
      },
      { keys: auditKeys },
    );
  } finally {
    await db`delete from field_permission_rules`;
  }
  accepted.push("audit_fields");
});
it("SQL audit raw payload columns remain inaccessible", async () => {
  await expect(
    subject(
      async (tx) => {
        await tx`select before from audit_logs`;
      },
      { keys: auditKeys },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  accepted.push("audit_raw_acl");
});

const exportKeys = [
  ...auditKeys,
  "system.audit.export.workspace",
  ...["view", "create", "update", "delete", "manage"].map(
    (a) => "system.audit_exports." + a + ".workspace",
  ),
];
it("SQL export configuration allows authorized workspace", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from audit_exports`).toHaveLength(2);
      expect(
        await tx`update audit_exports set name='authorized' where id=${IDs[0]} returning id`,
      ).toHaveLength(1);
    },
    { keys: exportKeys },
  );
  accepted.push("export_allowed");
});
it("SQL export configuration denies missing permission", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from audit_exports`).toHaveLength(0);
    },
    { keys: [] },
  );
  accepted.push("export_missing");
});
it("SQL export configuration denies explicit deny", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from audit_exports`).toHaveLength(0);
    },
    { keys: exportKeys, denies: ["system.audit_exports.view.workspace"] },
  );
  accepted.push("export_deny");
});
it("SQL export configuration denies foreign workspace", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from audit_exports`).toHaveLength(0);
    },
    { keys: exportKeys, workspace: B },
  );
  accepted.push("export_foreign");
});
it("SQL export configuration denies inactive membership", async () => {
  await subject(
    async (tx) => {
      expect(await tx`select id from audit_exports`).toHaveLength(0);
    },
    { keys: exportKeys, inactive: true },
  );
  accepted.push("export_inactive");
});
it("SQL audit exporter rechecks owner record access and hidden fields", async () => {
  await subject(
    async (tx) => {
      const rows = (await tx`select shared_audit_export_rows(${IDs[0]},${W},'2000-01-01') data`)[0]
        .data.rows;
      expect(rows).toHaveLength(2);
      expect(rows[0].before.score).toBeNull();
      expect(rows[0].before).not.toHaveProperty("portal_token");
    },
    { keys: exportKeys, service: true, hiddenScore: true },
  );
  await subject(
    async (tx) => {
      expect(
        (await tx`select shared_audit_export_rows(${IDs[0]},${W},'2000-01-01') data`)[0].data.rows,
      ).toHaveLength(0);
    },
    { keys: exportKeys.filter((k) => k !== "techsales.leads.view.workspace"), service: true },
  );
  accepted.push("export_subject_fields");
});
it("SQL audit exporter rejects revoked execution authority", async () => {
  for (const key of ["system.audit.export.workspace", "system.audit_exports.manage.workspace"])
    await expect(
      subject(
        async (tx) => {
          await tx`select shared_audit_export_rows(${IDs[0]},${W},'2000-01-01')`;
        },
        { keys: exportKeys, denies: [key], service: true },
      ),
    ).rejects.toMatchObject({ code: "42501" });
  accepted.push("export_execution_revoked");
});
it("SQL audit exporter rejects foreign bindings and inactive owners", async () => {
  await expect(
    subject(
      async (tx) => {
        await tx`select shared_audit_export_rows(${IDs[0]},${B},'2000-01-01')`;
      },
      { keys: exportKeys, service: true },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    subject(
      async (tx) => {
        await tx`select shared_audit_export_rows(${IDs[0]},${W},'2000-01-01')`;
      },
      { keys: exportKeys, service: true, inactive: true },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  accepted.push("export_worker_binding");
});
it("SQL audit export secret and identities are protected", async () => {
  await expect(
    subject(
      async (tx) => {
        await tx`select hmac_secret from audit_exports`;
      },
      { keys: exportKeys },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    subject(
      async (tx) => {
        await tx`update audit_exports set owner_id=${P} where id=${IDs[0]}`;
      },
      { keys: exportKeys },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await subject(
    async (tx) => {
      expect(
        await tx`update audit_exports set name='forbidden' where id=${IDs[0]} returning id`,
      ).toHaveLength(0);
    },
    { keys: exportKeys, readonly: true },
  );
  await expect(
    subject(
      async (tx) => {
        await tx`select shared_audit_export_rows(${IDs[0]},${W},'2000-01-01')`;
      },
      { keys: exportKeys },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  accepted.push("export_secret_identity_readonly");
});

it("SQL audit export pagination preserves rows sharing a timestamp", async () => {
  await subject(
    async (tx) => {
      await tx`insert into audit_logs(id,workspace_owner_id,actor_user_id,entity,entity_id,action,before,after,created_at) select md5('audit-page-'||g)::uuid,${U},${U},'leads',${IDs[0]},'updated',jsonb_build_object('workspace_id',${W}::text,'owner_id',${U}::text),jsonb_build_object('workspace_id',${W}::text,'owner_id',${U}::text),'2001-01-01' from generate_series(1,501)g`;
      const first = (await tx`select shared_audit_export_rows(${IDs[0]},${W},'2000-01-01') data`)[0]
        .data;
      expect(first.rows).toHaveLength(500);
      expect(first.has_more).toBe(true);
      const second = (
        await tx`select shared_audit_export_rows(${IDs[0]},${W},${first.cursor_at},${first.cursor_id}::uuid) data`
      )[0].data;
      expect(second.rows).toHaveLength(3);
      expect(second.has_more).toBe(false);
      expect(new Set([...first.rows, ...second.rows].map((x) => x.id)).size).toBe(503);
    },
    { keys: exportKeys, service: true },
  );
  accepted.push("export_timestamp_pagination");
}, 30000);
