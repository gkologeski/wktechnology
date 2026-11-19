import { afterAll, beforeAll, expect, it } from "vitest";
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { chownSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// LEGADO-REGULARIZA lote A. Real PostgreSQL with production resolver bodies and the prepared 0385.
// Never reads a configured database URL; native PostgreSQL 17 from nix on a private Unix socket.
const PREPARED = "docs/prepared-migrations/0385_contract_legacy_regularization.sql";
const W = "aaaaaaaa-0000-4000-8000-0000000000c1",
  B = "aaaaaaaa-0000-4000-8000-0000000000c2",
  U = "bbbbbbbb-0000-4000-8000-0000000000c1",
  V = "bbbbbbbb-0000-4000-8000-0000000000c2",
  L = "cccccccc-0000-4000-8000-0000000000c1",
  C = "dddddddd-0000-4000-8000-0000000000c1",
  K = "eeeeeeee-0000-4000-8000-0000000000c1",
  DEAL = "ffffffff-0000-4000-8000-0000000000c1";
const SHA = "a".repeat(64);
const nixPg =
  process.platform === "linux" && existsSync("/nix/store")
    ? readdirSync("/nix/store").find((n) => /-postgresql-17\.\d+$/.test(n))
    : undefined;
const pgBin = nixPg ? `/nix/store/${nixPg}/bin/` : "";
let root = "",
  started = false;
let db: ReturnType<typeof postgres>;
function native(binary: string, args: string[]) {
  return execFileSync("runuser", ["-u", "nobody", "--", pgBin + binary, ...args], {
    stdio: "pipe",
    timeout: 30000,
  });
}
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
  "techcontracts.legacy_contracts.view.workspace",
  "techcontracts.legacy_contracts.create.workspace",
  "techcontracts.legacy_contracts.approve.workspace",
  "techcontracts.contracts.view.workspace",
  "techcontracts.contracts.update.workspace",
];
beforeAll(async () => {
  if (!nixPg) throw Error("Native PostgreSQL 17 is required for this SQL permission test.");
  root = mkdtempSync(join(tmpdir(), "contract-legacy-pg-"));
  chownSync(root, 65534, 65534);
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
  const fixture = readFileSync("tests/fixtures/hiring-preparation.sql", "utf8");
  const permission = fixture.match(/CREATE FUNCTION user_has_permission[^\n]+/)?.[0];
  if (!permission) throw Error("resolver missing");
  await db.unsafe(fixture.replace(permission, ""));
  await db.unsafe(`CREATE TYPE contract_status AS ENUM('draft','in_review','in_negotiation','awaiting_signature','active','renewing','ended','terminated');
    ALTER TABLE contracts ADD owner_id uuid, ADD assigned_to uuid, ADD counterparty_company_id uuid, ADD parent_contract_id uuid, ADD number text,
      ADD status contract_status NOT NULL DEFAULT 'draft', ADD starts_at date, ADD ends_at date, ADD auto_renew boolean DEFAULT false, ADD body_html text,
      ADD public_token text, ADD signed_at timestamptz, ADD signed_pdf_path text, ADD metadata jsonb DEFAULT '{}', ADD signature_provider text,
      ADD signature_document_id text, ADD signature_operation_id text, ADD source_file_path text, ADD imported_from text, ADD document_kind text,
      ADD proposal_id uuid, ADD quote_id uuid, ADD hiring_request_origin uuid, ADD currency text, ADD payment_method text, ADD payment_terms jsonb;
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
  await db.unsafe(`CREATE TRIGGER contract_accepted_draft_guard BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contract_accepted_draft_guard();
    CREATE TRIGGER zzzz_contract_process_guard BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contract_process_guard();
    CREATE TRIGGER zz_contracts_release_service_billing AFTER UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contracts_release_service_billing_trg();
    GRANT SELECT ON contracts TO service_role;`);
}, 120000);
afterAll(async () => {
  if (db) await db.end();
  if (started) native("pg_ctl", ["-D", join(root, "data"), "-m", "fast", "-w", "stop"]);
  if (root) rmSync(root, { recursive: true, force: true });
});

async function reset(contract: Record<string, unknown> = {}) {
  await db.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL session_replication_role=replica;
      DO $c$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'permissions' LOOP EXECUTE format('DELETE FROM public.%I',t.tablename);END LOOP;END $c$;
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
  await db`insert into storage.objects values('contract-signature-evidence',${res.path},${db.json({ sha256: sha, actor_id: U })})`;
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
const attestCases = {} as Record<Mode, () => Promise<void>>;
const regularizeCases = {} as Record<Mode, () => Promise<void>>;
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
    await db`insert into storage.objects values('contract-signature-evidence',${res.path},${db.json({ sha256: SHA, actor_id: U })})`;
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
  await regularizeCases.allowed();
  expect(true).toBe(true);
});
it("legacy server attestation allowed", async () => {
  await attestCases.allowed();
  expect(true).toBe(true);
});
it("legacy regularize missing", async () => {
  await regularizeCases.missing();
  expect(true).toBe(true);
});
it("legacy server attestation missing", async () => {
  await attestCases.missing();
  expect(true).toBe(true);
});
it("legacy regularize deny", async () => {
  await regularizeCases.deny();
  expect(true).toBe(true);
});
it("legacy server attestation deny", async () => {
  await attestCases.deny();
  expect(true).toBe(true);
});
it("legacy regularize foreign", async () => {
  await regularizeCases.foreign();
  expect(true).toBe(true);
});
it("legacy server attestation foreign", async () => {
  await attestCases.foreign();
  expect(true).toBe(true);
});
it("legacy regularize inactive", async () => {
  await regularizeCases.inactive();
  expect(true).toBe(true);
});
it("legacy server attestation inactive", async () => {
  await attestCases.inactive();
  expect(true).toBe(true);
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
it("protected origins cannot be converted to legacy", async () => {
  for (const extra of [
    { hiring_request_origin: randomUUID() },
    { proposal_id: randomUUID() },
    { signature_provider: "forsign" },
    { signed_at: "2024-01-01" },
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
  await db`insert into storage.objects values('contract-signature-evidence',${res.path},${db.json({ sha256: "d".repeat(64), actor_id: U })})`;
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
it("regularization has no financial effects and refuses pending billing holds", async () => {
  await reset();
  await recognize();
  const ev = await attachEvidence();
  await db`insert into services values(${randomUUID()},${W},${K},'awaiting_signature')`;
  expect(await err(regularize(ev))).toMatch(/não libera cobranças/);
  await db`delete from services`;
  await db`insert into services values(${randomUUID()},${W},${K},null)`;
  expect(await err(regularize(ev))).toBe("ok");
  const [f] = await db`select count(*)::int n from financial_entries`;
  expect(f.n).toBe(0);
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
  ).toMatch(/imutável/);
  expect(
    await err(as(U, (tx) => tx`update contracts set source_file_path='outro.pdf' where id=${K}`)),
  ).toMatch(/imutável/);
  expect(await err(db`delete from contract_legacy_events`)).toMatch(/imutável/);
  const s = await as(U, (tx) => tx`select contract_legacy_state(${W},${K}) r`.then((x) => x[0].r));
  expect(s.record.status).toBe("regularized");
  expect(JSON.stringify(s)).not.toContain("legacy-contracts/");
});
