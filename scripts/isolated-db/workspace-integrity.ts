// Integridade multiworkspace no banco ISOLADO (estrutura real do catálogo, fixtures sintéticas).
// Cada caso: setup como superusuário (só para montar fixtures) → asserção como
// authenticated | anon | service_role (job sem sessão) → ROLLBACK. Gatilhos reais disparam;
// net/cron são stubs inertes do bootstrap (nada sai do processo).
// Status: passed | failed | known_gap (comportamento inseguro conhecido e ainda não corrigido;
// NUNCA conta como verde) | not_executed (depende de infraestrutura ausente).
// Saída: $ISO_ROOT/artifacts/workspace-integrity.{json,xml}. Exit 1 falha | 2 bloqueado | 3 lacuna/pendente.
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.env.ISO_ROOT ?? "/tmp/techerp-isolated";
const env: Record<string, string | undefined> = { ...process.env };
for (const k of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "DATABASE_URL"])
  delete env[k];
const CONN = [
  "-h",
  `${root}/sock`,
  "-p",
  process.env.ISO_PORT ?? "54329",
  "-U",
  "postgres",
  "-d",
  "postgres",
];

const WA = "aaaaaaaa-0000-4000-8000-00000000000a";
const WB = "aaaaaaaa-0000-4000-8000-00000000000b";
// Id do DEFAULT fixo das 81 colunas (tenant original). No isolado existe só como workspace
// sintético vazio, para o FK aceitar e o vazamento silencioso ficar observável.
const WORIG = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const U = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const ADMIN_A = U(1),
  OWN_A = U(2),
  TEAM_A = U(3),
  WS_A = U(4),
  REMOVED_A = U(5),
  ADMIN_B = U(6);
const CT_A = "70000000-0000-4000-8000-0000000000a1",
  CT_B = "70000000-0000-4000-8000-0000000000b1";
const TK_B = "71000000-0000-4000-8000-0000000000b1";
const SUB_B = "72000000-0000-4000-8000-0000000000b1";
const TH_A = "73000000-0000-4000-8000-0000000000a1";
const ACC_A2 = "54000000-0000-4000-8000-0000000000a2";

type Role = "authenticated" | "anon" | "service_role";
type Case = {
  id: string;
  area: string;
  uid: string | null;
  role?: Role;
  setup?: string;
  sql: string;
  expect: string | RegExp;
  /** Saída que caracteriza a lacuna conhecida (ainda não corrigida). */
  gap?: string | RegExp;
  why: string;
  notExecuted?: string;
};

const contacts = `insert into public.contacts (id, workspace_id, owner_id, first_name) values
 ('${CT_A}','${WA}','${OWN_A}','[ISO] Contato A'), ('${CT_B}','${WB}','${ADMIN_B}','[ISO] Contato B') on conflict do nothing;`;
const pipeB = `insert into public.pipelines (id, workspace_id, owner_id, entity, name) values ('75000000-0000-4000-8000-0000000000b1','${WB}','${ADMIN_B}','ticket','[ISO] funil B') on conflict do nothing;`;
const pipeA = `insert into public.pipelines (id, workspace_id, owner_id, entity, name) values ('75000000-0000-4000-8000-0000000000a1','${WA}','${ADMIN_A}','ticket','[ISO] funil A') on conflict do nothing;`;
const ticketB = `${contacts} ${pipeB} insert into public.tickets (id, workspace_id, owner_id, subject, contact_id, status)
 values ('${TK_B}','${WB}','${ADMIN_B}','[ISO] chamado B','${CT_B}','open');`;
const surveyWs = `select coalesce(string_agg(workspace_id::text, ','), 'none') from public.survey_responses where ticket_id = '${TK_B}'`;
const subIns = (ws: string | null, contact = CT_B, owner = ADMIN_B) =>
  `insert into public.subscriptions (id, ${ws ? "workspace_id, " : ""}owner_id, contact_id, name, amount, start_date, status)
   values ('${SUB_B}', ${ws ? `'${ws}', ` : ""}'${owner}', '${contact}', '[ISO] assinatura', 10, current_date, 'active')`;
const invWs = `select coalesce(string_agg(workspace_id::text, ',' order by period_start), 'none') || '|' || count(*) from public.subscription_invoices where subscription_id = '${SUB_B}'`;
const payFirst = `update public.subscription_invoices set status = 'paid' where id = (select id from public.subscription_invoices where subscription_id = '${SUB_B}' order by period_start limit 1)`;
const rank = (ws: string) =>
  `select coalesce((select string_agg(x->>'name', ',' order by x->>'name') from jsonb_array_elements(public.get_sales_dashboard_secondary_v2('${ws}'::uuid, null, null, 'all', null,
   array['won']::text[], array['won']::text[], '{"won":1}'::jsonb, now(), now(), now() - interval '1 year', 0, now() - interval '1 year', now() + interval '1 day', 8) -> 'advanced') x), '')`;
const restrict = `update public.job_roles set restricted_visibility = true where id::text like '30000000-%';`;
const dealNames = `select coalesce(string_agg(name, ',' order by name), '') from public.deals`;
const threadA = (withContact: boolean) =>
  `${contacts} insert into public.email_threads (id, workspace_id, owner_id, account_id, provider_thread_id, subject${withContact ? ", contact_id" : ""})
   values ('${TH_A}','${WA}','${OWN_A}','${ACC_A2}','iso-th-a','[ISO] conversa A'${withContact ? `, '${CT_A}'` : ""});`;
const seeThread = `select count(*) from public.email_threads where id = '${TH_A}'`;

const CASES: Case[] = [
  // ---- pesquisa de chamado (create_ticket_survey) ----
  {
    id: "survey-user-b",
    area: "survey",
    uid: ADMIN_B,
    setup: ticketB,
    sql: `update public.tickets set status = 'resolved' where id = '${TK_B}'; ${surveyWs}`,
    expect: WB,
    why: "admin de B resolve chamado de B: pesquisa nasce em B",
  },
  {
    id: "survey-job-b",
    area: "survey",
    uid: null,
    role: "service_role",
    setup: ticketB,
    sql: `update public.tickets set status = 'closed' where id = '${TK_B}'; ${surveyWs}`,
    expect: WB,
    why: "job sem sessão: tenant vem do chamado, nunca do tenant original",
  },
  {
    id: "survey-idempotent",
    area: "survey",
    uid: ADMIN_B,
    setup: ticketB,
    sql: `update public.tickets set status = 'resolved' where id = '${TK_B}'; update public.tickets set status = 'open' where id = '${TK_B}';
          update public.tickets set status = 'closed' where id = '${TK_B}'; select count(*) from public.survey_responses where ticket_id = '${TK_B}'`,
    expect: "1",
    why: "reabrir e fechar não duplica a pesquisa",
  },
  // ---- assinatura → fatura (subscription_after_insert / subscription_invoice_after_paid) ----
  {
    id: "sub-insert-user-b",
    area: "billing",
    uid: ADMIN_B,
    setup: contacts,
    sql: `${subIns(WB)}; ${invWs}`,
    expect: `${WB}|1`,
    why: "1ª fatura no tenant da assinatura",
  },
  {
    id: "sub-insert-job-b",
    area: "billing",
    uid: null,
    role: "service_role",
    setup: contacts,
    sql: `${subIns(WB)}; ${invWs}`,
    expect: `${WB}|1`,
    why: "job com tenant explícito: fatura em B",
  },
  {
    id: "sub-paid-next-b",
    area: "billing",
    uid: null,
    role: "service_role",
    setup: `${contacts} ${subIns(WB)};`,
    sql: `${payFirst}; ${invWs}`,
    expect: `${WB},${WB}|2`,
    why: "pagamento gera a próxima fatura no mesmo tenant",
  },
  {
    id: "sub-paid-twice",
    area: "billing",
    uid: null,
    role: "service_role",
    setup: `${contacts} ${subIns(WB)};`,
    sql: `${payFirst}; ${payFirst}; update public.subscription_invoices set status = 'paid' where subscription_id = '${SUB_B}' and status = 'paid'; ${invWs}`,
    expect: `${WB},${WB}|2`,
    why: "repetir 'pago' não gera fatura duplicada",
  },
  {
    id: "sub-adulterated-ws",
    area: "billing",
    uid: OWN_A,
    setup: contacts,
    sql: `${subIns(WB, CT_A, OWN_A)}; select 1`,
    expect: /42501|not a member/,
    why: "membro de A não grava em B",
  },
  {
    id: "sub-removed-member",
    area: "billing",
    uid: REMOVED_A,
    setup: contacts,
    sql: `${subIns(WA, CT_A, REMOVED_A)}; select 1`,
    expect: /42501|not a member|row-level/,
    why: "membro desativado não grava",
  },
  {
    id: "sub-cross-tenant-parent",
    area: "billing",
    uid: ADMIN_B,
    setup: contacts,
    sql: `${subIns(WB, CT_A)}; select 'aceito'`,
    expect: /workspace_mismatch/,
    gap: "aceito",
    why: "assinatura de B apontando para contato de A deveria ser recusada",
  },
  {
    id: "sub-missing-ws-job",
    area: "defaults",
    uid: null,
    role: "service_role",
    setup: contacts,
    sql: `${subIns(null)}; select workspace_id from public.subscriptions where id = '${SUB_B}'`,
    expect: /null value|not-null|23502|workspace/i,
    gap: WORIG,
    why: "job sem tenant explícito deveria falhar; hoje o DEFAULT fixo grava no tenant original",
  },
  {
    id: "lead-missing-ws-user-b",
    area: "defaults",
    uid: ADMIN_B,
    sql: `insert into public.leads (owner_id, first_name) values ('${ADMIN_B}', '[ISO] lead sem ws') returning workspace_id`,
    expect: WB,
    gap: /42501|not a member/,
    why: "usuário de B sem workspace_id explícito: DEFAULT fixo vence o gatilho e a gravação é recusada",
  },
  {
    id: "lead-missing-ws-user-a-compat",
    area: "defaults",
    uid: ADMIN_A,
    sql: `insert into public.service_catalog (owner_id, name) values ('${ADMIN_A}', '[ISO] serviço sem ws A') returning workspace_id`,
    expect: WA,
    gap: /42501|not a member|row-level/,
    why: "cliente antigo (sem workspace_id) continua gravando no workspace ativo do usuário",
  },
  {
    id: "lead-missing-ws-job",
    area: "defaults",
    uid: null,
    role: "service_role",
    sql: `insert into public.leads (owner_id, first_name) values ('${ADMIN_B}', '[ISO] lead job') returning workspace_id`,
    expect: /null value|23502/,
    gap: WORIG,
    why: "leads: gravações de servidor (importação HubSpot) ainda sem tenant — DEFAULT fixo mantido; pendente",
  },
  {
    id: "catalog-missing-ws-job",
    area: "defaults",
    uid: null,
    role: "service_role",
    sql: `insert into public.service_catalog (owner_id, name) values ('${ADMIN_B}', '[ISO] serviço job') returning workspace_id`,
    expect: /null value|23502/,
    gap: WORIG,
    why: "tabela sem gatilho de tenant: job sem tenant falha",
  },
  {
    id: "catalog-user-b",
    area: "defaults",
    uid: ADMIN_B,
    sql: `insert into public.service_catalog (owner_id, name) values ('${ADMIN_B}', '[ISO] serviço B') returning workspace_id`,
    expect: WB,
    gap: /42501|row-level/,
    why: "usuário de B sem tenant explícito grava em B (RLS de inserção continua valendo)",
  },
  {
    id: "activities-missing-ws-job-pending",
    area: "defaults",
    uid: null,
    role: "service_role",
    sql: `insert into public.activities (owner_id, type, subject) values ('${ADMIN_B}', 'note', '[ISO] job') returning workspace_id`,
    expect: /null value|23502/,
    gap: WORIG,
    why: "tabela com 9 gravações de servidor sem tenant: DEFAULT fixo mantido até corrigir os chamadores",
  },
  {
    id: "ticket-pipeline-cross-tenant",
    area: "survey",
    uid: ADMIN_B,
    setup: `${contacts} ${pipeA}`,
    sql: `insert into public.tickets (workspace_id, owner_id, subject) values ('${WB}','${ADMIN_B}','[ISO] sem funil') returning pipeline_id`,
    expect: /pipeline_id/,
    why: "sem funil de chamados em B, nunca herda o funil de A (recusa clara)",
  },
  // ---- histórico/etapas (regressão de 0099) ----
  {
    id: "lead-history-b",
    area: "history",
    uid: ADMIN_B,
    sql: `with l as (insert into public.leads (workspace_id, owner_id, first_name) values ('${WB}', '${ADMIN_B}', '[ISO] lead B') returning id)
          select coalesce((select string_agg(distinct workspace_id::text, ',') from public.stage_entries where entity_id in (select id from l)), 'none')`,
    expect: /^(aaaaaaaa-0000-4000-8000-00000000000b|none)$/,
    why: "etapas do lead de B ficam em B",
  },
  {
    id: "deal-history-b",
    area: "history",
    uid: ADMIN_B,
    sql: `insert into public.deals (id, workspace_id, owner_id, name, value, stage) values ('74000000-0000-4000-8000-0000000000b1','${WB}','${ADMIN_B}','[ISO] deal B',1,'new');
          update public.deals set stage = 'qualified' where id = '74000000-0000-4000-8000-0000000000b1';
          select coalesce((select string_agg(distinct workspace_id::text, ',') from public.stage_entries where entity_id = '74000000-0000-4000-8000-0000000000b1'), 'none')
           || '|' || coalesce((select string_agg(distinct workspace_id::text, ',') from public.property_history where entity_id = '74000000-0000-4000-8000-0000000000b1'), 'none')`,
    expect:
      /^(aaaaaaaa-0000-4000-8000-00000000000b|none)\|(aaaaaaaa-0000-4000-8000-00000000000b|none)$/,
    why: "etapas e histórico do negócio de B nunca vão para outro tenant",
  },
  // ---- ranking do painel (get_sales_dashboard_secondary_v2) ----
  {
    id: "rank-workspace",
    area: "dashboard",
    uid: WS_A,
    sql: rank(WA),
    expect: "[ISO] Negócio A2,[ISO] Negócio A7",
    why: "sem cargo restrito o ranking cobre o workspace",
  },
  {
    id: "rank-own-restricted",
    area: "dashboard",
    uid: OWN_A,
    setup: restrict,
    sql: rank(WA),
    expect: "[ISO] Negócio A2",
    why: "cargo restrito: só os próprios",
  },
  {
    id: "rank-team-restricted",
    area: "dashboard",
    uid: TEAM_A,
    setup: restrict,
    sql: rank(WA),
    expect: "",
    why: "contrato real: restrição por cargo vale só próprio/atribuído, inclusive para líder",
  },
  {
    id: "rank-other-tenant",
    area: "dashboard",
    uid: ADMIN_B,
    sql: rank(WA),
    expect: "",
    why: "workspace adulterado: nada de A",
  },
  {
    id: "rank-b-own",
    area: "dashboard",
    uid: ADMIN_B,
    sql: rank(WB),
    expect: "[ISO] Negócio SegredoB",
    why: "positivo em B",
  },
  // ---- negócios por equipe ----
  {
    id: "deals-team-unrestricted",
    area: "deals",
    uid: TEAM_A,
    sql: dealNames,
    expect: "[ISO] Negócio A2,[ISO] Negócio A7",
    why: "contrato: negócios visíveis no workspace sem cargo restrito",
  },
  {
    id: "deals-team-restricted",
    area: "deals",
    uid: TEAM_A,
    setup: restrict,
    sql: dealNames,
    expect: "",
    why: "cargo restrito: só próprio/atribuído",
  },
  {
    id: "deals-own-restricted",
    area: "deals",
    uid: OWN_A,
    setup: restrict,
    sql: dealNames,
    expect: "[ISO] Negócio A2",
    why: "próprio",
  },
  // ---- Inbox por equipe ----
  {
    id: "inbox-team-no-contact",
    area: "inbox",
    uid: TEAM_A,
    setup: threadA(false),
    sql: seeThread,
    expect: "0",
    why: "e-mail sem contato é privado da caixa, mesmo para líder",
  },
  {
    id: "inbox-owner-no-contact",
    area: "inbox",
    uid: OWN_A,
    setup: threadA(false),
    sql: seeThread,
    expect: "1",
    why: "dono da caixa vê",
  },
  {
    id: "inbox-team-with-contact",
    area: "inbox",
    uid: TEAM_A,
    setup: threadA(true),
    sql: seeThread,
    expect: "1",
    why: "e-mail vinculado a contato é do workspace",
  },
  {
    id: "inbox-b-with-contact",
    area: "inbox",
    uid: ADMIN_B,
    setup: threadA(true),
    sql: seeThread,
    expect: "0",
    why: "outro tenant não vê",
  },
  {
    id: "view-as-user-mode",
    area: "view-as",
    uid: ADMIN_A,
    sql: "select 1",
    expect: "1",
    why: "modo usuário do Ver como emite sessão real do alvo",
    notExecuted:
      "exige GoTrue (emissão de sessão); indisponível no isolado e proibido emitir sessão de terceiro",
  },
];

function runCase(c: Case) {
  if (c.notExecuted)
    return {
      id: c.id,
      area: c.area,
      why: c.why,
      status: "not_executed",
      expected: "",
      actual: c.notExecuted,
      ms: 0,
    };
  const role: Role = c.role ?? (c.uid ? "authenticated" : "anon");
  const claims = JSON.stringify(c.uid ? { sub: c.uid, role } : { role });
  const script = [
    "\\set ON_ERROR_STOP 1",
    "BEGIN;",
    `insert into public.workspaces (id, name, slug, created_by) values ('${WORIG}', '[ISO] Tenant do DEFAULT fixo', 'iso-tenant-default', '${ADMIN_A}') on conflict do nothing;`,
    c.setup ?? "",
    `SET LOCAL ROLE ${role};`,
    `SELECT set_config('request.jwt.claims', '${claims}', true) \\g /dev/null`,
    c.sql + ";",
    "ROLLBACK;",
  ].join("\n");
  const t0 = Date.now();
  const r = spawnSync("psql", ["-X", "-q", "-tA", ...CONN, "-f", "-"], {
    input: script,
    encoding: "utf8",
    env: env as NodeJS.ProcessEnv,
    timeout: 20_000,
  });
  const out = (r.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
  const actual = r.status === 0 ? out : (r.stderr ?? "").trim();
  const match = (e: string | RegExp) =>
    e instanceof RegExp ? e.test(actual) : r.status === 0 && actual === e;
  const status = match(c.expect)
    ? "passed"
    : c.gap !== undefined && match(c.gap)
      ? "known_gap"
      : "failed";
  return {
    id: c.id,
    area: c.area,
    why: c.why,
    status,
    expected: String(c.expect),
    actual: actual.slice(0, 300),
    ms: Date.now() - t0,
  };
}

const ping = spawnSync(
  "psql",
  ["-X", "-tA", ...CONN, "-c", "select label from public.__isolated_marker where id=1"],
  { encoding: "utf8", env: env as NodeJS.ProcessEnv },
);
mkdirSync(`${root}/artifacts`, { recursive: true });
if (ping.stdout?.trim() !== "techerp-isolated-harness") {
  console.error("BLOQUEADO: banco isolado não está rodando (scripts/isolated-db/start.sh)");
  process.exit(2);
}
const results = CASES.map(runCase);
const n = (s: string) => results.filter((r) => r.status === s).length;
const summary = {
  passed: n("passed"),
  failed: n("failed"),
  known_gap: n("known_gap"),
  not_executed: n("not_executed"),
};
writeFileSync(
  `${root}/artifacts/workspace-integrity.json`,
  JSON.stringify({ ...summary, results }, null, 2),
);
const esc = (s: string) =>
  s.replace(/[<&"]/g, (m) => ({ "<": "&lt;", "&": "&amp;", '"': "&quot;" })[m]!);
writeFileSync(
  `${root}/artifacts/workspace-integrity.xml`,
  `<?xml version="1.0"?>\n<testsuite name="isolated-workspace-integrity" tests="${results.length}" failures="${summary.failed}" skipped="${summary.known_gap + summary.not_executed}">\n` +
    results
      .map(
        (r) =>
          `  <testcase classname="${r.area}" name="${esc(r.id)}" time="${r.ms / 1000}">${
            r.status === "failed"
              ? `<failure message="${esc(`esperado ${r.expected}; obtido ${r.actual}`)}"/>`
              : r.status === "passed"
                ? ""
                : `<skipped message="${esc(`${r.status}: ${r.actual}`)}"/>`
          }</testcase>`,
      )
      .join("\n") +
    "\n</testsuite>\n",
);
for (const r of results)
  console.log(
    `${r.status.toUpperCase()} ${r.area}/${r.id}${r.status !== "passed" ? `  esperado=${r.expected} obtido=${r.actual}` : ""}`,
  );
console.log(`\n${JSON.stringify(summary)}`);
process.exit(summary.failed ? 1 : summary.known_gap || summary.not_executed ? 3 : 0);
