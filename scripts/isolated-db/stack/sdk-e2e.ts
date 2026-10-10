// E2E com SDK AUTÊNTICO (@supabase/supabase-js) contra GoTrue + PostgREST reais na stack isolada.
// Login por senha emite JWT real do GoTrue; cada asserção passa por PostgREST com esse JWT, sem
// SET ROLE manual e sem service_role. Tempo real (Realtime) não existe nesta stack: casos ficam
// "not_executed" e o script sai 3 — nunca verde.
// Saída: $ISO_ROOT/artifacts/sdk-e2e.{json,xml}. Exit 0 tudo | 1 falha | 2 bloqueado | 3 incompleto.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const root = process.env.ISO_ROOT ?? "/tmp/techerp-stack";
const port = process.env.ISO_PORT ?? "54330";
const AUTH = `http://127.0.0.1:${process.env.STACK_AUTH_PORT ?? "59999"}`;
const REST = `http://127.0.0.1:${process.env.STACK_REST_PORT ?? "59998"}`;
const anonKey = process.env.STACK_ANON_JWT;
if (!anonKey) {
  console.error("BLOQUEADO: STACK_ANON_JWT ausente (rode via run-e2e.sh)");
  process.exit(2);
}

// Proxy local com o formato de URL do SDK (/auth/v1, /rest/v1). Só 127.0.0.1.
const proxy = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(req) {
    const u = new URL(req.url);
    const target = u.pathname.startsWith("/auth/v1")
      ? AUTH + u.pathname.slice(8)
      : u.pathname.startsWith("/rest/v1")
        ? REST + u.pathname.slice(8)
        : null;
    if (!target) return new Response("not available in isolated stack", { status: 501 });
    const h = new Headers(req.headers);
    h.delete("host");
    return fetch(target + u.search, {
      method: req.method,
      headers: h,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    });
  },
});
const URL_ = `http://127.0.0.1:${proxy.port}`;

function psql(sql: string) {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const k of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "DATABASE_URL"]) delete env[k];
  const r = spawnSync("psql", ["-X", "-qtA", "-v", "ON_ERROR_STOP=1", "-h", `${root}/sock`, "-p", port, "-U", "postgres", "-d", "postgres", "-c", sql], { env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}
if (psql("select label from public.__isolated_marker where id=1") !== "techerp-isolated-harness") {
  console.error("GUARD: marcador ausente");
  process.exit(2);
}

const U = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const EMAIL: Record<number, string> = {
  1: "admin-a@techerp-test.invalid", 2: "own-a@techerp-test.invalid", 3: "team-a@techerp-test.invalid",
  4: "ws-a@techerp-test.invalid", 5: "removed-a@techerp-test.invalid", 6: "admin-b@techerp-test.invalid",
  7: "peer-a@techerp-test.invalid",
};
const WA = "aaaaaaaa-0000-4000-8000-00000000000a", WB = "aaaaaaaa-0000-4000-8000-00000000000b";
const LEAD_A = "50000000-0000-4000-8000-0000000000a1";

// Setup (superusuário só no banco descartável): senha efêmera desta execução.
const PW = randomBytes(18).toString("base64url");
psql(`update auth.users set encrypted_password = extensions.crypt('${PW}', extensions.gen_salt('bf')),
  instance_id = '00000000-0000-0000-0000-000000000000', created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now()),
  confirmation_token = coalesce(confirmation_token,''), recovery_token = coalesce(recovery_token,''),
  email_change_token_new = coalesce(email_change_token_new,''), email_change = coalesce(email_change,''),
  email_change_token_current = coalesce(email_change_token_current,''), phone_change = coalesce(phone_change,''),
  phone_change_token = coalesce(phone_change_token,''), reauthentication_token = coalesce(reauthentication_token,'')
  where email like '%@techerp-test.invalid'`);

const mk = () => createClient(URL_, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(n: number): Promise<SupabaseClient> {
  const c = mk();
  const { error } = await c.auth.signInWithPassword({ email: EMAIL[n], password: PW });
  if (error) throw new Error(`login ${n}: ${error.message}`);
  return c;
}

type R = { id: string; area: string; status: "pass" | "fail" | "not_executed"; detail: string; why: string };
const results: R[] = [];
async function check(id: string, area: string, why: string, fn: () => Promise<string>, expect: string | RegExp) {
  let got: string;
  try { got = await fn(); } catch (e) { got = `ERR ${(e as Error).message}`; }
  const ok = typeof expect === "string" ? got === expect : expect.test(got);
  results.push({ id, area, status: ok ? "pass" : "fail", detail: `got=${got} expect=${expect}`, why });
}
const subjects = async (c: SupabaseClient) => {
  const { data, error } = await c.from("activities").select("subject").eq("related_lead_id", LEAD_A).order("subject");
  if (error) return `ERR ${error.message}`;
  return (data ?? []).map((r) => r.subject).join(",");
};
const count = async (c: SupabaseClient, t: string, f?: [string, string]) => {
  let q = c.from(t).select("id", { count: "exact", head: true });
  if (f) q = q.eq(f[0], f[1]);
  const { count: n, error } = await q;
  return error ? `ERR ${error.message}` : String(n);
};

const s: Record<number, SupabaseClient> = {};
for (const n of [1, 2, 3, 4, 6, 7]) s[n] = await signIn(n);

// Identidade: o JWT do GoTrue carrega o sub real e o papel authenticated.
await check("jwt-identity", "auth", "token real do GoTrue", async () => {
  const { data } = await s[2].auth.getUser();
  return `${data.user?.id}|${data.user?.role}`;
}, `${U(2)}|authenticated`);
await check("login-wrong-password", "auth", "senha errada recusada pelo GoTrue", async () => {
  const { error } = await mk().auth.signInWithPassword({ email: EMAIL[2], password: "x" + PW });
  return error ? "refused" : "accepted";
}, "refused");

const ALL = "[ISO] nota admin,[ISO] nota par,[ISO] nota propria";
await check("act-admin", "timeline", "admin vê o workspace", () => subjects(s[1]), ALL);
await check("act-own", "timeline", "escopo próprio", () => subjects(s[2]), "[ISO] nota propria");
await check("act-team", "timeline", "escopo equipe", () => subjects(s[3]), "[ISO] nota par");
await check("act-ws", "timeline", "escopo workspace", () => subjects(s[4]), ALL);
await check("act-other-tenant", "timeline", "admin de B não vê A", () => subjects(s[6]), "");
await check("act-anon", "timeline", "anônimo", () => subjects(mk()), /^$|ERR .*permission denied/);
await check("tl-rpc-own", "timeline", "RPC paginada própria", async () => {
  const { data, error } = await s[2].rpc("get_timeline_activity_page", { p_entity_kind: "lead", p_entity_id: LEAD_A });
  return error ? `ERR ${error.message}` : String((data as { total?: number })?.total);
}, "1");
await check("deal-b-from-a", "deals", "negócio de B invisível para A", () => count(s[1], "deals", ["workspace_id", WB]), "0");
await check("deal-own", "deals", "dono vê o seu", () => count(s[2], "deals", ["id", "51000000-0000-4000-8000-0000000000a1"]), "1");
await check("inbox-own", "inbox", "dono vê conversas", async () => {
  const { data, error } = await s[2].rpc("get_inbox_unified_page", { p_channel: "all", p_search: null });
  return error ? `ERR ${error.message}` : String(((data as { items?: unknown[] })?.items ?? []).length > 0);
}, "true");
await check("inbox-search-leak", "inbox", "busca não vaza B", async () => {
  const { data, error } = await s[2].rpc("get_inbox_unified_page", { p_channel: "all", p_search: "SegredoB" });
  return error ? `ERR ${error.message}` : String(((data as { items?: unknown[] })?.items ?? []).length);
}, "0");
await check("wa-other", "whatsapp", "mensagem WA de B", () => count(s[2], "whatsapp_messages", ["id", "58000000-0000-4000-8000-0000000000b6"]), "0");
await check("email-other", "email", "e-mail de B", () => count(s[1], "email_messages", ["workspace_id", WB]), "0");
await check("chat-member", "chat", "membro do chat", () => count(s[7], "chat_messages"), "1");
await check("chat-non-member", "chat", "não membro", () => count(s[4], "chat_messages"), "0");
await check("brand-member", "branding", "lê só o seu", () => count(s[2], "workspace_branding"), "1");
await check("brand-other", "branding", "outro tenant", () => count(s[6], "workspace_branding", ["workspace_id", WA]), "0");
await check("brand-member-write", "branding", "membro comum não altera", async () => {
  const { data, error } = await s[2].from("workspace_branding").update({ primary_color: "#000000" }).eq("workspace_id", WA).select("workspace_id");
  return error ? `ERR ${error.message}` : String(data?.length ?? 0);
}, /^0$|ERR/);
await check("insert-other-ws", "write", "inserir em B recusado", async () => {
  const { error } = await s[2].from("activities").insert({ workspace_id: WB, owner_id: U(2), type: "note", subject: "x" });
  return error ? `ERR ${error.message}` : "inserted";
}, /ERR .*(row-level security|denied)/);
await check("insert-lead-own-ws", "write", "lead no próprio tenant", async () => {
  const { error } = await s[1].from("leads").insert({ workspace_id: WA, owner_id: U(1), first_name: "[ISO] E2E" });
  return error ? `ERR ${error.message}` : "ok";
}, "ok");

// Removido: login funciona até ser banido; sem dados quando inativo; banido não entra.
const s5 = await signIn(5);
await check("removed-inactive", "revoke", "inativo sem dados", () => subjects(s5), "");
psql(`update auth.users set banned_until = now() + interval '1 day' where id = '${U(5)}'`);
await check("removed-banned-login", "revoke", "banido recusado pelo GoTrue", async () => {
  const { error } = await mk().auth.signInWithPassword({ email: EMAIL[5], password: PW });
  return error ? "refused" : "accepted";
}, "refused");
// Revogação no meio da sessão: inativar 4 e reconsultar com o MESMO token.
psql(`update public.workspace_members set status='inactive' where user_id='${U(4)}' and workspace_id='${WA}'`);
await check("revoke-midstream", "revoke", "mesmo token perde acesso na próxima consulta", () => subjects(s[4]), "");
psql(`update public.workspace_members set status='active' where user_id='${U(4)}' and workspace_id='${WA}'`);
psql(`update auth.users set banned_until = null where id = '${U(5)}'`);
await check("signout", "auth", "logout encerra sessão no GoTrue", async () => {
  const c = await signIn(7);
  await c.auth.signOut();
  const { data } = await c.auth.getSession();
  return data.session ? "still" : "none";
}, "none");

for (const [id, why] of [
  ["rt-subscribe-own", "Realtime ausente na stack (não empacotado no nixpkgs)"],
  ["rt-filter-other-tenant", "Realtime ausente"],
  ["rt-reconnect", "Realtime ausente"],
  ["rt-delete-event", "Realtime ausente"],
  ["ui-event-to-screen", "depende de Realtime + app apontado para a stack"],
  ["view-as-gotrue-session", "fluxo Ver como usa servidor do app com chave administrativa; não ligado à stack"],
] as const)
  results.push({ id, area: "realtime/ui", status: "not_executed", detail: why, why });

proxy.stop(true);
const pass = results.filter((r) => r.status === "pass").length;
const fail = results.filter((r) => r.status === "fail").length;
const ne = results.filter((r) => r.status === "not_executed").length;
mkdirSync(`${root}/artifacts`, { recursive: true });
writeFileSync(`${root}/artifacts/sdk-e2e.json`, JSON.stringify({ pass, fail, not_executed: ne, results }, null, 2));
const esc = (x: string) => x.replace(/[<&"]/g, (c) => ({ "<": "&lt;", "&": "&amp;", '"': "&quot;" })[c]!);
writeFileSync(`${root}/artifacts/sdk-e2e.xml`, `<?xml version="1.0"?>\n<testsuite name="sdk-e2e" tests="${results.length}" failures="${fail}" skipped="${ne}">\n${results
  .map((r) => `  <testcase classname="${r.area}" name="${esc(r.id)}">${r.status === "fail" ? `<failure message="${esc(r.detail)}"/>` : r.status === "not_executed" ? `<skipped message="${esc(r.detail)}"/>` : ""}</testcase>`)
  .join("\n")}\n</testsuite>\n`);
for (const r of results) if (r.status !== "pass") console.log(`${r.status.toUpperCase()} ${r.id}: ${r.detail}`);
console.log(`sdk-e2e: ${pass} passaram, ${fail} falharam, ${ne} não executados`);
process.exit(fail ? 1 : ne ? 3 : 0);
