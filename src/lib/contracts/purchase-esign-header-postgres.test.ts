import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

const W1 = "aaaaaaaa-0000-4000-8000-000000000001";
const W2 = "aaaaaaaa-0000-4000-8000-000000000002";
const LE = "11111111-0000-4000-8000-000000000001";
const COMP = "22222222-0000-4000-8000-000000000001";
const CT = "33333333-0000-4000-8000-000000000001";
const PERSON = "44444444-0000-4000-8000-000000000001";
const REQ = "55555555-0000-4000-8000-000000000001";

let db: ReturnType<typeof postgres>;
let cleanup: (() => void) | null = null;

function sourceFunction(file: string, name: string): string {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw Error(`Missing production function: ${name}`);
  const tail = source.slice(start);
  const opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error(`Missing SQL body: ${name}`);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error(`Incomplete SQL function: ${name}`);
  return `${tail.slice(0, end + opening[1].length)};`;
}

const PG_OPTS = {
  database: "postgres",
  username: "postgres",
  max: 1,
  connect_timeout: 5,
  onnotice: () => {},
};

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
  const dir = mkdtempSync(join(tmpdir(), "techerp-purchase-esign-pg-"));
  if (initdbPath && existsSync(initdbPath)) {
    const bin = join(initdbPath, "..");
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
    return postgres({ ...PG_OPTS, host: sock, port });
  }

  const docker =
    process.platform === "darwin"
      ? "/Applications/Docker.app/Contents/Resources/bin/docker"
      : "docker";
  const image = "postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
  const container = `techerp-purchase-esign-${randomUUID()}`;
  const ep = execFileSync(
    docker,
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { encoding: "utf8", timeout: 10000 },
  ).trim();
  const password = randomUUID() + randomUUID();
  const envFile = join(dir, "postgres.env");
  writeFileSync(envFile, `POSTGRES_DB=esign_ci\nPOSTGRES_PASSWORD=${password}\n`, { mode: 0o600 });
  execFileSync(
    docker,
    [
      "--host",
      ep,
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
    ],
    { encoding: "utf8", timeout: 90000 },
  );
  const binding = execFileSync(docker, ["--host", ep, "port", container, "5432/tcp"], {
    encoding: "utf8",
    timeout: 15000,
  }).trim();
  cleanup = () => {
    try {
      execFileSync(docker, ["--host", ep, "rm", "-f", "-v", container], {
        stdio: "ignore",
        timeout: 15000,
      });
    } catch {
      /* ignore */
    }
    rmSync(dir, { recursive: true, force: true });
  };
  return postgres({
    ...PG_OPTS,
    host: "127.0.0.1",
    port: Number(binding.split(":")[1]),
    database: "esign_ci",
    password,
  });
}

beforeAll(async () => {
  db = await startDisposablePostgres();
  for (let i = 0; i < 60; i++) {
    try {
      await db`select 1`;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await db.unsafe(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE ROLE techerp_request_writer;
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE TABLE workspaces(id uuid PRIMARY KEY);
    CREATE TABLE legal_entities(id uuid PRIMARY KEY, workspace_id uuid, name text, cnpj text);
    CREATE TABLE companies(id uuid PRIMARY KEY, workspace_id uuid, name text, legal_name text, cnpj text);
    CREATE TABLE contacts(id uuid PRIMARY KEY, workspace_id uuid, first_name text, last_name text);
    CREATE TABLE people(id uuid PRIMARY KEY, workspace_id uuid, full_name text);
    CREATE TABLE contracts(
      id uuid PRIMARY KEY, workspace_id uuid, number text, title text, role text,
      document_kind text DEFAULT 'main', status text DEFAULT 'awaiting_signature',
      starts_at date, ends_at date, total_value numeric, monthly_value numeric,
      hours_per_month integer, currency text DEFAULT 'BRL', payment_day smallint,
      payment_method text, payment_terms jsonb DEFAULT '{}', body_html text,
      contracting_legal_entity_id uuid, counterparty_company_id uuid,
      counterparty_kind text DEFAULT 'company', counterparty_contact_id uuid,
      hiring_request_origin uuid, hiring_person_id uuid
    );
    CREATE TABLE services(
      id uuid PRIMARY KEY, workspace_id uuid, contract_id uuid, name text, type text,
      status text DEFAULT 'pending', quantity numeric, unit_price numeric,
      currency text DEFAULT 'BRL', starts_at date, ends_at date, billing_hold text,
      billing_hold_schedule jsonb, next_billing_at date, metadata jsonb DEFAULT '{}'
    );
    INSERT INTO workspaces VALUES ('${W1}'), ('${W2}');
    INSERT INTO legal_entities VALUES ('${LE}', '${W1}', 'GM Kologeski & Cia Ltda ME', '19133530000136');
    INSERT INTO companies VALUES ('${COMP}', '${W1}', 'Am It Serviços Em Informática', NULL, '42879490000198');
    INSERT INTO contacts VALUES ('${CT}', '${W1}', 'Anderson', 'Caldas');
    INSERT INTO people VALUES ('${PERSON}', '${W1}', 'Profissional Teste');
  `);

  const adapter = "drizzle/migrations/0378_hiring_signature_adapter.sql";
  await db.unsafe(sourceFunction(adapter, "hiring_contract_fingerprint_without_attachments"));
  await db.unsafe(
    sourceFunction(adapter, "hiring_contract_esign_body_without_attachments_sales_v1"),
  );
  await db.unsafe(sourceFunction(adapter, "hiring_contract_esign_body_without_attachments"));
  await db.unsafe(
    readFileSync("drizzle/migrations/0484_service_execution_signature_integrity.sql", "utf8"),
  );
  await db.unsafe(
    readFileSync("drizzle/migrations/0484_purchase_contract_esign_header.sql", "utf8"),
  );
}, 90000);

afterAll(async () => {
  if (db) await db.end({ timeout: 2 });
  cleanup?.();
});

describe("0484_purchase_contract_esign_header — cabeçalho e fingerprint de assinatura", () => {
  it("contrato de compra PJ exibe Contratante (WK), Contratada/Fornecedor (CNPJ), valores e pagamento sem rodapé vazio de serviços", async () => {
    const id = randomUUID();
    const terms = {
      downPayment: { kind: "percent", value: 50 },
      downPaymentDue: { kind: "signature" },
      plan: { kind: "fixed_date", date: "2026-12-28" },
    };
    await db`INSERT INTO contracts(id,workspace_id,number,title,role,starts_at,ends_at,total_value,monthly_value,hours_per_month,currency,payment_method,payment_day,payment_terms,body_html,contracting_legal_entity_id,counterparty_company_id,counterparty_kind)
      VALUES (${id},${W1},'C-202611-1816','[COMPRA] Am It — NEXID','client','2026-11-16','2026-12-28',15300.00,7650.00,80,'BRL','pix',15,${db.json(terms)},'<p>Cláusulas de compra</p>',${LE},${COMP},'company')`;
    const [{ html }] =
      await db`SELECT public.hiring_contract_esign_body_without_attachments(${W1}, ${id}) AS html`;

    for (const expected of [
      "<strong>Contrato:</strong> C-202611-1816",
      "<strong>Contratante:</strong> GM Kologeski &amp; Cia Ltda ME — CNPJ 19133530000136",
      "<strong>Contratada / Fornecedor:</strong> Am It Serviços Em Informática — CNPJ 42879490000198",
      "<strong>Vigência:</strong> 16/11/2026 a 28/12/2026",
      "<strong>Valor total:</strong> R$ 15.300,00",
      "<strong>Valor mensal:</strong> R$ 7.650,00",
      "<strong>Horas/mês:</strong> 80 h",
      "<strong>Forma de pagamento:</strong> PIX",
      "<strong>Dia de pagamento:</strong> dia 15",
      "<strong>Condições de pagamento:</strong> entrada de 50% do total (vence na assinatura do contrato) · saldo em parcela única em 28/12/2026",
    ]) {
      expect(html).toContain(expected);
    }
    for (const forbidden of [
      "Entidade prestadora:",
      "<strong>Cliente:</strong>",
      "Serviços contratados",
      "Nenhum cadastrado",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it("contrato de compra PF exibe nome completo do contato como Contratada / Fornecedor e altera fingerprint ao mudar o contato", async () => {
    const id = randomUUID();
    await db`INSERT INTO contracts(id,workspace_id,number,title,role,starts_at,ends_at,total_value,body_html,contracting_legal_entity_id,counterparty_company_id,counterparty_kind,counterparty_contact_id)
      VALUES (${id},${W1},'C-202611-9001','[COMPRA PF] Consultoria','client','2026-11-16','2026-12-28',8500.00,'<p>Corpo PF</p>',${LE},NULL,'person',${CT})`;
    const [{ html, h1 }] =
      await db`SELECT public.hiring_contract_esign_body_without_attachments(${W1},${id}) AS html, public.hiring_contract_fingerprint_without_attachments(${id}) AS h1`;
    expect(html).toContain("<strong>Contratada / Fornecedor:</strong> Anderson Caldas");
    expect(html).toContain("<strong>Valor total:</strong> R$ 8.500,00");

    await db`UPDATE contacts SET last_name = 'Caldas Silva' WHERE id = ${CT}`;
    const [{ html: html2, h2 }] =
      await db`SELECT public.hiring_contract_esign_body_without_attachments(${W1},${id}) AS html, public.hiring_contract_fingerprint_without_attachments(${id}) AS h2`;
    expect(html2).toContain("<strong>Contratada / Fornecedor:</strong> Anderson Caldas Silva");
    expect(h2).not.toBe(h1);
  });

  it("contrato de venda (provider) preserva exatamente o corpo e o fingerprint históricos", async () => {
    const id = randomUUID();
    await db`INSERT INTO contracts(id,workspace_id,number,title,role,starts_at,ends_at,total_value,body_html,contracting_legal_entity_id,counterparty_company_id)
      VALUES (${id},${W1},'C-202611-5749','Aditivo NEXID','provider','2026-11-12','2026-12-24',18870.00,'<p>Corpo venda</p>',${LE},${COMP})`;
    const [row] =
      await db`SELECT public.hiring_contract_esign_body_without_attachments(${W1},${id}) AS current_body, public.hiring_contract_esign_body_without_attachments_sales_v1(${W1},${id}) AS legacy_body, public.hiring_contract_fingerprint_without_attachments(${id}) AS current_hash, public.hiring_contract_fingerprint_with_service_state_v1(${id}) AS legacy_hash`;
    expect(row?.current_body).toBe(row?.legacy_body);
    expect(row?.current_body).toContain("<strong>Entidade prestadora:</strong>");
    expect(row?.current_body).toContain("<strong>Cliente:</strong>");
    expect(row?.current_hash).toBe(row?.legacy_hash);
  });

  it("contrato oriundo de preparação TechHire mantém formato e fingerprint próprios", async () => {
    const id = randomUUID();
    await db`INSERT INTO contracts(id,workspace_id,number,title,role,body_html,contracting_legal_entity_id,hiring_request_origin,hiring_person_id)
      VALUES (${id},${W1},'C-202611-8888','Instrumento TechHire','client','<p>Corpo RH</p>',${LE},${REQ},${PERSON})`;
    const [row] =
      await db`SELECT public.hiring_contract_esign_body_without_attachments(${W1},${id}) AS html, public.hiring_contract_fingerprint_without_attachments(${id}) AS current_hash, public.hiring_contract_fingerprint_with_service_state_v1(${id}) AS legacy_hash`;
    expect(row?.html).toContain("<strong>WK contratante:</strong>");
    expect(row?.html).toContain("<strong>Pessoa/empresa contratada:</strong> Profissional Teste");
    expect(row?.current_hash).toBe(row?.legacy_hash);
  });

  it("isola workspaces e revoga EXECUTE de funções privadas para todos os papéis de cliente/serviço", async () => {
    const id = randomUUID();
    await db`INSERT INTO contracts(id,workspace_id,number,title,role,total_value,body_html,contracting_legal_entity_id,counterparty_company_id)
      VALUES (${id},${W1},'C-202611-7777','Isolamento','client',1000,'<p>Privado</p>',${LE},${COMP})`;
    const [cross] =
      await db`SELECT public.hiring_contract_esign_body_without_attachments(${W2},${id}) AS html`;
    expect(cross?.html).toBeNull();

    const [priv] =
      await db`SELECT bool_and(NOT has_function_privilege(r,'public.hiring_contract_esign_body_without_attachments_purchase_v2(uuid,uuid)','EXECUTE') AND NOT has_function_privilege(r,'public.hiring_contract_esign_body_without_attachments(uuid,uuid)','EXECUTE') AND NOT has_function_privilege(r,'public.hiring_contract_fingerprint_without_attachments(uuid)','EXECUTE')) AS all_revoked FROM unnest(ARRAY['anon','authenticated','service_role','techerp_request_writer']) AS r`;
    expect(priv?.all_revoked).toBe(true);
  });
});
