// Fase 1 da revisão de cargos WK: prova com JWT REAL (GoTrue + PostgREST) na stack isolada.
// Mede o comportamento ANTES da migration 0122, aplica a migration e repete com asserções.
// Fixtures sintéticas só no banco descartável. Sem service_role nas asserções.
// Exit 0 tudo passou | 1 falha | 2 bloqueado.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const root = process.env.ISO_ROOT ?? "/tmp/techerp-stack";
const port = process.env.ISO_PORT ?? "54330";
const AUTH = `http://127.0.0.1:${process.env.STACK_AUTH_PORT ?? "59999"}`;
const REST = `http://127.0.0.1:${process.env.STACK_REST_PORT ?? "59998"}`;
const anonKey = process.env.STACK_ANON_JWT;
const MIGRATION = process.env.RBAC_MIGRATION;
if (!anonKey || !MIGRATION) {
  console.error("BLOQUEADO: STACK_ANON_JWT/RBAC_MIGRATION ausentes");
  process.exit(2);
}

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
    if (!target) return new Response("n/a", { status: 501 });
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

function psqlArgs(extra: string[]) {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const k of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "DATABASE_URL"])
    delete env[k];
  return spawnSync(
    "psql",
    [
      "-X",
      "-qtA",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      `${root}/sock`,
      "-p",
      port,
      "-U",
      "postgres",
      "-d",
      "postgres",
      ...extra,
    ],
    { env, encoding: "utf8" },
  );
}
function psql(sql: string) {
  const r = psqlArgs(["-c", sql]);
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}
if (psql("select label from public.__isolated_marker where id=1") !== "techerp-isolated-harness") {
  console.error("GUARD: marcador ausente");
  process.exit(2);
}

const U = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
const EMAIL: Record<number, string> = {
  1: "admin-a@techerp-test.invalid",
  2: "own-a@techerp-test.invalid",
  3: "team-a@techerp-test.invalid",
  4: "ws-a@techerp-test.invalid",
  5: "removed-a@techerp-test.invalid",
  6: "admin-b@techerp-test.invalid",
  7: "peer-a@techerp-test.invalid",
};
const WA = "aaaaaaaa-0000-4000-8000-00000000000a";
const ROLE_OWN = "30000000-0000-4000-8000-0000000000a1";
const S1 = "60000000-0000-4000-8000-0000000000a1"; // responsável 2
const S2 = "60000000-0000-4000-8000-0000000000a7"; // responsável 7
const S3 = "60000000-0000-4000-8000-0000000000a0"; // sem responsável
const P1 = "61000000-0000-4000-8000-0000000000a1"; // negócio A7 (líder 3)
const P2 = "61000000-0000-4000-8000-0000000000a2"; // negócio A2 (sem equipe)
const P3 = "61000000-0000-4000-8000-0000000000a3"; // negócio A7, legado via líder
const I1 = "62000000-0000-4000-8000-0000000000a1";
const I3 = "62000000-0000-4000-8000-0000000000a3";

const PW = randomBytes(18).toString("base64url");
psql(`update auth.users set encrypted_password = extensions.crypt('${PW}', extensions.gen_salt('bf')),
  instance_id = '00000000-0000-0000-0000-000000000000', created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now()),
  confirmation_token = coalesce(confirmation_token,''), recovery_token = coalesce(recovery_token,''),
  email_change_token_new = coalesce(email_change_token_new,''), email_change = coalesce(email_change,''),
  email_change_token_current = coalesce(email_change_token_current,''), phone_change = coalesce(phone_change,''),
  phone_change_token = coalesce(phone_change_token,''), reauthentication_token = coalesce(reauthentication_token,'')
  where email like '%@techerp-test.invalid'`);

// Fixtures sintéticas desta fase (idempotentes).
psql(`
insert into public.permission_set_items(set_id, permission_key)
select s::uuid, k from (values
 ('20000000-0000-4000-8000-0000000000a1','techsales.inbox.chat.view.own'),
 ('20000000-0000-4000-8000-0000000000a1','techsales.inbox.chat.create.own'),
 ('20000000-0000-4000-8000-0000000000a2','techsales.inbox.chat.view.team'),
 ('20000000-0000-4000-8000-0000000000a2','techsales.inbox.chat.update.team'),
 ('20000000-0000-4000-8000-0000000000a2','techsales.role_profiles.view.workspace'),
 ('20000000-0000-4000-8000-0000000000a3','techsales.inbox.chat.view.workspace'),
 ('20000000-0000-4000-8000-0000000000a3','techsales.inbox.chat.create.workspace')) v(s,k)
on conflict do nothing;
insert into public.permission_sets(id, module, name) values ('20000000-0000-4000-8000-0000000000a4','techsales','[ISO] Aprovação') on conflict do nothing;
insert into public.permission_set_items(set_id, permission_key) values
 ('20000000-0000-4000-8000-0000000000a4','techsales.role_profiles.view.workspace'),
 ('20000000-0000-4000-8000-0000000000a4','techsales.role_profiles.approve.workspace') on conflict do nothing;
insert into public.job_roles(id, name, workspace_id, owner_id) values ('30000000-0000-4000-8000-0000000000a4','[ISO] Aprovador',
 '${WA}','${WA}') on conflict do nothing;
insert into public.job_role_sets(role_id, set_id) values ('30000000-0000-4000-8000-0000000000a4','20000000-0000-4000-8000-0000000000a4') on conflict do nothing;
insert into public.user_job_roles(user_id, owner_id, workspace_id, role_id)
 select '${U(2)}','${WA}','${WA}','30000000-0000-4000-8000-0000000000a4'
 where not exists (select 1 from public.user_job_roles where user_id='${U(2)}' and role_id='30000000-0000-4000-8000-0000000000a4');
insert into public.live_chat_sessions(id, owner_id, workspace_id, visitor_id, assignee_id, status) values
 ('${S1}','${WA}','${WA}','iso-v1','${U(2)}','open'),
 ('${S2}','${WA}','${WA}','iso-v2','${U(7)}','open'),
 ('${S3}','${WA}','${WA}','iso-v3',null,'open') on conflict do nothing;
insert into public.live_chat_messages(session_id, owner_id, workspace_id, direction, body)
 select s, '${WA}','${WA}','inbound','[ISO] olá' from unnest(array['${S1}','${S2}','${S3}']::uuid[]) s
 where not exists (select 1 from public.live_chat_messages m where m.session_id = s);
insert into public.deal_role_profiles(id, workspace_id, deal_id, title, created_by, status, revision, last_version) values
 ('${P1}','${WA}','51000000-0000-4000-8000-0000000000a7','[ISO] Perfil 1','${U(7)}','in_validation',1,0),
 ('${P2}','${WA}','51000000-0000-4000-8000-0000000000a1','[ISO] Perfil 2','${U(2)}','in_validation',1,0),
 ('${P3}','${WA}','51000000-0000-4000-8000-0000000000a7','[ISO] Perfil 3','${U(7)}','in_validation',1,0) on conflict do nothing;
insert into public.role_profile_approval_requests(id, workspace_id, deal_id, requested_by, approver_id, idempotency_key) values
 ('63000000-0000-4000-8000-0000000000a1','${WA}','51000000-0000-4000-8000-0000000000a7','${U(7)}','${U(3)}','iso-r1') on conflict do nothing;
insert into public.role_profile_approval_items(id, request_id, workspace_id, profile_id, profile_revision) values
 ('${I1}','63000000-0000-4000-8000-0000000000a1','${WA}','${P1}',1),
 ('${I3}','63000000-0000-4000-8000-0000000000a1','${WA}','${P3}',1) on conflict do nothing;
`);

const mk = () =>
  createClient(URL_, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
const sessions: Record<number, SupabaseClient> = {};
async function as(n: number) {
  if (sessions[n]) return sessions[n];
  const c = mk();
  const { error } = await c.auth.signInWithPassword({ email: EMAIL[n], password: PW });
  if (error) throw new Error(`login ${n}: ${error.message}`);
  return (sessions[n] = c);
}

type R = {
  id: string;
  phase: string;
  status: "pass" | "fail" | "observed";
  detail: string;
  why: string;
};
const results: R[] = [];
async function run(
  phase: "before" | "after",
  id: string,
  why: string,
  fn: () => Promise<string>,
  expect?: string | RegExp,
) {
  let got: string;
  try {
    got = await fn();
  } catch (e) {
    got = `ERR ${(e as Error).message}`;
  }
  if (phase === "before" || expect === undefined) {
    results.push({ id, phase, status: "observed", detail: got, why });
    return;
  }
  const ok = typeof expect === "string" ? got === expect : expect.test(got);
  results.push({
    id,
    phase,
    status: ok ? "pass" : "fail",
    detail: `got=${got} expect=${expect}`,
    why,
  });
}
const hasPerm = (n: number, key: string) => async () => {
  const c = await as(n === 5 ? 5 : 1);
  const { data, error } = await c.rpc("user_has_permission", {
    _user_id: U(n),
    _workspace_id: WA,
    _permission_key: key,
  });
  return error ? `ERR ${error.message}` : String(data);
};
const renameRole = (n: number, name: string) => async () => {
  const c = await as(n);
  const { data, error } = await c
    .from("job_roles")
    .update({ name })
    .eq("id", ROLE_OWN)
    .select("id");
  if (error) return `ERR ${error.code}`;
  return `rows=${data?.length ?? 0}`;
};
const roleName = () => psql(`select name from public.job_roles where id='${ROLE_OWN}'`);
const countSessions = (n: number) => async () => {
  const c = n === 0 ? mk() : await as(n);
  const { data, error } = await c
    .from("live_chat_sessions")
    .select("id")
    .eq("workspace_id", WA)
    .order("id");
  if (error) return `ERR ${error.code}`;
  return (data ?? []).map((r) => r.id.slice(-2)).join(",") || "none";
};
const countMsgs = (n: number) => async () => {
  const c = n === 0 ? mk() : await as(n);
  const { data, error } = await c
    .from("live_chat_messages")
    .select("session_id")
    .eq("workspace_id", WA);
  if (error) return `ERR ${error.code}`;
  return String(new Set((data ?? []).map((r) => r.session_id.slice(-2))).size);
};
const send = (n: number, session: string, author?: string) => async () => {
  const c = await as(n);
  const { error } = await c.from("live_chat_messages").insert({
    session_id: session,
    owner_id: WA,
    workspace_id: WA,
    direction: "outbound",
    author_user_id: author ?? U(n),
    body: "[ISO] resposta",
  });
  return error ? `ERR ${error.code}` : "ok";
};
const rpc = (n: number, fn: string, args: Record<string, unknown>) => async () => {
  const c = await as(n);
  const { data, error } = await c.rpc(fn as never, args as never);
  if (error) return `ERR ${error.message.split(":")[0]}`;
  return `ok ${JSON.stringify(data)}`;
};

// ===== ANTES =====
await run(
  "before",
  "B-perm-inativo",
  "membro inativo ainda tinha permissões efetivas",
  hasPerm(5, "techsales.deals.view.workspace"),
);
await run(
  "before",
  "B-cargo-membro",
  "membro comum renomeava cargo",
  renameRole(2, "[ISO] renomeado por membro"),
);
await run("before", "B-chat-own", "dono de escopo próprio via todas as sessões", countSessions(2));
await run(
  "before",
  "B-legado-nao-lider",
  "não-líder com chave aprovava pelo legado",
  rpc(2, "role_profile_approve", {
    _profile: P2,
    _expected_revision: 1,
    _snapshot: {},
    _commercial: null,
  }),
);
// Desfaz efeitos do "antes" para o "depois" partir do mesmo estado.
psql(`update public.job_roles set name='[ISO] Cargo próprio' where id='${ROLE_OWN}';
 delete from public.live_chat_messages where direction='outbound' and workspace_id='${WA}';
 delete from public.deal_role_profile_events where profile_id in ('${P1}','${P2}','${P3}');
 update public.deal_role_profiles set status='in_validation', revision=1, last_version=0, approved_version_id=null where id in ('${P1}','${P2}','${P3}');
 delete from public.deal_role_profile_versions where profile_id in ('${P1}','${P2}','${P3}');
 update public.role_profile_approval_items set status='pending', decided_by=null, decided_at=null, version=null where id in ('${I1}','${I3}');
 update public.role_profile_approval_requests set status='pending', decided_at=null where id='63000000-0000-4000-8000-0000000000a1';
 delete from public.permission_set_items where set_id='20000000-0000-4000-8000-0000000000a2' and permission_key='techsales.role_profiles.approve.workspace';
 delete from public.access_audit_log where action='role_profile_admin_override';`);

// ===== MIGRATION =====
const mig = psqlArgs(["-f", MIGRATION]);
if (mig.status !== 0) {
  console.error("FALHA migration:", mig.stderr.split("\n").slice(0, 5).join(" | "));
  process.exit(1);
}
const mig2 = psqlArgs(["-f", MIGRATION]);
results.push({
  id: "M-idempotente",
  phase: "after",
  status: mig2.status === 0 ? "pass" : "fail",
  detail: mig2.stderr.slice(0, 200),
  why: "migration reaplicável",
});
psql("notify pgrst, 'reload schema'");
await new Promise((r) => setTimeout(r, 1500));

// ===== DEPOIS =====
// 1.1 permissões efetivas
await run(
  "after",
  "A-perm-inativo",
  "inativo sem permissões",
  hasPerm(5, "techsales.deals.view.workspace"),
  "false",
);
await run(
  "after",
  "A-perm-ativo",
  "ativo mantém",
  hasPerm(4, "techsales.deals.view.workspace"),
  "true",
);
await run(
  "after",
  "A-perm-admin",
  "admin ativo mantém bypass",
  hasPerm(1, "techsales.inbox.chat.view.workspace"),
  "true",
);
await run(
  "after",
  "A-perm-outro-ws",
  "admin B sem chave na A",
  async () => {
    const c = await as(6);
    const { data } = await c.rpc("user_has_permission", {
      _user_id: U(6),
      _workspace_id: WA,
      _permission_key: "techsales.deals.view.own",
    });
    return String(data);
  },
  "false",
);
// deny prevalece + soma de 2 cargos
psql(`insert into public.job_role_permission_overrides(role_id, workspace_id, permission_key, effect, created_by)
 values ('30000000-0000-4000-8000-0000000000a4','${WA}','techsales.role_profiles.approve.workspace','deny','${U(1)}') on conflict do nothing`);
await run(
  "after",
  "A-deny-prevalece",
  "deny em um cargo vence grant de outro",
  hasPerm(2, "techsales.role_profiles.approve.workspace"),
  "false",
);
await run(
  "after",
  "A-soma-cargos",
  "chave do outro cargo continua",
  hasPerm(2, "techsales.inbox.chat.view.own"),
  "true",
);
psql(
  `delete from public.job_role_permission_overrides where role_id='30000000-0000-4000-8000-0000000000a4' and workspace_id='${WA}'`,
);

// Pacote de OUTRO workspace ligado a um cargo não vale fora dele.
psql(`insert into public.permission_sets(id, module, name, workspace_id) values
 ('20000000-0000-4000-8000-0000000000b9','__bundle__','[ISO] pacote B','aaaaaaaa-0000-4000-8000-00000000000b') on conflict do nothing;
 insert into public.permission_set_items(set_id, permission_key) values ('20000000-0000-4000-8000-0000000000b9','techsales.deals.view.workspace') on conflict do nothing;
 insert into public.job_role_sets(role_id, set_id) values ('${ROLE_OWN}','20000000-0000-4000-8000-0000000000b9') on conflict do nothing;`);
await run(
  "after",
  "A-pacote-outro-ws",
  "pacote de outro workspace não concede chave",
  hasPerm(2, "techsales.deals.view.workspace"),
  "false",
);
psql(`delete from public.job_role_sets where set_id='20000000-0000-4000-8000-0000000000b9'`);

// Overload legado de 2 argumentos: vendedor da WA que é dono de um workspace privado.
const WPRIV = "aaaaaaaa-0000-4000-8000-00000000000c";
const FIN = "techfinance.payments.delete.workspace";
psql(`insert into public.workspaces(id, name, slug, created_by) values
 ('${WPRIV}','[ISO] Privado do vendedor','iso-privado-vendedor','${U(2)}') on conflict (id) do nothing;
 insert into public.workspace_members(workspace_id, user_id, role, status)
 values ('${WPRIV}','${U(2)}','owner','active') on conflict do nothing;
 update public.profiles set active_workspace_id='${WA}' where id='${U(2)}';`);
const hasPermLegacy = (n: number, key: string) => async () => {
  const c = await as(n);
  const { data, error } = await c.rpc("user_has_permission", { _user: U(n), _perm: key });
  return error ? `ERR ${error.message}` : String(data);
};
const hasPermWs = (n: number, ws: string, key: string) => async () => {
  const c = await as(n);
  const { data, error } = await c.rpc("user_has_permission", {
    _user_id: U(n),
    _workspace_id: ws,
    _permission_key: key,
  });
  return error ? `ERR ${error.message}` : String(data);
};
await run(
  "after",
  "A-legado-2args-ws-ativo",
  "overload de 2 args não usa o workspace privado do usuário",
  hasPermLegacy(2, FIN),
  "false",
);
await run(
  "after",
  "A-3args-ws-privado",
  "no workspace privado (dono) a chave existe",
  hasPermWs(2, WPRIV, FIN),
  "true",
);
await run(
  "after",
  "A-3args-ws-ativo",
  "na WA o vendedor não tem a chave de finanças",
  hasPermWs(2, WA, FIN),
  "false",
);
// Cargo de sistema reutilizado em outro workspace não arrasta o bundle local da WA.
// Usuário 7 é membro comum (não dono) do workspace privado, para não cair no bypass de dono.
psql(`insert into public.workspace_members(workspace_id, user_id, role, status)
 values ('${WPRIV}','${U(7)}','member','active') on conflict do nothing;
 insert into public.job_roles(id, name, is_system) values
 ('30000000-0000-4000-8000-0000000000c1','[ISO] Auditor sistema', true) on conflict (id) do nothing;
 insert into public.permission_sets(id, module, name, workspace_id) values
 ('20000000-0000-4000-8000-0000000000c1','__bundle__','[ISO] bundle WA','${WA}') on conflict do nothing;
 insert into public.permission_set_items(set_id, permission_key) values
 ('20000000-0000-4000-8000-0000000000c1','${FIN}') on conflict do nothing;
 insert into public.job_role_sets(role_id, set_id) values
 ('30000000-0000-4000-8000-0000000000c1','20000000-0000-4000-8000-0000000000c1') on conflict do nothing;
 insert into public.user_job_roles(user_id, owner_id, workspace_id, role_id)
 select '${U(7)}','${WPRIV}','${WPRIV}','30000000-0000-4000-8000-0000000000c1'
 where not exists (select 1 from public.user_job_roles where user_id='${U(7)}'
   and role_id='30000000-0000-4000-8000-0000000000c1' and workspace_id='${WPRIV}');`);
await run(
  "after",
  "A-bundle-nao-vaza-cargo-sistema",
  "bundle da WA não vale em outro workspace pelo mesmo cargo de sistema",
  hasPermWs(7, WPRIV, FIN),
  "false",
);
await run(
  "after",
  "A-bundle-nao-vaza-para-wa",
  "o mesmo cargo atribuído no privado não concede na WA",
  hasPermWs(7, WA, FIN),
  "false",
);
// Positivo: pacote do próprio workspace privado concede normalmente.
psql(`insert into public.permission_sets(id, module, name, workspace_id) values
 ('20000000-0000-4000-8000-0000000000c2','__bundle__','[ISO] bundle privado','${WPRIV}') on conflict do nothing;
 insert into public.permission_set_items(set_id, permission_key) values
 ('20000000-0000-4000-8000-0000000000c2','${FIN}') on conflict do nothing;
 insert into public.job_role_sets(role_id, set_id) values
 ('30000000-0000-4000-8000-0000000000c1','20000000-0000-4000-8000-0000000000c2') on conflict do nothing;`);
await run(
  "after",
  "A-bundle-do-proprio-ws",
  "pacote do próprio workspace concede a chave",
  hasPermWs(7, WPRIV, FIN),
  "true",
);
psql(`delete from public.user_job_roles where role_id='30000000-0000-4000-8000-0000000000c1';
 delete from public.job_role_sets where role_id='30000000-0000-4000-8000-0000000000c1';
 delete from public.permission_set_items where set_id in ('20000000-0000-4000-8000-0000000000c1','20000000-0000-4000-8000-0000000000c2');
 delete from public.permission_sets where id in ('20000000-0000-4000-8000-0000000000c1','20000000-0000-4000-8000-0000000000c2');
 delete from public.job_roles where id='30000000-0000-4000-8000-0000000000c1';
 delete from public.workspace_members where workspace_id='${WPRIV}' and user_id='${U(7)}';`);

// 1.2 cargos
await run(
  "after",
  "A-cargo-membro",
  "membro não renomeia cargo",
  async () => `${await renameRole(2, "[ISO] x")()} name=${roleName()}`,
  "rows=0 name=[ISO] Cargo próprio",
);
await run(
  "after",
  "A-cargo-outro-ws",
  "admin de outro workspace não altera",
  async () => `${await renameRole(6, "[ISO] y")()} name=${roleName()}`,
  "rows=0 name=[ISO] Cargo próprio",
);
await run(
  "after",
  "A-cargo-admin",
  "admin renomeia",
  async () => `${await renameRole(1, "[ISO] Cargo próprio")()}`,
  "rows=1",
);
await run(
  "after",
  "A-cargo-admin-sistema",
  "admin não vira cargo de sistema",
  async () => {
    const c = await as(1);
    const { error } = await c.from("job_roles").update({ is_system: true }).eq("id", ROLE_OWN);
    return error ? `ERR ${error.code}` : "ok";
  },
  "ERR 42501",
);
await run(
  "after",
  "A-cargo-membro-cria",
  "membro não cria cargo",
  async () => {
    const c = await as(2);
    const { error } = await c
      .from("job_roles")
      .insert({ name: "[ISO] intruso", workspace_id: WA, owner_id: WA });
    return error ? `ERR ${error.code}` : "ok";
  },
  "ERR 42501",
);

// 1.4 chat
await run("after", "A-chat-own", "próprio vê só a sua", countSessions(2), "a1");
await run("after", "A-chat-par", "par vê só a sua", countSessions(7), "a7");
await run("after", "A-chat-team", "equipe vê equipe + fila", countSessions(3), "a0,a7");
await run("after", "A-chat-ws", "workspace vê todas", countSessions(4), "a0,a1,a7");
await run("after", "A-chat-inativo", "inativo nada", countSessions(5), "none");
await run("after", "A-chat-outro-ws", "outro tenant nada", countSessions(6), "none");
await run("after", "A-chat-anon", "anônimo nada", countSessions(0), /^(none|ERR 42501)$/);
await run("after", "A-msg-own", "mensagens só da sessão visível", countMsgs(2), "1");
await run("after", "A-msg-team", "mensagens das sessões da equipe", countMsgs(3), "2");
await run("after", "A-send-own-ok", "envia na própria", send(2, S1), "ok");
await run(
  "after",
  "A-send-own-terceiro",
  "não envia em sessão de terceiro",
  send(2, S2),
  "ERR 42501",
);
await run(
  "after",
  "A-send-team-sem-chave",
  "visualizador de equipe sem criar não envia",
  send(3, S2),
  "ERR 42501",
);
await run("after", "A-send-ws", "workspace envia na fila", send(4, S3), "ok");
await run(
  "after",
  "A-send-autor-falso",
  "não envia como outra pessoa",
  send(4, S3, U(2)),
  "ERR 42501",
);
psql(`insert into public.job_role_permission_overrides(role_id, workspace_id, permission_key, effect, created_by)
 values ('${ROLE_OWN}','${WA}','techsales.inbox.chat.view.own','deny','${U(1)}') on conflict do nothing`);
await run("after", "A-chat-deny", "deny remove visão própria", countSessions(2), "none");
psql(
  `delete from public.job_role_permission_overrides where role_id='${ROLE_OWN}' and workspace_id='${WA}'`,
);

// 1.3 perfis de vaga
await run(
  "after",
  "A-legado-nao-lider",
  "não-líder com chave é barrado no legado",
  rpc(2, "role_profile_approve", {
    _profile: P2,
    _expected_revision: 1,
    _snapshot: {},
    _commercial: null,
  }),
  "ERR LEADER_REQUIRED",
);
await run(
  "after",
  "A-legado-admin",
  "admin também precisa do líder ou override",
  rpc(1, "role_profile_approve", {
    _profile: P2,
    _expected_revision: 1,
    _snapshot: {},
    _commercial: null,
  }),
  "ERR LEADER_REQUIRED",
);
await run(
  "after",
  "A-decide-nao-lider",
  "par não decide item do líder",
  rpc(7, "role_profile_leader_decide", { _item: I1, _decision: "approve", _comment: "" }),
  "ERR PERMISSION_DENIED",
);
await run(
  "after",
  "A-decide-lider-sem-chave",
  "líder sem approve é barrado",
  rpc(3, "role_profile_leader_decide", { _item: I1, _decision: "approve", _comment: "" }),
  "ERR PERMISSION_DENIED",
);
psql(
  `insert into public.permission_set_items(set_id, permission_key) values ('20000000-0000-4000-8000-0000000000a2','techsales.role_profiles.approve.workspace') on conflict do nothing`,
);
await run(
  "after",
  "A-decide-lider",
  "líder com chave aprova",
  rpc(3, "role_profile_leader_decide", { _item: I1, _decision: "approve", _comment: "" }),
  /^ok .*"approved"/,
);
await run(
  "after",
  "A-legado-lider",
  "legado delega ao fluxo do líder",
  rpc(3, "role_profile_approve", {
    _profile: P3,
    _expected_revision: 1,
    _snapshot: {},
    _commercial: null,
  }),
  /^ok .*"approved"/,
);
psql(
  `update public.workspace_members set status='inactive' where workspace_id='${WA}' and user_id='${U(3)}'`,
);
psql(`insert into public.role_profile_approval_items(id, request_id, workspace_id, profile_id, profile_revision) values
 ('62000000-0000-4000-8000-0000000000a9','63000000-0000-4000-8000-0000000000a1','${WA}','${P2}',1) on conflict do nothing`);
await run(
  "after",
  "A-lider-inativo",
  "líder com membership inativa não decide",
  rpc(3, "role_profile_leader_decide", {
    _item: "62000000-0000-4000-8000-0000000000a9",
    _decision: "request_changes",
    _comment: "x",
  }),
  /^ERR /,
);
psql(
  `update public.workspace_members set status='active' where workspace_id='${WA}' and user_id='${U(3)}'`,
);
await run(
  "after",
  "A-override-sem-motivo",
  "override exige motivo",
  rpc(1, "role_profile_admin_override_approve", {
    _profile: P2,
    _expected_revision: 1,
    _reason: "curto",
  }),
  /^ERR Informe o motivo/,
);
await run(
  "after",
  "A-override-nao-admin",
  "não-admin não usa override",
  rpc(2, "role_profile_admin_override_approve", {
    _profile: P2,
    _expected_revision: 1,
    _reason: "motivo suficientemente longo",
  }),
  "ERR PERMISSION_DENIED",
);
await run(
  "after",
  "A-override-admin",
  "admin com motivo aprova e audita",
  async () => {
    const r = await rpc(1, "role_profile_admin_override_approve", {
      _profile: P2,
      _expected_revision: 1,
      _reason: "teste isolado de override auditado",
    })();
    const a = psql(
      `select count(*) from public.access_audit_log where action='role_profile_admin_override' and entity_id='${P2}'`,
    );
    return `${r.startsWith("ok") ? "ok" : r} audit=${a}`;
  },
  "ok audit=1",
);

// ===== Fase 4: ACL de cargo pelo SDK e visibilidade do negócio na aprovação =====
const insertRow = (n: number, table: string, row: Record<string, unknown>) => async () => {
  const c = await as(n);
  const { error } = await c.from(table).insert(row);
  return error ? `ERR ${error.code}` : "ok";
};
await run(
  "after",
  "A-pset-nao-admin",
  "membro comum não cria pacote de permissões",
  insertRow(2, "permission_sets", {
    id: "20000000-0000-4000-8000-0000000000c1",
    module: "techsales",
    name: "[ISO] pacote proibido",
    workspace_id: WA,
  }),
  "ERR 42501",
);
await run(
  "after",
  "A-pset-global-admin",
  "admin não cria pacote global (sem workspace)",
  insertRow(1, "permission_sets", {
    id: "20000000-0000-4000-8000-0000000000c2",
    module: "techsales",
    name: "[ISO] pacote global proibido",
  }),
  "ERR 42501",
);
await run(
  "after",
  "A-jrs-nao-admin",
  "membro comum não vincula pacote a cargo",
  insertRow(2, "job_role_sets", {
    role_id: ROLE_OWN,
    set_id: "20000000-0000-4000-8000-0000000000a4",
  }),
  "ERR 42501",
);
// Negócio de outra carteira: líder tem a chave, mas não enxerga o negócio.
psql(`insert into public.deals(id, owner_id, workspace_id, name, assigned_to) values
 ('51000000-0000-4000-8000-0000000000c3','${U(4)}','${WA}','[ISO] Negócio fora do escopo','${U(4)}') on conflict do nothing;
 insert into public.deal_role_profiles(id, workspace_id, deal_id, title, created_by, status, revision, last_version) values
 ('52000000-0000-4000-8000-0000000000c3','${WA}','51000000-0000-4000-8000-0000000000c3','[ISO] Perfil fora','${U(4)}','in_validation',1,0) on conflict do nothing;
 insert into public.role_profile_approval_requests(id, workspace_id, deal_id, requested_by, approver_id, idempotency_key) values
 ('63000000-0000-4000-8000-0000000000c3','${WA}','51000000-0000-4000-8000-0000000000c3','${U(4)}','${U(3)}','iso-r3') on conflict do nothing;
 insert into public.role_profile_approval_items(id, request_id, workspace_id, profile_id, profile_revision) values
 ('62000000-0000-4000-8000-0000000000c3','63000000-0000-4000-8000-0000000000c3','${WA}','52000000-0000-4000-8000-0000000000c3',1) on conflict do nothing;`);
await run(
  "after",
  "A-decide-lider-deal-fora",
  "líder com chave não decide negócio fora da sua visibilidade",
  rpc(3, "role_profile_leader_decide", {
    _item: "62000000-0000-4000-8000-0000000000c3",
    _decision: "approve",
    _comment: "",
  }),
  "ERR PERMISSION_DENIED",
);

const fails = results.filter((r) => r.status === "fail");
mkdirSync(`${root}/artifacts`, { recursive: true });
writeFileSync(
  `${root}/artifacts/rbac-wk-phase1.json`,
  JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
);
for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(26)} ${r.detail}`);
console.log(
  `\n${results.filter((r) => r.status === "pass").length} pass / ${fails.length} fail / ${results.filter((r) => r.status === "observed").length} observados antes`,
);
proxy.stop();
process.exit(fails.length ? 1 : 0);
