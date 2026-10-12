// Fase 5: visibilidade ampla trocada por pacote LOCAL por cargo, sem deny cruzado entre cargos.
// Prova com JWT REAL (GoTrue + PostgREST) na stack isolada. Sem service_role nas asserções.
// Cenários: cargo operacional sozinho (hoje e futuro), soma de cargos legítima, idempotência,
// reaplicação da baseline e não contaminação de outro workspace.
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
  2: "own-a@techerp-test.invalid", // Gerente Comercial sozinho
  3: "team-a@techerp-test.invalid", // Gerente + Financeiro + Diretor
  4: "ws-a@techerp-test.invalid", // Head RH + Gerente
  7: "peer-a@techerp-test.invalid", // futuro ocupante de Head RH sozinho
  6: "admin-b@techerp-test.invalid", // outro workspace, mesmos cargos globais
};
const WA = "aaaaaaaa-0000-4000-8000-00000000000a";
const WB = "aaaaaaaa-0000-4000-8000-00000000000b";
const VIS = "21000000-0000-4000-8000-0000000000f0"; // conjunto global amplo
const R_GC = "31000000-0000-4000-8000-0000000000f1"; // Gerente Comercial (global)
const R_FIN = "31000000-0000-4000-8000-0000000000f2"; // Financeiro (global)
const R_DIR = "31000000-0000-4000-8000-0000000000f3"; // Diretor (global)
const R_RH = "31000000-0000-4000-8000-0000000000f4"; // Head de RH (global)

const PW = randomBytes(18).toString("base64url");
psql(`update auth.users set encrypted_password = extensions.crypt('${PW}', extensions.gen_salt('bf')),
  instance_id = '00000000-0000-0000-0000-000000000000', created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now()),
  confirmation_token = coalesce(confirmation_token,''), recovery_token = coalesce(recovery_token,''),
  email_change_token_new = coalesce(email_change_token_new,''), email_change = coalesce(email_change,''),
  email_change_token_current = coalesce(email_change_token_current,''), phone_change = coalesce(phone_change,''),
  phone_change_token = coalesce(phone_change_token,''), reauthentication_token = coalesce(reauthentication_token,'')
  where email like '%@techerp-test.invalid'`);

// Chaves de prova (iguais em formato às reais). Só as que existirem no catálogo são usadas.
const K_FIN = "techfinance.payments.view.workspace";
const K_PEOPLE = "techpeople.people.view.workspace";
const K_SYS = "system.billing.view.workspace";
const K_SALES = "techsales.deals.view.workspace";
const K_FIN_ADMIN = "techfinance.payments.update.workspace";

psql(`
insert into public.permissions(key, module, resource, action, scope, label_pt)
values ('${K_FIN}','techfinance','payments','view','workspace','[ISO] ver pagamentos'),
       ('${K_PEOPLE}','techpeople','people','view','workspace','[ISO] ver pessoas'),
       ('${K_SYS}','system','billing','view','workspace','[ISO] ver cobrança'),
       ('${K_SALES}','techsales','deals','view','workspace','[ISO] ver negócios'),
       ('${K_FIN_ADMIN}','techfinance','payments','update','workspace','[ISO] editar pagamentos')
on conflict (key) do nothing;

-- Conjunto GLOBAL amplo, igual à "Visibilidade total (padrão)".
insert into public.permission_sets(id, owner_id, module, name, is_system)
 values ('${VIS}','${WA}','core','[ISO] Visibilidade total', true) on conflict (id) do nothing;
update public.permission_sets set workspace_id = null where id = '${VIS}';
insert into public.permission_set_items(set_id, permission_key)
 select '${VIS}', k from unnest(array['${K_FIN}','${K_PEOPLE}','${K_SYS}','${K_SALES}']) k on conflict do nothing;

-- Conjunto GLOBAL legítimo do cargo Financeiro (não é visibilidade ampla).
insert into public.permission_sets(id, owner_id, module, name, is_system)
 values ('21000000-0000-4000-8000-0000000000f5','${WA}','techfinance','[ISO] TechFinance Admin', true) on conflict (id) do nothing;
update public.permission_sets set workspace_id = null where id = '21000000-0000-4000-8000-0000000000f5';
insert into public.permission_set_items(set_id, permission_key)
 values ('21000000-0000-4000-8000-0000000000f5','${K_FIN}'),
        ('21000000-0000-4000-8000-0000000000f5','${K_FIN_ADMIN}') on conflict do nothing;

-- Cargos GLOBAIS de sistema (compartilhados entre workspaces).
insert into public.job_roles(id, name, owner_id, is_system) values
 ('${R_GC}','[ISO] Gerente Comercial','${WA}', true),
 ('${R_FIN}','[ISO] Financeiro','${WA}', true),
 ('${R_DIR}','[ISO] Diretor','${WA}', true),
 ('${R_RH}','[ISO] Head de RH','${WA}', true) on conflict (id) do nothing;
update public.job_roles set workspace_id = null where id in ('${R_GC}','${R_FIN}','${R_DIR}','${R_RH}');
insert into public.job_role_sets(role_id, set_id) values
 ('${R_GC}','${VIS}'),('${R_FIN}','${VIS}'),('${R_DIR}','${VIS}'),('${R_RH}','${VIS}'),
 ('${R_FIN}','21000000-0000-4000-8000-0000000000f5') on conflict do nothing;

-- Pessoas do tenant A.
insert into public.user_job_roles(user_id, owner_id, workspace_id, role_id)
select v.u::uuid, '${WA}', '${WA}', v.r::uuid from (values
 ('${U(2)}','${R_GC}'),
 ('${U(3)}','${R_GC}'),('${U(3)}','${R_FIN}'),('${U(3)}','${R_DIR}'),
 ('${U(4)}','${R_RH}'),('${U(4)}','${R_GC}'),
 ('${U(7)}','${R_RH}')) v(u,r)
where not exists (select 1 from public.user_job_roles x where x.user_id = v.u::uuid and x.role_id = v.r::uuid);

-- Mesmo cargo global no OUTRO workspace: não pode ser afetado.
insert into public.user_job_roles(user_id, owner_id, workspace_id, role_id)
select '${U(6)}','${WB}','${WB}','${R_GC}'
where not exists (select 1 from public.user_job_roles where user_id='${U(6)}' and role_id='${R_GC}');
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

type R = { id: string; phase: string; status: "pass" | "fail" | "observed"; detail: string };
const results: R[] = [];
async function run(
  phase: "before" | "after",
  id: string,
  fn: () => Promise<string>,
  expect?: string,
) {
  let got: string;
  try {
    got = await fn();
  } catch (e) {
    got = `ERR ${(e as Error).message}`;
  }
  if (phase === "before" || expect === undefined) {
    results.push({ id, phase, status: "observed", detail: got });
    return;
  }
  results.push({
    id,
    phase,
    status: got === expect ? "pass" : "fail",
    detail: `got=${got} expect=${expect}`,
  });
}

// Asserção pelo caminho real: sessão do próprio admin do workspace consultando a chave efetiva.
const hasPerm = (viewer: number, user: number, ws: string, key: string) => async () => {
  const c = await as(viewer);
  const { data, error } = await c.rpc("user_has_permission", {
    _user_id: U(user),
    _workspace_id: ws,
    _permission_key: key,
  });
  return error ? `ERR ${error.message}` : String(data);
};

const SPEC = JSON.stringify([
  { role: R_GC, cats: ["fin", "sysadm"] },
  { role: R_FIN, cats: ["sysadm"] },
  { role: R_DIR, cats: ["sysadm"] },
  { role: R_RH, cats: ["fin", "sysadm"] },
]).replace(/'/g, "''");

// ANTES: visibilidade ampla herdada por todos.
for (const [id, u, k] of [
  ["B-gc-sozinho-financeiro", 2, K_FIN],
  ["B-rh-sozinho-financeiro", 7, K_FIN],
  ["B-gc-sozinho-sistema", 2, K_SYS],
] as const)
  await run("before", id, hasPerm(1, u, WA, k));

// Aplica a migration (estrutura + funções) e a troca do vínculo só no tenant A.
const mig = psqlArgs(["-f", MIGRATION]);
if (mig.status !== 0) {
  console.error(`BLOQUEADO: migration falhou\n${mig.stderr}`);
  process.exit(2);
}
const apply1 = psql(`select public.rbac_apply_vis_replacement('${WA}','${VIS}','${SPEC}'::jsonb)`);
const count1 = psql(
  `select count(*) from public.permission_set_items i join public.permission_sets s on s.id=i.set_id where s.workspace_id='${WA}' and s.module='__vis_local__'`,
);

// DEPOIS — cargo operacional sozinho perde a leitura ampla indevida, mantém a sua.
await run("after", "A-gc-sozinho-sem-financeiro", hasPerm(1, 2, WA, K_FIN), "false");
await run("after", "A-gc-sozinho-sem-sistema", hasPerm(1, 2, WA, K_SYS), "false");
await run("after", "A-gc-sozinho-mantem-vendas", hasPerm(1, 2, WA, K_SALES), "true");
await run("after", "A-gc-sozinho-mantem-pessoas", hasPerm(1, 2, WA, K_PEOPLE), "true");

// Soma de cargos: Financeiro continua concedendo, sem exceção por pessoa.
await run("after", "A-gc-fin-dir-tem-financeiro", hasPerm(1, 3, WA, K_FIN), "true");
await run("after", "A-gc-fin-dir-tem-financeiro-admin", hasPerm(1, 3, WA, K_FIN_ADMIN), "true");
await run("after", "A-gc-fin-dir-sem-sistema", hasPerm(1, 3, WA, K_SYS), "false");

// Head RH + Gerente: pessoas sim, financeiro não (nenhum dos dois cargos concede).
await run("after", "A-rh-gc-tem-pessoas", hasPerm(1, 4, WA, K_PEOPLE), "true");
await run("after", "A-rh-gc-sem-financeiro", hasPerm(1, 4, WA, K_FIN), "false");

// Futuro ocupante de um cargo só: mesma matriz, sem depender de quem ocupa hoje.
await run("after", "A-futuro-rh-sozinho-sem-financeiro", hasPerm(1, 7, WA, K_FIN), "false");
await run("after", "A-futuro-rh-sozinho-tem-pessoas", hasPerm(1, 7, WA, K_PEOPLE), "true");

// Outro workspace com o MESMO cargo global permanece intacto.
await run("after", "A-outro-ws-intacto-financeiro", hasPerm(6, 6, WB, K_FIN), "true");
await run("after", "A-outro-ws-intacto-sistema", hasPerm(6, 6, WB, K_SYS), "true");

// Idempotência: reaplicar não muda a matriz nem os itens.
const apply2 = psql(`select public.rbac_apply_vis_replacement('${WA}','${VIS}','${SPEC}'::jsonb)`);
const count2 = psql(
  `select count(*) from public.permission_set_items i join public.permission_sets s on s.id=i.set_id where s.workspace_id='${WA}' and s.module='__vis_local__'`,
);
await run("after", "A-idempotente-itens", async () => `${count1}=${count2}`, `${count1}=${count1}`);
await run(
  "after",
  "A-idempotente-vinculos",
  async () =>
    psql(`select count(*) from public.job_role_set_replacements where workspace_id='${WA}'`),
  "4",
);
await run("after", "A-idempotente-gc-sem-financeiro", hasPerm(1, 2, WA, K_FIN), "false");
await run("after", "A-idempotente-fin-mantem", hasPerm(1, 3, WA, K_FIN), "true");

// "Restaurar padrões" do cargo (recria o pacote de cargo) não devolve a visibilidade ampla.
psql(`delete from public.permission_set_items i using public.permission_sets s
      where s.id = i.set_id and s.workspace_id='${WA}' and s.module='__bundle__';`);
await run("after", "A-restauracao-nao-reabre", hasPerm(1, 2, WA, K_FIN), "false");

// Substituto apontando para pacote de OUTRO workspace falha fechado (não concede nada do global).
psql(`insert into public.permission_sets(id, owner_id, workspace_id, module, name)
      values ('21000000-0000-4000-8000-0000000000f9','${WB}','${WB}','__vis_local__','__vis_local:intruso')
      on conflict (id) do nothing;
      insert into public.permission_set_items(set_id, permission_key)
      values ('21000000-0000-4000-8000-0000000000f9','${K_FIN}') on conflict do nothing;
      update public.job_role_set_replacements set replacement_set_id='21000000-0000-4000-8000-0000000000f9'
       where workspace_id='${WA}' and role_id='${R_GC}';`);
await run("after", "A-substituto-de-outro-ws-falha-fechado", hasPerm(1, 2, WA, K_SALES), "false");
psql(`select public.rbac_apply_vis_replacement('${WA}','${VIS}','${SPEC}'::jsonb)`);
await run("after", "A-reaplicacao-corrige", hasPerm(1, 2, WA, K_SALES), "true");

const fails = results.filter((r) => r.status === "fail");
mkdirSync(`${root}/artifacts`, { recursive: true });
writeFileSync(
  `${root}/artifacts/rbac-wk-phase5.json`,
  JSON.stringify({ at: new Date().toISOString(), apply1, apply2, results }, null, 2),
);
for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(38)} ${r.detail}`);
console.log(
  `\n${results.filter((r) => r.status === "pass").length} pass / ${fails.length} fail / ${results.filter((r) => r.status === "observed").length} observados antes`,
);
proxy.stop();
process.exit(fails.length ? 1 : 0);
