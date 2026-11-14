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
const container = "techerp-journey-ci-" + randomUUID();
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
  await db.unsafe(readFileSync("tests/fixtures/contract-proposal.sql", "utf8"));
  const policy = readFileSync("drizzle/migrations/0223_order4_sales_activate.sql", "utf8")
    .split("\n")
    .find((s) => s.startsWith('CREATE POLICY sales_view ON public."proposals"'));
  if (!policy) throw new Error("Production proposal RLS policy missing");
  await db.unsafe(policy);
  await db.unsafe(readFileSync("drizzle/migrations/0334_contract_accepted_proposal.sql", "utf8"));
  for (const file of [
    "0314_legal_entity_safe_lifecycle",
    "0315_legal_entity_guard_workspace_cascade",
    "0335_legal_entity_usage_permission",
  ])
    await db.unsafe(readFileSync("drizzle/migrations/" + file + ".sql", "utf8"));
  // Keep the direct-API permission scenarios on main's current aggregate implementation.
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0316_cnpj_operational_linkage_and_summary.sql",
      "_legal_entity_usage_counts",
    ),
  );
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0316_cnpj_operational_linkage_and_summary.sql",
      "record_legal_entity_guard",
    ),
  );
  await db.unsafe(`ALTER TABLE contracts ADD COLUMN contracting_legal_entity_id uuid;
    CREATE TRIGGER cnpj_active_contracting_legal_entity_id BEFORE INSERT OR UPDATE OF contracting_legal_entity_id,workspace_id ON contracts FOR EACH ROW EXECUTE FUNCTION record_legal_entity_guard('contracting_legal_entity_id')`);
  await db`insert into workspaces(id) values(${W}),(${B})`;
  await db`insert into legal_entities(id,workspace_id,created_by) values(${IDs[1]},${W},${U})`;
  await db`insert into financial_entries(id,legal_entity_id) values(${IDs[2]},${IDs[1]})`;
  await db`insert into profiles(id,active_workspace_id) values(${U},${W})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${W},${U})`;
  await db`insert into job_roles(id,workspace_id) values(${R},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${R},${U},${W},${U})`;
  await db`insert into proposals(id,workspace_id,owner_id,title,body,version,status,locked,total_amount,currency) values(${IDs[0]},${W},${U},'Hunting','Escopo aceito',3,'draft',false,100,'BRL')`;
  await db`insert into deal_line_items(id,workspace_id,deal_id,name,position) values(${IDs[1]},${W},${IDs[2]},'Desenvolvedor',1)`;
  await db`update proposals set deal_id=${IDs[2]},status='sent',locked=true,sent_at=now() where id=${IDs[0]}`;
  await db`update proposals set status='accepted',decided_at='2026-11-08T02:00:00Z' where id=${IDs[0]}`;
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
  await db.unsafe(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS name text;
 ALTER TABLE deals ADD COLUMN IF NOT EXISTS owner_id uuid,ADD COLUMN IF NOT EXISTS assigned_to uuid,ADD COLUMN IF NOT EXISTS pipeline_id uuid;
 ALTER TABLE deal_line_items ADD COLUMN created_at timestamptz DEFAULT now();
 ALTER TABLE contracts ADD COLUMN role text DEFAULT 'provider',ADD COLUMN document_kind text DEFAULT 'main',ADD COLUMN body_html text,ADD COLUMN starts_at date,ADD COLUMN ends_at date,ADD COLUMN number text,ADD COLUMN total_value numeric,ADD COLUMN currency text,ADD COLUMN payment_method text,ADD COLUMN payment_terms jsonb;
 CREATE TABLE contract_templates(id uuid PRIMARY KEY,workspace_id uuid,name text,body_html text,defaults jsonb DEFAULT '{}',service_type text,status text,is_default boolean DEFAULT false);
 CREATE TABLE contract_template_services(workspace_id uuid,template_id uuid,service_catalog_id uuid);
 CREATE TABLE pipeline_stage_substatuses(id uuid,workspace_id uuid,stage_value text,pipeline_id uuid,name text,is_active boolean,position integer);
 CREATE TABLE notifications(owner_id uuid,user_id uuid,workspace_id uuid,type text,title text,body text,link text,entity text,entity_id uuid,dedupe_key text UNIQUE);
 GRANT SELECT ON deals,contract_templates TO authenticated;`);
  // The final production implementation of this resolver uses the table-specific branch.
  const src = readFileSync("drizzle/migrations/0222_order4_sales_prepare.sql", "utf8");
  const marker = "CREATE OR REPLACE FUNCTION public.sales_record_access(";
  const start = src.lastIndexOf(marker),
    tail = src.slice(start),
    end = tail.indexOf("END $$;");
  await db.unsafe(tail.slice(0, end + 7));
  await db`insert into deals(id,workspace_id,owner_id) values(${IDs[2]},${W},${U})`;
  await db.unsafe(
    sourceFunction(
      "supabase/migrations/20260702201807_dbc392d9-6c74-4c4e-a34f-e3949206f95f.sql",
      "user_has_permission",
    ),
  );
  await db.unsafe(readFileSync("drizzle/migrations/0312_contract_draft_legal_review.sql", "utf8"));
  await db.unsafe(
    readFileSync("drizzle/migrations/0313_contract_draft_client_acceptance.sql", "utf8"),
  );
  await db`insert into contracts(id,workspace_id,owner_id,status,metadata) values('50000000-0000-4000-8000-000000000099',${W},${U},'draft',NULL)`;
  await db.unsafe(readFileSync("drizzle/migrations/0356_deal_contracting_journey.sql", "utf8"));
  await db`insert into contract_draft_approvers(workspace_id,user_id,created_by) values(${W},${U},${U})`;
}, 120000);
async function subject(
  fn: (tx: postgres.TransactionSql) => Promise<void>,
  options: { keys?: boolean; deny?: boolean; inactive?: boolean; workspace?: string } = {},
) {
  const rollback = new Error("rollback");
  try {
    await db.begin(async (tx) => {
      await tx`update profiles set active_workspace_id=${options.workspace ?? W} where id=${U}`;
      if (options.inactive)
        await tx`update workspace_members set status='inactive' where user_id=${U}`;
      for (const key of [
        "techsales.deals.view.workspace",
        "techsales.proposals.view.workspace",
        "techcontracts.contracts.view.workspace",
        "techcontracts.contracts.create.workspace",
        "techcontracts.contracts.update.workspace",
        "techcontracts.contract_drafts.view.workspace",
        "techcontracts.contract_drafts.create.workspace",
        "techcontracts.contract_drafts.approve.workspace",
      ]) {
        if (options.keys !== false)
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
async function prepare(tx: postgres.TransactionSql) {
  return (await tx`select deal_contract_draft_prepare(${IDs[0]}) v`)[0].v as {
    draft_id: string;
    created: boolean;
  };
}
async function accepted(
  tx: postgres.TransactionSql,
  terms: { starts_at: string; ends_at: string | null } | null = null,
) {
  const d = await prepare(tx);
  await tx`select contract_draft_review_prepared(${d.draft_id},1,'approve',NULL,'<p>Cláusulas ajustadas e aceitas pelo cliente. Não regenerar do modelo.</p>',NULL,${terms ? tx.json(terms) : null})`;
  const token = (await tx`select contract_draft_issue_link(${d.draft_id}) token`)[0].token;
  await tx`select contract_draft_mark_sent(${d.draft_id},NULL,'link')`;
  await tx.unsafe("SET LOCAL ROLE service_role");
  await tx`select contract_draft_public_decide(${token},'accept','Cliente de teste',NULL)`;
  await tx.unsafe("SET LOCAL ROLE authenticated");
  return d;
}
async function bind(tx: postgres.TransactionSql) {
  return tx`insert into contracts(id,workspace_id,owner_id,proposal_id,deal_id,status,body_html) values(${IDs[2]},${W},${U},${IDs[0]},${IDs[2]},'draft','Texto diferente do modelo') returning body_html,metadata`;
}
it("journey SQL allows an authorized active member", async () => {
  await subject(async (tx) => {
    const a = await prepare(tx),
      b = await prepare(tx);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.draft_id).toBe(a.draft_id);
  });
});
it("journey SQL rejects missing permission", async () => {
  await expect(
    subject(
      async (tx) => {
        await prepare(tx);
      },
      { keys: false },
    ),
  ).rejects.toThrow();
});
it("journey SQL rejects explicit deny", async () => {
  await expect(
    subject(
      async (tx) => {
        await prepare(tx);
      },
      { deny: true },
    ),
  ).rejects.toThrow();
});
it("journey SQL rejects a foreign workspace", async () => {
  await expect(
    subject(
      async (tx) => {
        await prepare(tx);
      },
      { workspace: B },
    ),
  ).rejects.toThrow();
});
it("journey SQL rejects inactive membership", async () => {
  await expect(
    subject(
      async (tx) => {
        await prepare(tx);
      },
      { inactive: true },
    ),
  ).rejects.toThrow();
});
it("journey SQL blocks a contract before client approval of clauses", async () => {
  await expect(
    subject(async (tx) => {
      await prepare(tx);
      await bind(tx);
    }),
  ).rejects.toThrow("aceite da minuta");
});
it("journey SQL preserves the exact accepted draft and provenance", async () => {
  await subject(async (tx) => {
    const d = await accepted(tx);
    const [c] = await bind(tx);
    expect(c.body_html).toContain("Cláusulas ajustadas");
    expect(c.metadata.accepted_contract_draft.id).toBe(d.draft_id);
    expect(c.metadata.accepted_contract_draft.revision).toBe(3);
  });
});
it("journey SQL blocks changing accepted text on a definitive contract", async () => {
  await expect(
    subject(async (tx) => {
      await accepted(tx);
      await bind(tx);
      await tx`update contracts set body_html='Alterado' where id=${IDs[2]}`;
    }),
  ).rejects.toThrow("imutáveis");
});
it("journey SQL refuses approval with unresolved template fields", async () => {
  await expect(
    subject(async (tx) => {
      const d = await prepare(tx);
      await tx`select contract_draft_review(${d.draft_id},1,'approve',NULL,'<p>Contrato com {{company.name}} e outras condições obrigatórias.</p>',NULL)`;
    }),
  ).rejects.toThrow("pendentes");
});
it("journey SQL preserves text revisions and resets the acceptance on reopen", async () => {
  await subject(async (tx) => {
    const d = await accepted(tx);
    await tx`select contract_draft_reopen(${d.draft_id},3,'Mudança solicitada pelo cliente')`;
    const [row] =
      await tx`select status,public_token,client_decided_at from contract_drafts where id=${d.draft_id}`;
    expect(row.status).toBe("pending_legal");
    expect(row.public_token).toBeNull();
    expect(row.client_decided_at).toBeNull();
    expect(
      (await tx`select revision from contract_draft_versions where draft_id=${d.draft_id}`).length,
    ).toBe(4);
  });
});
it("journey SQL rejects stale revisions and prevents lost changes", async () => {
  await expect(
    subject(async (tx) => {
      const d = await accepted(tx);
      await tx`select contract_draft_reopen(${d.draft_id},1,'Mudança solicitada pelo cliente')`;
    }),
  ).rejects.toThrow("alterada");
});
it("journey SQL requires an amendment after a contract already exists", async () => {
  await expect(
    subject(async (tx) => {
      const d = await accepted(tx);
      await bind(tx);
      await tx`select contract_draft_reopen(${d.draft_id},3,'Mudança solicitada pelo cliente')`;
    }),
  ).rejects.toThrow("aditivo");
});
it("journey SQL does not expose preserved text without a read key", async () => {
  let draftId = "";
  await db.begin(async (tx) => {
    const d =
      await tx`insert into contract_drafts(workspace_id,title,body_html) values(${W},'Teste','Texto protegido') returning id`;
    draftId = d[0].id;
  });
  try {
    await subject(
      async (tx) => {
        expect(
          await tx`select body_html from contract_draft_versions where draft_id=${draftId}`,
        ).toHaveLength(0);
      },
      { keys: false },
    );
  } finally {
    await db`delete from contract_drafts where id=${draftId}`;
  }
});

it("journey SQL preserves the reviewed period in the definitive contract", async () => {
  await subject(async (tx) => {
    await accepted(tx, { starts_at: "2026-12-01", ends_at: "2027-02-28" });
    const [row] = await bind(tx);
    expect(row.metadata.accepted_contract_draft.prepared_terms.starts_at).toBe("2026-12-01");
    const [c] = await tx`select starts_at::text,ends_at::text from contracts where id=${IDs[2]}`;
    expect(c.starts_at).toBe("2026-12-01");
    expect(c.ends_at).toBe("2027-02-28");
  });
});
it("journey SQL rejects invalid reviewed periods", async () => {
  await expect(
    subject(async (tx) => {
      await accepted(tx, { starts_at: "2027-02-28", ends_at: "2026-12-01" });
    }),
  ).rejects.toThrow("vigência");
});
it("journey SQL rejects a commercial contract without accepted proposal lineage", async () => {
  await expect(
    subject(async (tx) => {
      await tx`insert into contracts(id,workspace_id,owner_id,deal_id,status) values(${IDs[2]},${W},${U},${IDs[2]},'draft')`;
    }),
  ).rejects.toThrow("proposta e minuta");
});
it("journey SQL prevents forging acceptance provenance on a historical null metadata row", async () => {
  await expect(
    subject(async (tx) => {
      await tx`update contracts set metadata='{"accepted_contract_draft":{"id":"forged"}}' where id='50000000-0000-4000-8000-000000000099'`;
    }),
  ).rejects.toThrow("fabricar");
});

it("journey SQL blocks adding a deal to a new standalone contract without an accepted origin", async () => {
  await expect(
    subject(async (tx) => {
      await tx`insert into contracts(id,workspace_id,owner_id,status) values(${IDs[2]},${W},${U},'draft')`;
      await tx`update contracts set deal_id=${IDs[2]} where id=${IDs[2]}`;
    }),
  ).rejects.toThrow("proposta e minuta");
});
it("journey SQL protects the new-record marker against removal", async () => {
  await expect(
    subject(async (tx) => {
      await tx`insert into contracts(id,workspace_id,owner_id,status) values(${IDs[2]},${W},${U},'draft')`;
      await tx`update contracts set metadata='{}' where id=${IDs[2]}`;
    }),
  ).rejects.toThrow("protegida");
});

it("journey SQL preserves legitimate historical origin links without inventing acceptance", async () => {
  await subject(async (tx) => {
    const [row] =
      await tx`update contracts set deal_id=${IDs[2]} where id='50000000-0000-4000-8000-000000000099' returning metadata`;
    expect(row.metadata).toBeNull();
  });
});

it("journey SQL binds financial values to the accepted snapshot", async () => {
  await subject(async (tx) => {
    await accepted(tx);
    await bind(tx);
    const [c] = await tx`select total_value::text,currency from contracts where id=${IDs[2]}`;
    expect(c.total_value).toBe("100");
    expect(c.currency).toBe("BRL");
  });
});
