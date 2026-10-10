// Matriz de permissões no banco ISOLADO com schema/policies/funções reais.
// Cada caso roda numa transação que termina em ROLLBACK, como o PostgREST faz:
//   SET LOCAL ROLE authenticated|anon + request.jwt.claims (sub, role, session_id).
// Nunca usa service_role/superusuário para a asserção (só no "setup" do próprio caso).
// Saída: $ISO_ROOT/artifacts/permission-matrix.{json,xml}. Exit 1 se falhar; 2 se bloqueado.
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
const U = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const ADMIN_A = U(1),
  OWN_A = U(2),
  TEAM_A = U(3),
  WS_A = U(4),
  REMOVED_A = U(5),
  ADMIN_B = U(6),
  PEER_A = U(7);
const LEAD_A = "50000000-0000-4000-8000-0000000000a1",
  LEAD_B = "50000000-0000-4000-8000-0000000000b1";
const VIEW_AS_SESSION = "60000000-0000-4000-8000-0000000000a1";

type Who = { uid: string | null; sessionId?: string };
type Case = {
  id: string;
  area: string;
  as: Who;
  setup?: string;
  sql: string;
  expect: string | RegExp;
  why: string;
};
const as = (uid: string | null, sessionId?: string): Who => ({ uid, sessionId });

const actOnLeadA = `select coalesce(string_agg(subject, ',' order by subject), '') from public.activities where related_lead_id = '${LEAD_A}'`;
const tlA = `select (public.get_timeline_activity_page('lead', '${LEAD_A}'::uuid) ->> 'total')`;
const histA = `select (public.get_timeline_history_page('leads', '${LEAD_A}'::uuid) ->> 'total')`;
const histB = `select (public.get_timeline_history_page('leads', '${LEAD_B}'::uuid) ->> 'total')`;
const inbox = (search: string) =>
  `select count(*) from jsonb_array_elements(public.get_inbox_unified_page('all', ${search ? `'${search}'` : "null"}) -> 'items')`;
const dealAgg = (
  ws: string,
) => `select public.get_sales_dashboard_deal_aggregates('${ws}'::uuid, null, 'all', null,
  array[]::text[], array['won']::text[], array['lost']::text[], '{}'::jsonb, now() - interval '1 year', now() + interval '1 day',
  now() - interval '2 year', now() - interval '1 year', now() - interval '1 month', now() + interval '1 day')::text ~ '99000'`;

const CASES: Case[] = [
  // ---- timeline: atividades (tabela e RPC) ----
  {
    id: "act-admin",
    area: "timeline",
    as: as(ADMIN_A),
    sql: actOnLeadA,
    expect: "[ISO] nota admin,[ISO] nota par,[ISO] nota propria",
    why: "admin vê todo o workspace",
  },
  {
    id: "act-own",
    area: "timeline",
    as: as(OWN_A),
    sql: actOnLeadA,
    expect: "[ISO] nota propria",
    why: "escopo próprio só o seu",
  },
  {
    id: "act-team",
    area: "timeline",
    as: as(TEAM_A),
    sql: actOnLeadA,
    expect: "[ISO] nota par",
    why: "escopo equipe vê o par do mesmo time, não o 2",
  },
  {
    id: "act-ws",
    area: "timeline",
    as: as(WS_A),
    sql: actOnLeadA,
    expect: "[ISO] nota admin,[ISO] nota par,[ISO] nota propria",
    why: "escopo workspace",
  },
  {
    id: "act-removed",
    area: "timeline",
    as: as(REMOVED_A),
    sql: actOnLeadA,
    expect: "",
    why: "membro inativo perde acesso",
  },
  {
    id: "act-other-tenant",
    area: "timeline",
    as: as(ADMIN_B),
    sql: actOnLeadA,
    expect: "",
    why: "admin de outro tenant não vê A",
  },
  {
    id: "act-anon",
    area: "timeline",
    as: as(null),
    sql: actOnLeadA,
    expect: /permission denied|^$/,
    why: "anônimo sem acesso",
  },
  {
    id: "tl-rpc-own",
    area: "timeline",
    as: as(OWN_A),
    sql: tlA,
    expect: "1",
    why: "RPC respeita RLS (total)",
  },
  { id: "tl-rpc-team", area: "timeline", as: as(TEAM_A), sql: tlA, expect: "1", why: "RPC equipe" },
  {
    id: "tl-rpc-admin",
    area: "timeline",
    as: as(ADMIN_A),
    sql: tlA,
    expect: "3",
    why: "RPC admin",
  },
  {
    id: "tl-rpc-other",
    area: "timeline",
    as: as(ADMIN_B),
    sql: tlA,
    expect: "0",
    why: "RPC outro tenant com id direto",
  },
  {
    id: "tl-rpc-search-leak",
    area: "timeline",
    as: as(ADMIN_A),
    sql: `select (public.get_timeline_activity_page('lead', '${LEAD_B}'::uuid, p_search => 'SegredoB') ->> 'total')`,
    expect: "0",
    why: "busca por texto do outro tenant",
  },
  {
    id: "hist-a-admin",
    area: "timeline",
    as: as(ADMIN_A),
    sql: histA,
    expect: /^[1-9]/,
    why: "histórico do lead A",
  },
  {
    id: "hist-b-from-a",
    area: "timeline",
    as: as(ADMIN_A),
    sql: histB,
    expect: "0",
    why: "histórico B por id direto",
  },
  {
    id: "hist-a-removed",
    area: "timeline",
    as: as(REMOVED_A),
    sql: histA,
    expect: "0",
    why: "removido sem histórico",
  },
  {
    id: "cal-other",
    area: "timeline",
    as: as(ADMIN_B),
    sql: `select (public.get_timeline_calendar_page('lead', '${LEAD_A}'::uuid) ->> 'total')`,
    expect: /^(0|)$/,
    why: "agenda de outro tenant",
  },
  {
    id: "email-detail-owner",
    area: "timeline",
    as: as(OWN_A),
    sql: `select count(*) from public.email_messages where id = '56000000-0000-4000-8000-0000000000a2'`,
    expect: "1",
    why: "dono lê o corpo",
  },
  {
    id: "email-detail-ws-member",
    area: "timeline",
    as: as(WS_A),
    sql: `select count(*) from public.email_messages where id = '56000000-0000-4000-8000-0000000000a2'`,
    expect: "0",
    why: "caixa pessoal: colega sem acesso",
  },
  {
    id: "email-detail-other",
    area: "timeline",
    as: as(ADMIN_A),
    sql: `select count(*) from public.email_messages where id = '56000000-0000-4000-8000-0000000000b6'`,
    expect: "0",
    why: "e-mail B por id direto",
  },
  {
    id: "email-detail-removed-admin",
    area: "timeline",
    as: as(REMOVED_A),
    setup: `update public.workspace_members set role = 'admin' where user_id = '${REMOVED_A}' and workspace_id = '${WA}';`,
    sql: `select count(*) from public.email_messages where id = '56000000-0000-4000-8000-0000000000a2'`,
    expect: "0",
    why: "admin desativado não lê e-mail de membros",
  },
  // ---- dashboard ----
  {
    id: "dash-tampered-ws",
    area: "dashboard",
    as: as(ADMIN_A),
    sql: dealAgg(WB),
    expect: "f",
    why: "workspace adulterado no parâmetro não traz valores de B",
  },
  {
    id: "dash-own-ws-b",
    area: "dashboard",
    as: as(ADMIN_B),
    sql: dealAgg(WB),
    expect: "t",
    why: "positivo: B vê os próprios agregados",
  },
  {
    id: "dash-metrics-anon",
    area: "dashboard",
    as: as(null),
    sql: `select public.dashboard_metrics()::text ~ '99000'`,
    expect: /^f$|permission denied/,
    why: "anônimo",
  },
  // ---- inbox ----
  {
    id: "inbox-own",
    area: "inbox",
    as: as(OWN_A),
    sql: inbox(""),
    expect: /^[1-9]/,
    why: "positivo: dono vê suas conversas",
  },
  {
    id: "inbox-search-leak",
    area: "inbox",
    as: as(ADMIN_A),
    sql: inbox("SegredoB"),
    expect: "0",
    why: "busca não vaza B",
  },
  {
    id: "inbox-b-search-a",
    area: "inbox",
    as: as(ADMIN_B),
    sql: inbox("Assunto A"),
    expect: "0",
    why: "B não acha e-mail de A",
  },
  {
    id: "inbox-removed",
    area: "inbox",
    as: as(REMOVED_A),
    sql: inbox(""),
    expect: "0",
    why: "removido sem inbox",
  },
  {
    id: "inbox-channel-tampered",
    area: "inbox",
    as: as(ADMIN_A),
    sql: `select count(*) from jsonb_array_elements(public.get_inbox_channel_page('whatsapp', 'all', null, '${WB}'::uuid) -> 'items') i where i->>'id' like '%b6'`,
    expect: /^0$|not a member|denied/,
    why: "workspace adulterado no canal",
  },
  {
    id: "wa-msg-other",
    area: "inbox",
    as: as(ADMIN_A),
    sql: `select count(*) from public.whatsapp_messages where id = '58000000-0000-4000-8000-0000000000b6'`,
    expect: "0",
    why: "mensagem WA de B",
  },
  {
    id: "chat-non-member",
    area: "inbox",
    as: as(WS_A),
    sql: `select count(*) from public.chat_messages`,
    expect: "0",
    why: "chat privado: não membro",
  },
  {
    id: "chat-member",
    area: "inbox",
    as: as(PEER_A),
    sql: `select count(*) from public.chat_messages`,
    expect: "1",
    why: "positivo: membro do chat",
  },
  // ---- branding ----
  {
    id: "brand-member",
    area: "branding",
    as: as(OWN_A),
    sql: `select count(*) from public.workspace_branding`,
    expect: "1",
    why: "membro lê só o seu",
  },
  {
    id: "brand-other",
    area: "branding",
    as: as(ADMIN_B),
    sql: `select count(*) from public.workspace_branding where workspace_id = '${WA}'`,
    expect: "0",
    why: "outro tenant",
  },
  {
    id: "brand-removed",
    area: "branding",
    as: as(REMOVED_A),
    sql: `select count(*) from public.workspace_branding`,
    expect: "0",
    why: "removido",
  },
  {
    id: "brand-member-write",
    area: "branding",
    as: as(OWN_A),
    sql: `with u as (update public.workspace_branding set primary_color = '#000000' returning 1) select count(*) from u`,
    expect: "0",
    why: "membro comum não altera",
  },
  {
    id: "module-brand-other",
    area: "branding",
    as: as(ADMIN_B),
    sql: `select count(*) from public.module_branding where workspace_id = '${WA}'`,
    expect: "0",
    why: "módulo de outro tenant",
  },
  {
    id: "brand-anon",
    area: "branding",
    as: as(null),
    sql: `select count(*) from public.workspace_branding`,
    expect: /^0$|permission denied/,
    why: "anônimo",
  },
  // ---- escrita / adulteração / revogação / troca / Ver como ----
  {
    id: "insert-other-ws",
    area: "write",
    as: as(OWN_A),
    sql: `insert into public.activities (workspace_id, owner_id, type, subject) values ('${WB}', '${OWN_A}', 'note', 'x') returning 1`,
    expect: /row-level security|denied/,
    why: "inserir em B",
  },
  {
    id: "insert-lead-own-ws",
    area: "write",
    as: as(ADMIN_A),
    sql: `insert into public.leads (workspace_id, owner_id, first_name) values ('${WA}', '${ADMIN_A}', 'Novo') returning 'ok'`,
    expect: "ok",
    why: "regressão 0099: criar lead fora do tenant original",
  },
  {
    id: "revoke-midstream",
    area: "write",
    as: as(WS_A),
    setup: `update public.workspace_members set status = 'inactive' where user_id = '${WS_A}';`,
    sql: actOnLeadA,
    expect: "",
    why: "revogação vale na próxima consulta",
  },
  {
    id: "identity-switch",
    area: "write",
    as: as(ADMIN_A),
    sql: `select (${actOnLeadA.replace("string_agg(subject, ',' order by subject), ''", "count(*)::text, '0'")}) || '|' || (select set_config('request.jwt.claims', '{"sub":"${ADMIN_B}","role":"authenticated"}', true) is not null)::text || '|' || (select count(*) from public.activities where related_lead_id = '${LEAD_A}')`,
    expect: "3|true|0",
    why: "mesma conexão: trocar a identidade troca o acesso já na consulta seguinte",
  },
  {
    id: "view-as-role-readonly",
    area: "view-as",
    as: as(OWN_A, VIEW_AS_SESSION),
    setup: `insert into public.view_as_sessions (workspace_id, admin_id, target_user_id, mode, nonce, session_id) values ('${WA}', '${ADMIN_A}', '${OWN_A}', 'role', 'iso', '${VIEW_AS_SESSION}');`,
    sql: `with u as (update public.activities set subject = 'x' where id = '52000000-0000-4000-8000-0000000000a2' returning 1) select count(*) from u`,
    expect: "0",
    why: "sessão de papel não altera registro real",
  },
  {
    id: "view-as-without-session",
    area: "view-as",
    as: as(OWN_A),
    sql: `with u as (update public.activities set subject = subject where id = '52000000-0000-4000-8000-0000000000a2' returning 1) select count(*) from u`,
    expect: "0",
    why: "escopo próprio sem update.own no conjunto: negado mesmo fora do Ver como",
  },
];

function runCase(c: Case) {
  const claims = c.as.uid
    ? JSON.stringify({
        sub: c.as.uid,
        role: "authenticated",
        ...(c.as.sessionId ? { session_id: c.as.sessionId } : {}),
      })
    : JSON.stringify({ role: "anon" });
  const role = c.as.uid ? "authenticated" : "anon";
  const script = [
    "\\set ON_ERROR_STOP 1",
    "BEGIN;",
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
  const err = (r.stderr ?? "").trim();
  const actual = r.status === 0 ? out : err;
  const pass =
    c.expect instanceof RegExp ? c.expect.test(actual) : r.status === 0 && actual === c.expect;
  return {
    id: c.id,
    area: c.area,
    why: c.why,
    status: pass ? "passed" : "failed",
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
  const blocked = CASES.map((c) => ({
    id: c.id,
    area: c.area,
    status: "blocked",
    why: "banco isolado indisponível",
  }));
  writeFileSync(
    `${root}/artifacts/permission-matrix.json`,
    JSON.stringify({ blocked: blocked.length, results: blocked }, null, 2),
  );
  console.error("BLOQUEADO: banco isolado não está rodando (scripts/isolated-db/start.sh)");
  process.exit(2);
}
const results = CASES.map(runCase);
const failed = results.filter((r) => r.status === "failed");
const esc = (s: string) =>
  s.replace(/[<&"]/g, (m) => ({ "<": "&lt;", "&": "&amp;", '"': "&quot;" })[m]!);
writeFileSync(
  `${root}/artifacts/permission-matrix.json`,
  JSON.stringify(
    { passed: results.length - failed.length, failed: failed.length, skipped: 0, results },
    null,
    2,
  ),
);
writeFileSync(
  `${root}/artifacts/permission-matrix.xml`,
  `<?xml version="1.0"?>\n<testsuite name="isolated-permission-matrix" tests="${results.length}" failures="${failed.length}" skipped="0">\n` +
    results
      .map(
        (r) =>
          `  <testcase classname="${r.area}" name="${esc(r.id)}" time="${r.ms / 1000}">${r.status === "failed" ? `<failure message="${esc(`esperado ${r.expected}; obtido ${r.actual}`)}"/>` : ""}</testcase>`,
      )
      .join("\n") +
    "\n</testsuite>\n",
);
for (const r of results)
  console.log(
    `${r.status === "passed" ? "PASS" : "FAIL"} ${r.area}/${r.id}${r.status === "failed" ? `  esperado=${r.expected} obtido=${r.actual}` : ""}`,
  );
console.log(`\n${results.length - failed.length}/${results.length} passaram`);
process.exit(failed.length ? 1 : 0);
