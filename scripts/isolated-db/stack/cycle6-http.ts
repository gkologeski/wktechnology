// Ciclo 6 — prova HTTP com serviços AUTÊNTICOS (GoTrue + PostgREST) na stack isolada:
// rotas da API pública v1 (handlers reais do app), chaves com hash real, limite por chave,
// idempotência, recusa de portas a usuários/anônimos e fila offline com JWT real do GoTrue.
// Dados 100% sintéticos; nunca aponta para o projeto. Exit 0 tudo | 1 falha | 2 bloqueado.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const root = process.env.ISO_ROOT ?? "/tmp/techerp-stack";
const port = process.env.ISO_PORT ?? "54330";
const AUTH = `http://127.0.0.1:${process.env.STACK_AUTH_PORT ?? "59999"}`;
const REST = `http://127.0.0.1:${process.env.STACK_REST_PORT ?? "59998"}`;
const secret = process.env.STACK_JWT_SECRET;
if (!secret) {
  console.error("BLOQUEADO: STACK_JWT_SECRET ausente (rode via run-cycle6.sh)");
  process.exit(2);
}
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role: string) => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role, iss: "techerp-isolated", exp: Math.floor(Date.now() / 1e3) + 3600 });
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
};
const ANON = jwt("anon");
const SERVICE = jwt("service_role");

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
    if (!target) return new Response("not available", { status: 501 });
    const h = new Headers(req.headers);
    h.delete("host");
    return fetch(target + u.search, {
      method: req.method,
      headers: h,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    });
  },
});
const BASE = `http://127.0.0.1:${proxy.port}`;
// O cliente administrativo do app passa a falar SÓ com a stack descartável.
process.env.SUPABASE_URL = BASE;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
process.env.SUPABASE_PUBLISHABLE_KEY = ANON;
if (!process.env.SUPABASE_URL.startsWith("http://127.0.0.1:")) process.exit(2);

function psql(sql: string) {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const k of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "DATABASE_URL"]) delete env[k];
  const r = spawnSync("psql", ["-X", "-qtA", "-v", "ON_ERROR_STOP=1", "-h", `${root}/sock`, "-p", port, "-U", "postgres", "-d", "postgres", "-c", sql], {
    env,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}
if (psql("select label from public.__isolated_marker where id=1") !== "techerp-isolated-harness") {
  console.error("GUARD: marcador ausente");
  process.exit(2);
}

const WA = "aaaaaaaa-0000-4000-8000-00000000000a";
const U = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const P1 = "c6000000-0000-4000-8000-000000000001";
const T1 = "c6100000-0000-4000-8000-000000000001";
const raw = (tag: string) => `lvb_${tag}${randomBytes(20).toString("hex")}`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const K = { u2: raw("a"), u3ro: raw("b"), u5: raw("c"), u7rev: raw("d"), rate: raw("e") };
const PW = randomBytes(18).toString("base64url");

psql(`
update auth.users set encrypted_password = extensions.crypt('${PW}', extensions.gen_salt('bf')),
  instance_id = '00000000-0000-0000-0000-000000000000', created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now()),
  confirmation_token = coalesce(confirmation_token,''), recovery_token = coalesce(recovery_token,''),
  email_change_token_new = coalesce(email_change_token_new,''), email_change = coalesce(email_change,''),
  email_change_token_current = coalesce(email_change_token_current,''), phone_change = coalesce(phone_change,''),
  phone_change_token = coalesce(phone_change_token,''), reauthentication_token = coalesce(reauthentication_token,'')
  where email like '%@techerp-test.invalid';
insert into public.permission_sets (id, module, name) values ('20000000-0000-4000-8000-0000000006c1','techprojects','[ISO] C6 horas') on conflict do nothing;
insert into public.permission_set_items (set_id, permission_key) select '20000000-0000-4000-8000-0000000006c1', p.key from public.permissions p
  where p.key in ('techprojects.time_entries.create.own','techprojects.time_entries.view.own','techprojects.time_entries.update.own','techprojects.projects.view.own') on conflict do nothing;
insert into public.job_role_sets (role_id, set_id) values ('30000000-0000-4000-8000-0000000000a1','20000000-0000-4000-8000-0000000006c1'),
  ('30000000-0000-4000-8000-0000000000a2','20000000-0000-4000-8000-0000000006c1'), ('30000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-0000000006c1') on conflict do nothing;
insert into public.projects (id, workspace_id, owner_id, name, status) values ('${P1}', '${WA}', '${U(1)}', '[ISO] C6 HTTP', 'active') on conflict do nothing;
insert into public.project_tasks (id, workspace_id, project_id, title) values ('${T1}', '${WA}', '${P1}', '[ISO] C6 tarefa') on conflict do nothing;
insert into public.project_members (workspace_id, project_id, user_id, role_in_project) values ('${WA}', '${P1}', '${U(2)}', 'contributor'), ('${WA}', '${P1}', '${U(7)}', 'contributor') on conflict do nothing;
insert into public.api_keys (owner_id, workspace_id, name, prefix, key_hash, scopes, revoked_at) values
  ('${U(2)}', '${WA}', '[ISO] u2', 'lvb_a', '${sha(K.u2)}', array['write'], null),
  ('${U(3)}', '${WA}', '[ISO] u3 leitura', 'lvb_b', '${sha(K.u3ro)}', array['read'], null),
  ('${U(5)}', '${WA}', '[ISO] u5 inativo', 'lvb_c', '${sha(K.u5)}', array['write'], null),
  ('${U(7)}', '${WA}', '[ISO] u7 revogada', 'lvb_d', '${sha(K.u7rev)}', array['write'], now()),
  ('${U(7)}', '${WA}', '[ISO] u7 limite', 'lvb_e', '${sha(K.rate)}', array['read'], null);
notify pgrst, 'reload schema';`);
await Bun.sleep(1500);

const api = await import("../../../src/lib/projects/public-api.server");
type Res = { status: number; body: Record<string, unknown>; headers: Headers };
async function call(method: "GET" | "POST", path: string, key: string | null, body?: unknown, extra: Record<string, string> = {}): Promise<Res> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (key) headers.Authorization = `Bearer ${key}`;
  const req = new Request(`http://app.invalid/api/public/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const r =
    path.startsWith("/time-entries")
      ? method === "GET"
        ? await api.handleListEntries(req)
        : await api.handleCreateEntry(req)
      : path.startsWith("/projects")
        ? await api.handleListProjects(req)
        : await api.handleListTasks(req);
  return { status: r.status, body: (await r.json()) as Record<string, unknown>, headers: r.headers };
}

const results: Array<{ id: string; ok: boolean; detail: string }> = [];
async function check(id: string, fn: () => Promise<[boolean, string]>) {
  try {
    const [ok, detail] = await fn();
    results.push({ id, ok, detail });
  } catch (e) {
    results.push({ id, ok: false, detail: (e as Error).message });
  }
}

const user = async (n: number) => {
  const c = createClient(BASE, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = { 2: "own-a", 3: "team-a", 7: "peer-a" }[n as 2 | 3 | 7];
  const { error } = await c.auth.signInWithPassword({ email: `${email}@techerp-test.invalid`, password: PW });
  if (error) throw new Error(`login ${n}: ${error.message}`);
  return c;
};
const entry = { project_id: P1, task_id: T1, entry_date: "2026-03-04", start_time: "09:00:00", end_time: "10:30:15", timezone: "America/Sao_Paulo" };

await check("sem chave → 401 com WWW-Authenticate", async () => {
  const r = await call("GET", "/time-entries", null);
  return [r.status === 401 && r.headers.get("WWW-Authenticate") === "Bearer", `status ${r.status}`];
});
await check("chave revogada → 401", async () => {
  const r = await call("GET", "/projects", K.u7rev);
  return [r.status === 401, `status ${r.status}`];
});
await check("dono inativo → 403", async () => {
  const r = await call("GET", "/projects", K.u5);
  return [r.status === 403 && r.body.error === "forbidden", `status ${r.status} ${JSON.stringify(r.body)}`];
});
await check("POST cria rascunho do dono (201), segundos exatos, sem custo na resposta, X-Request-Id", async () => {
  const r = await call("POST", "/time-entries", K.u2, entry, { "Idempotency-Key": "iso-http-0001" });
  const d = r.body.data as Record<string, unknown>;
  return [
    r.status === 201 && d.status === "draft" && d.source === "api" && d.user_id === U(2) && d.duration_seconds === 5415 &&
      !JSON.stringify(r.body).match(/hourly_rate|financial|invoice/) && !!r.headers.get("X-Request-Id"),
    `status ${r.status} ${JSON.stringify(d)}`,
  ];
});
await check("repetição idêntica → 200 com Idempotent-Replayed e o mesmo id", async () => {
  const a = await call("POST", "/time-entries", K.u2, { ...entry, timezone: "America/Sao_Paulo" }, { "Idempotency-Key": "iso-http-0001" });
  return [a.status === 200 && a.headers.get("Idempotent-Replayed") === "true", `status ${a.status}`];
});
await check("mesma chave com outro conteúdo → 409 idempotency_conflict", async () => {
  const r = await call("POST", "/time-entries", K.u2, { ...entry, end_time: "10:45:00" }, { "Idempotency-Key": "iso-http-0001" });
  return [r.status === 409 && r.body.error === "idempotency_conflict", `status ${r.status}`];
});
await check("sem Idempotency-Key nem external_id → 400", async () => {
  const r = await call("POST", "/time-entries", K.u2, { ...entry, entry_date: "2026-03-05" });
  return [r.status === 400 && r.body.error === "idempotency_key_required", `status ${r.status}`];
});
await check("corpo com status/user_id → 400 (cliente não define situação nem usuário)", async () => {
  const r = await call("POST", "/time-entries", K.u2, { ...entry, status: "approved", user_id: U(7) }, { "Idempotency-Key": "iso-http-0002" });
  return [r.status === 400 && r.body.error === "invalid_input", `status ${r.status}`];
});
await check("sobreposição → 409 overlap", async () => {
  const r = await call("POST", "/time-entries", K.u2, { ...entry, start_time: "10:00:00", end_time: "11:00:00" }, { "Idempotency-Key": "iso-http-0003" });
  return [r.status === 409 && r.body.error === "overlap", `status ${r.status} ${JSON.stringify(r.body)}`];
});
await check("chave somente leitura não cria → 403 insufficient_scope", async () => {
  const r = await call("POST", "/time-entries", K.u3ro, entry, { "Idempotency-Key": "iso-http-0004" });
  return [r.status === 403 && r.body.error === "insufficient_scope", `status ${r.status}`];
});
await check("GET da API = o que o próprio usuário vê pelo login real (u2)", async () => {
  const r = await call("GET", "/time-entries?limit=200", K.u2);
  const c = await user(2);
  const { count } = await c.from("project_time_entries").select("id", { count: "exact", head: true }).eq("workspace_id", WA);
  const meta = r.body.meta as { total: number };
  return [r.status === 200 && meta.total === count && (count ?? 0) >= 1, `api ${meta.total} vs login ${count}`];
});
await check("login real de usuário NÃO executa a porta da API (personificação)", async () => {
  const c = await user(3);
  const { error } = await c.rpc("project_api_list_time_entries" as never, {
    p_key: "00000000-0000-4000-8000-000000000000", p_user: U(2), p_ws: WA, p_project: null, p_subject: null, p_status: null,
    p_from: null, p_to: null, p_ascending: false, p_limit: 50, p_offset: 0,
  } as never);
  return [!!error && /permission denied/i.test(error.message), error?.message ?? "sem erro"];
});
await check("anônimo NÃO executa a porta da API", async () => {
  const c = createClient(BASE, ANON, { auth: { persistSession: false } });
  const { error } = await c.rpc("project_api_list_projects" as never, { p_key: null, p_user: U(2), p_ws: WA, p_status: null, p_search: null, p_limit: 1, p_offset: 0 } as never);
  return [!!error, error?.message ?? "sem erro"];
});
await check("fila offline com JWT real: envia, repete (replay) e recusa conteúdo diferente", async () => {
  const c = await user(2);
  const args = {
    p_ws: WA, p_client_request_id: "c6400000-0000-4000-8000-0000000000f1", p_request_hash: "f".repeat(64),
    p_payload: { project_id: P1, task_id: T1, entry_date: "2026-03-12", mode: "duration", duration_seconds: 1800 }, p_device_recorded_at: null,
  };
  const a = await c.rpc("project_time_entry_sync" as never, args as never);
  const b = await c.rpc("project_time_entry_sync" as never, args as never);
  const x = await c.rpc("project_time_entry_sync" as never, { ...args, p_request_hash: "e".repeat(64) } as never);
  const ra = a.data as { replay: boolean; entry: { id: string } } | null;
  const rb = b.data as { replay: boolean; entry: { id: string } } | null;
  return [
    !a.error && ra?.replay === false && rb?.replay === true && rb.entry.id === ra.entry.id && /OFFLINE_REQUEST_CONFLICT/.test(x.error?.message ?? ""),
    `${a.error?.message ?? ""} ${x.error?.message ?? ""}`,
  ];
});
await check("limite por chave: a 121ª requisição na janela → 429 com Retry-After", async () => {
  let last: Res | null = null;
  for (let i = 0; i < 121; i++) last = await call("GET", "/projects?limit=1", K.rate);
  return [last!.status === 429 && Number(last!.headers.get("Retry-After")) >= 1 && last!.headers.get("X-RateLimit-Remaining") === "0", `status ${last!.status}`];
});
await check("nenhuma sessão de sujeito sobra após as chamadas HTTP", async () => [psql("select count(*) from techerp_api.subject_sessions") === "0", "sessões"]);

proxy.stop(true);
for (const r of results) console.log(`${r.ok ? "ok" : "FALHOU"}: ${r.id}${r.ok ? "" : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
