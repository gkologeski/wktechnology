import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { disposablePostgresStorageArgs } from "../../../tests/fixtures/disposable-postgres-storage";

// Real PostgreSQL with production RBAC resolvers and the complete additive migration.
// SQL claims below are isolated fixtures; they do not claim a GoTrue login or production acceptance.
const migration = "drizzle/migrations/0483_contract_commercial_acceptance.sql";
const docker =
  process.platform === "darwin"
    ? "/Applications/Docker.app/Contents/Resources/bin/docker"
    : "docker";
const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
const container = "techerp-commercial-acceptance-ci-" + randomUUID();
const W = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "aaaaaaaa-0000-4000-8000-00000000000b";
const U = "10000000-0000-4000-8000-000000000002";
const R = "30000000-0000-4000-8000-0000000000a8";
const C = "60000000-0000-4000-8000-000000000001";
const S = "60000000-0000-4000-8000-000000000002";
const PC = "60000000-0000-4000-8000-000000000003";
const PS = "60000000-0000-4000-8000-000000000004";
const A = "70000000-0000-4000-8000-000000000001";
const AP = "70000000-0000-4000-8000-000000000002";
const AB = "70000000-0000-4000-8000-000000000003";
const AQ = "70000000-0000-4000-8000-000000000004";
const Q = "80000000-0000-4000-8000-000000000001";
const ALL_KEYS = [
  "techcontracts.contracts.view.workspace",
  "techcontracts.contracts.update.workspace",
  "techcontracts.financials.view.workspace",
  "techcontracts.contract_acceptance.approve.workspace",
  "techcontracts.contract_acceptance.manage.workspace",
  "techcontracts.contract_acceptance_billing.manage.workspace",
  "techservice.services.view.workspace",
  "techservice.services.update.workspace",
  "techservice.billing.manage.workspace",
  "techservice.service_execution.manage.workspace",
  "techfinance.entries.create.workspace",
  "techfinance.entries.view.workspace",
  "techsales.quotes.view.workspace",
  "techsales.proposals.view.workspace",
];
const reason = "Entrega concluída e conferida pela equipe responsável.";
const evidence = "Cliente confirmou por e-mail a versão atual do contrato para faturamento.";
let db: ReturnType<typeof postgres>;
let endpoint = "",
  temporary = "",
  started = false;

const dockerRun = (...args: string[]) =>
  execFileSync(docker, ["--host", endpoint, ...args], {
    encoding: "utf8",
    timeout: 90000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

function sourceFunction(file: string, name: string) {
  const source = readFileSync(file, "utf8");
  const prefix = "CREATE OR REPLACE FUNCTION public." + name + "(";
  const start = source.indexOf(prefix);
  if (start < 0) throw Error("Missing production function: " + name);
  const tail = source.slice(start);
  const opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error("Missing production body: " + name);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error("Incomplete production body: " + name);
  return tail.slice(0, end + opening[1].length) + ";";
}

beforeAll(async () => {
  if (process.platform === "darwin" && !existsSync(docker))
    throw Error("Docker is required for SQL permission tests.");
  endpoint = execFileSync(
    docker,
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8", timeout: 10000 },
  ).trim();
  if (!endpoint.startsWith("unix://")) throw Error("Only a local Unix Docker socket is allowed.");
  temporary = mkdtempSync(join(tmpdir(), "techerp-commercial-acceptance-"));
  const password = randomUUID() + randomUUID();
  const envFile = join(temporary, "postgres.env");
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
  if (!/^127\.0\.0\.1:\d+$/.test(mapped)) throw Error("Unexpected disposable binding");
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
  for (const [file, name] of [
    ["drizzle/migrations/0031_workspace_members_status_inactive.sql", "is_workspace_member"],
    ["drizzle/migrations/0127_rbac_wk_vis_local_per_role.sql", "user_effective_permissions"],
    ["drizzle/migrations/0120_activities_team_scope_active_membership.sql", "my_team_member_pairs"],
    ["drizzle/migrations/0046_view_as_role_only_readonly.sql", "is_read_only_view"],
    ["drizzle/migrations/0216_work_core_prepare.sql", "work_access_context"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "work_action_prefix"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "work_context_access"],
    ["drizzle/migrations/0218_order3_completion_prepare.sql", "work_subject_context"],
    ["drizzle/migrations/0210_finance_core_actions.sql", "finance_access_context"],
    ["drizzle/migrations/0210_finance_core_actions.sql", "finance_context_access"],
    ["drizzle/migrations/0210_finance_core_actions.sql", "finance_scope_access"],
    ["drizzle/migrations/0222_order4_sales_prepare.sql", "sales_context_access"],
  ])
    await db.unsafe(sourceFunction(file, name));
  // Exact three-argument helper from the production catalogue. Effective permissions
  // above enforce active membership and deny precedence; there is no auth bypass stub.
  await db.unsafe(`CREATE FUNCTION public.user_has_permission(_user_id uuid,_workspace_id uuid,_permission_key text)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
    SELECT EXISTS(SELECT 1 FROM public.user_effective_permissions(_user_id,_workspace_id) k WHERE k=_permission_key) $$;`);
  await db.unsafe(readFileSync("tests/fixtures/contract-proposal.sql", "utf8"));
  await db.unsafe(`CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    ALTER TABLE permissions ADD COLUMN label text,ADD COLUMN is_sensitive boolean;
    ALTER TABLE workspaces ADD COLUMN name text;
    ALTER TABLE contracts ADD COLUMN role text,ADD COLUMN title text,ADD COLUMN number text,ADD COLUMN signed_at timestamptz,ADD COLUMN body_html text,ADD COLUMN total_value numeric,ADD COLUMN currency text,ADD COLUMN starts_at date,ADD COLUMN ends_at date,ADD COLUMN payment_terms jsonb,ADD COLUMN contracting_legal_entity_id uuid,ADD COLUMN legal_entity_id uuid,ADD COLUMN counterparty_contact_id uuid;
    ALTER TABLE legal_entities ADD COLUMN name text,ADD COLUMN cnpj text;
    CREATE TYPE service_status AS ENUM('pending','active','paused','cancelled','completed');
    CREATE TYPE service_type AS ENUM('one_time','recurring','milestone','usage_based');
    CREATE TYPE financial_direction AS ENUM('receivable','payable');
    CREATE TABLE services(id uuid PRIMARY KEY,workspace_id uuid REFERENCES workspaces(id),owner_id uuid,assigned_to uuid,contract_id uuid REFERENCES contracts(id),name text,description text,type service_type,status service_status,role text,cadence text,quantity numeric,unit_price numeric,currency text,starts_at date,ends_at date,next_billing_at date,billing_hold text,billing_hold_schedule jsonb);
    ALTER TABLE services ENABLE ROW LEVEL SECURITY;
    CREATE TABLE contract_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,contract_id uuid,actor_id uuid,event_type text,payload jsonb);
    CREATE TABLE contract_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,contract_id uuid,status text,stage text,sort_order integer,generation uuid,superseded_at timestamptz);
    CREATE TABLE contract_attachments(id uuid PRIMARY KEY,workspace_id uuid,contract_id uuid,kind text,file_name text,source_name text,source_id uuid,source_stamp text,sha256 text,storage_path text,source_snapshot_path text,source_snapshot_sha256 text,ready boolean,created_at timestamptz DEFAULT now());
    CREATE TABLE quotes(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,title text);
    CREATE TABLE work_resource_catalog(resource text PRIMARY KEY,table_name name,responsible_columns text[],parent_column name,parent_resource text,shared boolean);
    INSERT INTO work_resource_catalog VALUES('techcontracts.contracts','contracts',ARRAY['assigned_to','owner_id'],NULL,NULL,false),('techservice.services','services',ARRAY['assigned_to','owner_id'],NULL,NULL,false);
    ALTER TABLE financial_entries ALTER COLUMN id SET DEFAULT gen_random_uuid(),ADD PRIMARY KEY(id);
    ALTER TABLE financial_entries ADD COLUMN workspace_id uuid,ADD COLUMN owner_id uuid,ADD COLUMN direction financial_direction,ADD COLUMN origin_type text,ADD COLUMN origin_id uuid,ADD COLUMN contract_id uuid,ADD COLUMN service_id uuid,ADD COLUMN counterparty_company_id uuid,ADD COLUMN description text,ADD COLUMN amount numeric,ADD COLUMN currency text,ADD COLUMN competence_date date,ADD COLUMN due_date date,ADD COLUMN status text,ADD COLUMN external_ref text,ADD COLUMN installment_number int,ADD COLUMN installment_total int,ADD COLUMN notes text,ADD COLUMN metadata jsonb;
    CREATE UNIQUE INDEX financial_service_once ON financial_entries(service_id,competence_date) WHERE origin_type='service' AND service_id IS NOT NULL;
    CREATE UNIQUE INDEX financial_external_once ON financial_entries(workspace_id,external_ref) WHERE external_ref IS NOT NULL;
    CREATE FUNCTION project_billing_service_owned(p_service uuid,p_date date) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
    CREATE FUNCTION services_next_billing(p_date date,p_cadence text) RETURNS date LANGUAGE sql IMMUTABLE AS $$SELECT(p_date+interval '1 month')::date$$;
    GRANT SELECT,UPDATE ON services TO authenticated;
    GRANT SELECT ON financial_entries TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`);
  for (const name of [
    "work_record_context_access",
    "work_record_access",
    "work_area_authorize",
    "work_service_billing_guard",
  ])
    await db.unsafe(sourceFunction("drizzle/migrations/0218_order3_completion_prepare.sql", name));
  await db.unsafe(`CREATE POLICY service_read ON services FOR SELECT TO authenticated USING(work_record_access('techservice.services',id,'view'));
    CREATE POLICY service_update ON services FOR UPDATE TO authenticated USING(work_record_access('techservice.services',id,'update'));
    CREATE TRIGGER service_billing_guard BEFORE INSERT OR UPDATE ON services FOR EACH ROW EXECUTE FUNCTION work_service_billing_guard();`);
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0367_contract_signature_packages.sql",
      "contract_attachment_source_stamp",
    ),
  );
  // Same context-bearing clone as migration 0328, using its complete production
  // CASE mapping. Only the quote/proposal branches execute in these fixtures.
  const salesSource = readFileSync("drizzle/migrations/0222_order4_sales_prepare.sql", "utf8");
  const salesTail = salesSource.slice(
    salesSource.lastIndexOf("CREATE OR REPLACE FUNCTION public.sales_record_access("),
  );
  const accessBody = salesTail.slice(0, salesTail.indexOf("END $$;") + "END $$;".length);
  const privateAccess = accessBody
    .replace(
      "CREATE OR REPLACE FUNCTION public.sales_record_access(t text,i uuid,a text)",
      "CREATE OR REPLACE FUNCTION sales_private.record_access_ctx(c jsonb,t text,i uuid,a text)",
    )
    .replace("DECLARE c jsonb:=sales_access_context();BEGIN", "BEGIN");
  if (privateAccess === accessBody || privateAccess.includes("DECLARE c jsonb"))
    throw Error("Production sales access clone changed");
  await db.unsafe("CREATE SCHEMA sales_private;");
  await db.unsafe(privateAccess);
  await db.unsafe(
    sourceFunction(
      "drizzle/migrations/0367_contract_signature_packages.sql",
      "hiring_contract_esign_body_without_attachments",
    ),
  );
  await db.unsafe(
    readFileSync("drizzle/migrations/0361_service_billing_awaits_signature.sql", "utf8"),
  );
  await db.unsafe(readFileSync("drizzle/migrations/0463_purchase_contract_payables.sql", "utf8"));
  await db.unsafe(readFileSync(migration, "utf8"));
  await db.unsafe(
    readFileSync("drizzle/migrations/0485_contract_acceptance_public_attachments.sql", "utf8"),
  );
  await db`insert into workspaces(id,name) values(${W},'Workspace de teste'),(${B},'Outro workspace')`;
  await db`insert into profiles(id,active_workspace_id) values(${U},${W})`;
  await db`insert into workspace_members(workspace_id,user_id) values(${W},${U})`;
  await db`insert into job_roles(id,workspace_id) values(${R},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${R},${U},${W},${U})`;
  for (const key of ALL_KEYS)
    await db`insert into permissions(key,module,resource,action,scope) values(${key},'fixture','fixture','view','workspace') on conflict(key) do nothing`;
  await db`insert into contracts(id,workspace_id,owner_id,status,role,title,body_html,total_value,currency,starts_at,payment_terms,metadata)
    values(${C},${W},${U},'awaiting_signature','provider','Contrato teste','<p>Prestação de serviços e condições comerciais acordadas com o cliente.</p>',4500,'BRL',current_date-2,'{"plan":"single"}', '{"internal_cost":1234,"private_note":"Segredo interno"}'),
    (${PC},${W},${U},'awaiting_signature','client','Compra teste','<p>Compra de serviços e condições comerciais acordadas com o fornecedor.</p>',4500,'BRL',current_date-2,'{"plan":"single"}','{}')`;
  await db`insert into services(id,workspace_id,owner_id,contract_id,name,type,status,role,quantity,unit_price,currency,starts_at,billing_hold,billing_hold_schedule)
    values(${S},${W},${U},${C},'Suporte técnico','one_time','active','provider',18,250,'BRL',current_date-2,'awaiting_signature','[{"label":"Total","amount":4500,"dueEvent":"signature","dueDate":null}]'),
    (${PS},${W},${U},${PC},'Compra suporte','one_time','active','client',18,250,'BRL',current_date-2,'awaiting_signature','[{"label":"Total","amount":4500,"dueEvent":"signature","dueDate":null}]')`;
  await db`insert into contract_attachments(id,workspace_id,contract_id,kind,file_name,sha256,storage_path,ready)
    values(${A},${W},${C},'file','Anexo PDF de teste',${"a".repeat(64)},${`${W}/${C}/${A}/teste.pdf`},true),
    (${AP},${W},${PC},'file','Outro contrato',${"b".repeat(64)},${`${W}/${PC}/${AP}/teste.pdf`},true),
    (${AB},${B},${C},'file','Outro workspace',${"c".repeat(64)},${`${B}/${C}/${AB}/teste.pdf`},true)`;
  const approvalGeneration = randomUUID();
  await db`insert into contract_approvals(workspace_id,contract_id,stage,status,sort_order,generation) values(${W},${C},'legal','approved',0,${approvalGeneration}),(${W},${C},'finance','approved',1,${approvalGeneration})`;
}, 120000);

afterAll(async () => {
  if (db) await db.end();
  if (started) dockerRun("rm", "-f", "-v", container);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}, 30000);

type Options = {
  keys?: string[];
  deny?: string;
  inactive?: boolean;
  workspace?: string;
  readOnly?: boolean;
};
async function subject(fn: (tx: postgres.TransactionSql) => Promise<void>, options: Options = {}) {
  const rollback = new Error("rollback fixture");
  try {
    await db.begin(async (tx) => {
      await tx`update profiles set active_workspace_id=${options.workspace ?? W} where id=${U}`;
      if (options.inactive)
        await tx`update workspace_members set status='inactive' where user_id=${U}`;
      for (const key of options.keys ?? ALL_KEYS)
        await tx`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${R},${key},${options.deny === key ? "deny" : "grant"})`;
      const sessionId = randomUUID();
      if (options.readOnly)
        await tx`insert into view_as_sessions(session_id,mode) values(${sessionId},'role')`;
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: U, role: "authenticated", session_id: sessionId })},true)`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function privileged(tx: postgres.TransactionSql) {
  await tx.unsafe("SET LOCAL ROLE postgres");
}
async function publicService(tx: postgres.TransactionSql) {
  await tx.unsafe("SET LOCAL ROLE service_role");
  await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
}
async function record(tx: postgres.TransactionSql, id = C) {
  const [state] = await tx`select contract_commercial_state(${id}::uuid) as r`;
  const [row] =
    await tx`select contract_commercial_record(${id}::uuid,current_date,'Cliente autorizado',${evidence},'Concordância recebida pelo atendimento.',${state.r.currentHash}) as r`;
  return row.r as Record<string, unknown>;
}
async function complete(tx: postgres.TransactionSql, id = S) {
  const [row] =
    await tx`select service_execution_complete(${id}::uuid,current_date,${reason}) as r`;
  return row.r as {
    service: Record<string, unknown>;
    completion: Record<string, unknown>;
    duplicate: boolean;
  };
}
async function issue(tx: postgres.TransactionSql) {
  const [row] = await tx`select contract_commercial_issue_link(${C}::uuid) as r`;
  return row.r as { token: string; path: string };
}
async function publicGet(tx: postgres.TransactionSql, token: string) {
  const [row] = await tx`select contract_commercial_public_get(${token}) as r`;
  return row.r as Record<string, unknown> | null;
}
async function publicAttachment(tx: postgres.TransactionSql, token: string, id = A) {
  const [row] = await tx`select contract_commercial_public_attachment(${token},${id}::uuid) as r`;
  return row.r as Record<string, unknown> | null;
}
async function addQuoteAnnex(tx: postgres.TransactionSql) {
  await privileged(tx);
  await tx`insert into quotes(id,workspace_id,owner_id,title) values(${Q},${W},${U},'Cotação anexada')`;
  await tx`insert into contract_attachments(id,workspace_id,contract_id,kind,file_name,source_name,source_id,source_stamp,ready) values(${AQ},${W},${C},'quote','Cotação anexada','Cotação anexada',${Q},${"d".repeat(64)},true)`;
  await tx.unsafe("SET LOCAL ROLE authenticated");
}
async function release(tx: postgres.TransactionSql, id = C, due = "2026-11-30") {
  const [state] = await tx`select contract_commercial_state(${id}::uuid) as r`;
  const [row] =
    await tx`select contract_commercial_release_billing(${id}::uuid,${due}::date,'Vencimento acordado expressamente com o cliente.',${state.r.currentHash}) as r`;
  return row.r as { generated: number; duplicate: boolean };
}

it("records real execution completion while preserving unsigned billing hold and schedule", async () => {
  await subject(async (tx) => {
    const result = await complete(tx);
    expect(result.service.status).toBe("completed");
    expect(result.service.billing_hold).toBe("awaiting_signature");
    const [held] = await tx`select billing_hold_schedule from services where id=${S}`;
    expect(held.billing_hold_schedule).toEqual([
      { label: "Total", amount: 4500, dueEvent: "signature", dueDate: null },
    ]);
    expect(result.completion.created_by).toBe(U);
    expect((await complete(tx)).duplicate).toBe(true);
    expect(await tx`select id from financial_entries where contract_id=${C}`).toHaveLength(0);
    const [contract] = await tx`select status,signed_at from contracts where id=${C}`;
    expect(contract).toEqual({ status: "awaiting_signature", signed_at: null });
  });
});

const mutations = [
  {
    key: "techcontracts.contract_acceptance.manage.workspace",
    run: async (tx: postgres.TransactionSql) => {
      await issue(tx);
    },
  },
  {
    key: "techcontracts.contract_acceptance.approve.workspace",
    run: async (tx: postgres.TransactionSql) => {
      await record(tx);
    },
  },
  {
    key: "techservice.service_execution.manage.workspace",
    run: async (tx: postgres.TransactionSql) => {
      await complete(tx);
    },
  },
  {
    key: "techcontracts.contract_acceptance_billing.manage.workspace",
    run: async (tx: postgres.TransactionSql) => {
      await release(tx);
    },
  },
];
it("commercial workflow SQL permits an authorized active member", async () => {
  await subject(async (tx) => {
    expect((await issue(tx)).token).toMatch(/^[a-f0-9]{64}$/);
    expect((await record(tx)).accepted).toBe(true);
    expect((await complete(tx)).service.status).toBe("completed");
    expect((await release(tx)).generated).toBe(1);
  });
});
it("commercial workflow SQL rejects missing permissions", async () => {
  for (const action of mutations)
    await expect(
      subject(action.run, { keys: ALL_KEYS.filter((key) => key !== action.key) }),
    ).rejects.toMatchObject({ code: "42501" });
});
it("commercial workflow SQL respects explicit deny", async () => {
  for (const action of mutations)
    await expect(subject(action.run, { deny: action.key })).rejects.toMatchObject({
      code: "42501",
    });
});
it("commercial workflow SQL isolates another workspace", async () => {
  for (const action of mutations)
    await expect(subject(action.run, { workspace: B })).rejects.toMatchObject({ code: "42501" });
});
it("commercial workflow SQL rejects inactive membership", async () => {
  for (const action of mutations)
    await expect(subject(action.run, { inactive: true })).rejects.toMatchObject({ code: "42501" });
});

it("commercial mutations remain disabled in a read-only role session", async () => {
  for (const action of mutations)
    await expect(subject(action.run, { readOnly: true })).rejects.toMatchObject({ code: "42501" });
});

it("internal acceptance is evidenced, repeatable without another proof, and leaves signature unchanged", async () => {
  await subject(async (tx) => {
    const first = await record(tx);
    expect(first.accepted).toBe(true);
    expect(first.signaturePending).toBe(true);
    expect(first.billingReleased).toBe(false);
    expect((await record(tx)).history).toHaveLength(1);
    const [contract] = await tx`select signed_at,status from contracts where id=${C}`;
    expect(contract.signed_at).toBeNull();
    expect(contract.status).toBe("awaiting_signature");
  });
});

it("a public link exposes only the frozen customer document and no internal metadata or ids", async () => {
  await subject(async (tx) => {
    const link = await issue(tx);
    expect(link.token).toMatch(/^[a-f0-9]{64}$/);
    await publicService(tx);
    const doc = await publicGet(tx, link.token);
    expect(doc?.bodyHtml).toContain("Prestação de serviços");
    const payload = JSON.stringify(doc);
    for (const privateValue of [
      C,
      S,
      W,
      U,
      "private_note",
      "internal_cost",
      "Segredo interno",
      "token_hash",
      "content_hash",
    ])
      expect(payload).not.toContain(privateValue);
    expect(doc?.status).toBe("pending");
    expect(doc?.attachments).toEqual([{ id: A, name: "Anexo PDF de teste", kind: "file" }]);
    expect(payload).not.toContain("storage_path");
    expect(payload).not.toContain(`${W}/${C}/`);
  });
});

it("attachment capability resolves only a ready private file of the token contract to the server", async () => {
  await subject(async (tx) => {
    const { token } = await issue(tx);
    await publicService(tx);
    const file = await publicAttachment(tx, token);
    expect(file).toMatchObject({
      attachmentId: A,
      kind: "file",
      fileName: "Anexo PDF de teste",
      bucket: "contract-attachments",
      storagePath: `${W}/${C}/${A}/teste.pdf`,
      sha256: "a".repeat(64),
    });
    expect(await publicAttachment(tx, token, AP)).toBeNull();
    expect(await publicAttachment(tx, token, AB)).toBeNull();
  });
});

it("attachment capability refuses a private storage path outside the contract directory", async () => {
  await subject(async (tx) => {
    await privileged(tx);
    await tx`update contract_attachments set storage_path=${`${B}/${PC}/${A}/foreign.pdf`} where id=${A}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    const { token } = await issue(tx);
    await publicService(tx);
    expect(await publicAttachment(tx, token)).toBeNull();
  });
});

it("commercial quote annexes require the issuer's current record access before sharing", async () => {
  await subject(async (tx) => {
    await addQuoteAnnex(tx);
    const { token } = await issue(tx);
    await publicService(tx);
    expect(await publicAttachment(tx, token, AQ)).toMatchObject({
      kind: "quote",
      sourceId: Q,
      bucket: null,
    });
  });
  await expect(
    subject(
      async (tx) => {
        await addQuoteAnnex(tx);
        await issue(tx);
      },
      { keys: ALL_KEYS.filter((key) => key !== "techsales.quotes.view.workspace") },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    subject(
      async (tx) => {
        await addQuoteAnnex(tx);
        await issue(tx);
      },
      { deny: "techsales.quotes.view.workspace" },
    ),
  ).rejects.toMatchObject({ code: "42501" });
});

it("a previously shared quote annex is unavailable after issuer scope or tenant access changes", async () => {
  await subject(
    async (tx) => {
      await addQuoteAnnex(tx);
      const { token } = await issue(tx);
      await privileged(tx);
      await tx`update quotes set owner_id='10000000-0000-4000-8000-000000000009' where id=${Q}`;
      await publicService(tx);
      expect(await publicGet(tx, token)).toBeNull();
      expect(await publicAttachment(tx, token, AQ)).toBeNull();
    },
    {
      keys: [
        ...ALL_KEYS.filter((key) => key !== "techsales.quotes.view.workspace"),
        "techsales.quotes.view.own",
      ],
    },
  );
  await subject(async (tx) => {
    await addQuoteAnnex(tx);
    const { token } = await issue(tx);
    await privileged(tx);
    await tx`update quotes set workspace_id=${B} where id=${Q}`;
    await publicService(tx);
    expect(await publicGet(tx, token)).toBeNull();
    expect(await publicAttachment(tx, token, AQ)).toBeNull();
  });
});

it("public acceptance is idempotent and cannot impersonate a signature or release finance", async () => {
  await subject(async (tx) => {
    const { token } = await issue(tx);
    await publicService(tx);
    const [first] =
      await tx`select contract_commercial_public_accept(${token},'Cliente autorizado','cliente@example.test') as r`;
    const [second] =
      await tx`select contract_commercial_public_accept(${token},'Cliente autorizado','cliente@example.test') as r`;
    expect(first.r.accepted).toBe(true);
    expect(second.r.duplicate).toBe(true);
    expect((await publicGet(tx, token))?.status).toBe("accepted");
    await privileged(tx);
    expect(await tx`select id from financial_entries where contract_id=${C}`).toHaveLength(0);
    const [contract] = await tx`select signed_at,status from contracts where id=${C}`;
    expect(contract).toEqual({ signed_at: null, status: "awaiting_signature" });
    expect(
      await tx`select id from contract_commercial_acceptances where contract_id=${C}`,
    ).toHaveLength(1);
  });
});

it("issuing a replacement link revokes the old bearer", async () => {
  await subject(async (tx) => {
    const first = await issue(tx);
    const second = await issue(tx);
    await publicService(tx);
    expect(await publicGet(tx, first.token)).toBeNull();
    expect(await publicGet(tx, second.token)).not.toBeNull();
  });
});

for (const invalidation of [
  "expiry",
  "revocation",
  "body",
  "issuer-inactive",
  "issuer-deny",
  "tenant",
] as const) {
  it(`public bearer fails closed after ${invalidation}`, async () => {
    await subject(async (tx) => {
      const { token } = await issue(tx);
      await privileged(tx);
      if (invalidation === "expiry")
        await tx`update contract_commercial_acceptance_links set expires_at=now()-interval '1 second' where contract_id=${C}`;
      if (invalidation === "revocation")
        await tx`update contract_commercial_acceptance_links set revoked_at=now() where contract_id=${C}`;
      if (invalidation === "body")
        await tx`update contracts set body_html='<p>Outra versão comercial, ainda não aceita pelo cliente.</p>' where id=${C}`;
      if (invalidation === "issuer-inactive")
        await tx`update workspace_members set status='inactive' where user_id=${U} and workspace_id=${W}`;
      if (invalidation === "issuer-deny")
        await tx`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${R} and permission_key='techcontracts.contract_acceptance.manage.workspace'`;
      if (invalidation === "tenant")
        await tx`update contract_commercial_acceptance_links set workspace_id=${B} where contract_id=${C}`;
      await publicService(tx);
      expect(await publicGet(tx, token)).toBeNull();
      expect(await publicAttachment(tx, token)).toBeNull();
      await expect(
        tx`select contract_commercial_public_accept(${token},'Cliente autorizado',null)`,
      ).rejects.toThrow();
    });
  });
}

it("operational completion preserves a valid commercial acceptance", async () => {
  await subject(async (tx) => {
    await record(tx);
    await complete(tx);
    const [row] = await tx`select contract_commercial_state(${C}::uuid) as r`;
    expect(row.r.accepted).toBe(true);
    expect(row.r.signaturePending).toBe(true);
  });
});

it("changing a material service price requires a new commercial acceptance", async () => {
  await subject(async (tx) => {
    await record(tx);
    await tx`update services set unit_price=300 where id=${S}`;
    const [row] = await tx`select contract_commercial_state(${C}::uuid) as r`;
    expect(row.r.accepted).toBe(false);
    expect(row.r.history).toHaveLength(1);
    await expect(release(tx)).rejects.toThrow(/versão atual/i);
  });
});

it("material contract changes invalidate acceptance while preserving its history", async () => {
  await subject(async (tx) => {
    await record(tx);
    await tx`update contracts set body_html='<p>Nova revisão de condições e valores para outra avaliação.</p>' where id=${C}`;
    const [row] = await tx`select contract_commercial_state(${C}::uuid) as r`;
    expect(row.r.accepted).toBe(false);
    expect(row.r.history).toHaveLength(1);
    await expect(release(tx)).rejects.toThrow();
  });
});

it("internal recording rejects a stale version reviewed before another edit", async () => {
  await subject(async (tx) => {
    const [old] = await tx`select contract_commercial_state(${C}::uuid) as r`;
    await tx`update contracts set body_html='<p>Nova versão editada antes da gravação do aceite.</p>' where id=${C}`;
    await expect(
      tx`select contract_commercial_record(${C}::uuid,current_date,'Cliente autorizado',${evidence},'Confirmação recebida sobre a versão anterior.',${old.r.currentHash})`,
    ).rejects.toMatchObject({ code: "23514" });
  });
});

it("internal approvals remain mandatory for release after a real acceptance", async () => {
  await subject(async (tx) => {
    await record(tx);
    await privileged(tx);
    await tx`insert into contract_approvals(workspace_id,contract_id,stage,status) values(${W},${C},'legal','pending')`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await expect(release(tx)).rejects.toThrow(/aprova/i);
  });
});

it("an absent internal approval chain cannot authorize commercial billing", async () => {
  await subject(async (tx) => {
    await privileged(tx);
    await tx`delete from contract_approvals where contract_id=${C}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    expect((await record(tx)).accepted).toBe(true);
    await expect(release(tx)).rejects.toThrow(/aprova/i);
  });
});

it("partial or mixed-generation approvals cannot replace the current complete chain", async () => {
  await expect(
    subject(async (tx) => {
      await privileged(tx);
      await tx`delete from contract_approvals where contract_id=${C} and stage='finance'`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await record(tx);
      await release(tx);
    }),
  ).rejects.toThrow(/aprova/i);
  await expect(
    subject(async (tx) => {
      await privileged(tx);
      await tx`update contract_approvals set generation=${randomUUID()} where contract_id=${C} and stage='finance'`;
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await record(tx);
      await release(tx);
    }),
  ).rejects.toThrow(/aprova/i);
});

it("an accepted and completed service bills once on the agreed date without faking signature", async () => {
  await subject(async (tx) => {
    await record(tx);
    await complete(tx);
    const released = await release(tx);
    expect(released.generated).toBe(1);
    expect((await release(tx)).duplicate).toBe(true);
    let entries =
      await tx`select amount,due_date::text,direction from financial_entries where contract_id=${C}`;
    expect(entries).toEqual([{ amount: "4500", due_date: "2026-11-30", direction: "receivable" }]);
    const [before] = await tx`select signed_at,status from contracts where id=${C}`;
    expect(before).toEqual({ signed_at: null, status: "awaiting_signature" });
    await privileged(tx);
    await tx`update contracts set signed_at=now() where id=${C}`;
    entries =
      await tx`select amount,due_date::text,direction from financial_entries where contract_id=${C}`;
    expect(entries).toHaveLength(1);
    const [service] = await tx`select status,billing_hold from services where id=${S}`;
    expect(service).toEqual({ status: "completed", billing_hold: null });
  });
});

it("a signature-conditioned installment requires an explicit agreed due date", async () => {
  await subject(async (tx) => {
    const state = await record(tx);
    if (typeof state.currentHash !== "string") throw Error("Current commercial hash is required");
    await expect(
      tx`select contract_commercial_release_billing(${C}::uuid,null,'Cliente autorizou antecipação comercial da cobrança.',${state.currentHash})`,
    ).rejects.toThrow(/vencimento combinado/i);
  });
});

it("preexisting noncanonical receivables require reconciliation before commercial billing", async () => {
  await subject(async (tx) => {
    await record(tx);
    await privileged(tx);
    await tx`insert into financial_entries(workspace_id,owner_id,contract_id,direction,origin_type,amount,status,due_date) values(${W},${U},${C},'receivable','manual',4500,'open','2026-11-30')`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await expect(release(tx)).rejects.toThrow(/Concilie/i);
  });
});

it("revocation preserves generated titles and a renewed acceptance never creates a second charge", async () => {
  await subject(async (tx) => {
    await record(tx);
    expect((await release(tx)).generated).toBe(1);
    const [revoked] =
      await tx`select contract_commercial_revoke(${C}::uuid,'Aceite revogado para confirmar novamente as condições.',false) as r`;
    expect(revoked.r.accepted).toBe(false);
    expect(await tx`select id from financial_entries where contract_id=${C}`).toHaveLength(1);
    expect((await record(tx)).accepted).toBe(true);
    expect((await release(tx)).generated).toBe(0);
    expect(await tx`select id from financial_entries where contract_id=${C}`).toHaveLength(1);
  });
});

it("a delivery milestone remains in its measurement acceptance process", async () => {
  await subject(async (tx) => {
    await privileged(tx);
    await tx`update services set billing_hold_schedule='[{"label":"Marco","amount":4500,"dueEvent":"milestone","dueDate":"2026-11-30"}]'::jsonb where id=${S}`;
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await record(tx);
    await expect(release(tx)).rejects.toThrow(/marco/i);
  });
});

it("supplier purchases cannot use commercial acceptance to skip signature", async () => {
  await expect(
    subject(async (tx) => {
      await record(tx, PC);
    }),
  ).rejects.toThrow(/aceite/i);
  await expect(
    subject(async (tx) => {
      await release(tx, PC);
    }),
  ).rejects.toThrow();
  await expect(
    subject(async (tx) => {
      await tx`select contract_purchase_payables_generate(${PC}::uuid,'[{"label":"Total","amount":4500,"due_on":"2026-11-30"}]'::jsonb)`;
    }),
  ).rejects.toThrow(/assinado/);
});

it("execution completion rejects dates outside the actual execution interval and empty proof", async () => {
  await expect(
    subject(async (tx) => {
      await tx`select service_execution_complete(${S}::uuid,current_date+1,${reason})`;
    }),
  ).rejects.toThrow(/data/i);
  await expect(
    subject(async (tx) => {
      await tx`select service_execution_complete(${S}::uuid,current_date-5,${reason})`;
    }),
  ).rejects.toThrow(/data/i);
  await expect(
    subject(async (tx) => {
      await tx`select service_execution_complete(${S}::uuid,current_date,'ok')`;
    }),
  ).rejects.toThrow();
});

for (const table of [
  "contract_commercial_acceptances",
  "contract_commercial_acceptance_links",
  "contract_acceptance_billing_releases",
  "service_execution_completions",
]) {
  it(`${table}: authenticated clients cannot forge or rewrite protected proof`, async () => {
    await expect(
      subject(async (tx) => {
        await tx.unsafe(`SELECT * FROM public.${table}`);
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      subject(async (tx) => {
        await tx.unsafe(`DELETE FROM public.${table}`);
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      subject(async (tx) => {
        await tx.unsafe(`INSERT INTO public.${table} DEFAULT VALUES`);
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      subject(async (tx) => {
        await tx.unsafe(`UPDATE public.${table} SET workspace_id='${B}'`);
      }),
    ).rejects.toThrow(/permission denied/);
  });
}

it("raw service status updates cannot bypass audited one-time completion", async () => {
  await expect(
    subject(async (tx) => {
      await tx`update services set status='completed' where id=${S}`;
    }),
  ).rejects.toThrow(/conclu|execu|Ativar serviço/i);
});

it("raw service updates cannot clear a billing hold or replace its schedule", async () => {
  await expect(
    subject(async (tx) => {
      await tx`update services set billing_hold=null where id=${S}`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    subject(async (tx) => {
      await tx`update services set billing_hold_schedule='[{"amount":1}]'::jsonb where id=${S}`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
});

it("anonymous and ordinary authenticated clients cannot execute the service-only public boundary", async () => {
  await expect(
    subject(async (tx) => {
      await tx`select contract_commercial_public_get(${"a".repeat(64)})`;
    }),
  ).rejects.toThrow(/permission denied/);
  await expect(
    subject(async (tx) => {
      await tx`select contract_commercial_public_attachment(${"a".repeat(64)},${A}::uuid)`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    subject(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE anon");
      await tx`select contract_commercial_public_accept(${"a".repeat(64)},'Cliente autorizado',null)`;
    }),
  ).rejects.toThrow(/permission denied/);
});
