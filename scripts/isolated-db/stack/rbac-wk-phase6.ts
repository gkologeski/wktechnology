// Fase 6: escrita de atribuições presa ao workspace canônico da linha (JWT real).
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
  4: "ws-a@techerp-test.invalid",
  5: "removed-a@techerp-test.invalid", // membro inativo
  6: "admin-b@techerp-test.invalid", // admin apenas do outro workspace
};
const WA = "aaaaaaaa-0000-4000-8000-00000000000a";
const WB = "aaaaaaaa-0000-4000-8000-00000000000b";
const R_FIN = "31000000-0000-4000-8000-0000000000e2"; // cargo global de sistema
const S_FINADM = "21000000-0000-4000-8000-0000000000e5"; // pacote global de sistema
const R_B = "31000000-0000-4000-8000-0000000000e9"; // cargo local do workspace B
const PW = randomBytes(18).toString("base64url");
psql(`update auth.users set encrypted_password = extensions.crypt('${PW}', extensions.gen_salt('bf')),
  instance_id='00000000-0000-0000-0000-000000000000', created_at=coalesce(created_at, now()), updated_at=coalesce(updated_at, now()), email_confirmed_at=coalesce(email_confirmed_at, now()), confirmation_token=coalesce(confirmation_token,''),
  recovery_token=coalesce(recovery_token,''), email_change_token_new=coalesce(email_change_token_new,''),
  email_change=coalesce(email_change,''), email_change_token_current=coalesce(email_change_token_current,''),
  phone_change=coalesce(phone_change,''), phone_change_token=coalesce(phone_change_token,''),
  reauthentication_token=coalesce(reauthentication_token,'') where email like '%@techerp-test.invalid'`);
psql(`
insert into public.job_roles(id,name,owner_id,is_system) values ('${R_FIN}','[ISO] Financeiro g','${WA}',true) on conflict (id) do nothing;
update public.job_roles set workspace_id=null where id='${R_FIN}';
insert into public.job_roles(id,name,owner_id,workspace_id,is_system) values ('${R_B}','[ISO] Cargo local B','${WB}','${WB}',false) on conflict (id) do nothing;
insert into public.permission_sets(id,owner_id,module,name,is_system) values ('${S_FINADM}','${WA}','techfinance','[ISO] FinAdmin g',true) on conflict (id) do nothing;
update public.permission_sets set workspace_id=null where id='${S_FINADM}';
delete from public.user_job_roles where role_id in ('${R_FIN}','${R_B}');
delete from public.user_permission_sets where set_id='${S_FINADM}';`);

const sessions: Record<number, SupabaseClient> = {};
async function as(n: number) {
  if (sessions[n]) return sessions[n];
  const c = createClient(URL_, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email: EMAIL[n], password: PW });
  if (error) throw new Error(`login ${n}: ${error.message}`);
  return (sessions[n] = c);
}
type R = { id: string; phase: string; status: string; detail: string };
const results: R[] = [];
const ok = (e: { code?: string } | null) => (e ? `deny:${e.code}` : "ok");
async function run(phase: string, id: string, fn: () => Promise<string>, expect?: string) {
  let got: string;
  try {
    got = await fn();
  } catch (e) {
    got = `ERR ${(e as Error).message}`;
  }
  results.push({
    id,
    phase,
    status: phase === "before" ? "observed" : got === expect ? "pass" : "fail",
    detail: `got=${got} expect=${expect}`,
  });
}
const cleanup = () =>
  psql(
    `delete from public.user_job_roles where role_id in ('${R_FIN}','${R_B}'); delete from public.user_permission_sets where set_id='${S_FINADM}';`,
  );
const insUjr = (n: number, row: Record<string, unknown>) => async () =>
  ok((await (await as(n)).from("user_job_roles").insert(row)).error);
const insUps = (n: number, row: Record<string, unknown>) => async () =>
  ok((await (await as(n)).from("user_permission_sets").insert(row)).error);
const v1 = insUjr(6, { user_id: U(2), owner_id: U(6), workspace_id: WA, role_id: R_FIN });
const v2 = insUps(6, { user_id: U(2), owner_id: U(6), workspace_id: WA, set_id: S_FINADM });
const v3 = insUjr(1, { user_id: U(2), owner_id: WA, workspace_id: WA, role_id: R_FIN });

for (const [id, f] of [
  ["B-estrangeiro-ujr", v1],
  ["B-estrangeiro-ups", v2],
  ["B-admin-legitimo-ujr", v3],
] as const) {
  await run("before", id, f);
  cleanup();
}

for (const file of MIGRATION.split(":")) {
  const mig = psqlArgs(["-f", file]);
  if (mig.status !== 0) {
    console.error(`BLOQUEADO: migration ${file} falhou\n${mig.stderr}`);
    process.exit(2);
  }
}

await run("after", "1-estrangeiro-ujr-negado", v1, "deny:42501");
cleanup();
await run("after", "2-estrangeiro-ups-negado", v2, "deny:42501");
cleanup();
await run("after", "3-admin-wk-concede-cargo", v3, "ok");
await run(
  "after",
  "3b-admin-wk-concede-pacote",
  insUps(1, { user_id: U(2), owner_id: WA, workspace_id: WA, set_id: S_FINADM }),
  "ok",
);
await run(
  "after",
  "4-membro-comum-negado",
  insUjr(2, { user_id: U(3), owner_id: WA, workspace_id: WA, role_id: R_FIN }),
  "deny:42501",
);
await run(
  "after",
  "4b-membro-com-owner-proprio-negado",
  insUjr(2, { user_id: U(2), owner_id: U(2), workspace_id: WA, role_id: R_FIN }),
  "deny:42501",
);
await run(
  "after",
  "5-admin-wk-owner-inconsistente",
  insUjr(1, { user_id: U(3), owner_id: U(1), workspace_id: WA, role_id: R_FIN }),
  "deny:42501",
);
await run(
  "after",
  "6-cargo-de-outro-ws-negado",
  insUjr(1, { user_id: U(3), owner_id: WA, workspace_id: WA, role_id: R_B }),
  "deny:42501",
);
await run(
  "after",
  "7-alvo-inativo-negado",
  insUjr(1, { user_id: U(5), owner_id: WA, workspace_id: WA, role_id: R_FIN }),
  "deny:42501",
);
await run(
  "after",
  "8-estrangeiro-nao-le-wk",
  async () =>
    String(
      ((await (await as(6)).from("user_job_roles").select("id").eq("workspace_id", WA)).data ?? [])
        .length,
    ),
  "0",
);
await run(
  "after",
  "9-estrangeiro-nao-apaga-wk",
  async () => {
    await (await as(6)).from("user_job_roles").delete().eq("workspace_id", WA);
    return psql(
      `select count(*) from public.user_job_roles where role_id='${R_FIN}' and workspace_id='${WA}'`,
    );
  },
  "1",
);
await run(
  "after",
  "10-estrangeiro-nao-move-linha",
  async () => {
    await (await as(6))
      .from("user_job_roles")
      .update({ workspace_id: WB, owner_id: WB })
      .eq("role_id", R_FIN);
    return psql(`select workspace_id from public.user_job_roles where role_id='${R_FIN}'`);
  },
  WA,
);
await run(
  "after",
  "11-admin-b-concede-no-proprio-ws",
  insUjr(6, { user_id: U(6), owner_id: WB, workspace_id: WB, role_id: R_B }),
  "ok",
);
await run(
  "after",
  "12-admin-wk-nao-le-ws-b",
  async () =>
    String(
      ((await (await as(1)).from("user_job_roles").select("id").eq("workspace_id", WB)).data ?? [])
        .length,
    ),
  "0",
);
await run(
  "after",
  "13-membro-le-propria",
  async () =>
    String(
      ((await (await as(2)).from("user_job_roles").select("id").eq("role_id", R_FIN)).data ?? [])
        .length,
    ),
  "1",
);
await run(
  "after",
  "14-admin-wk-remove",
  async () => {
    await (await as(1)).from("user_job_roles").delete().eq("role_id", R_FIN);
    return psql(`select count(*) from public.user_job_roles where role_id='${R_FIN}'`);
  },
  "0",
);
await run(
  "after",
  "15-anon-negado",
  async () =>
    ok(
      (
        await createClient(URL_, anonKey!, { auth: { persistSession: false } })
          .from("user_job_roles")
          .insert({ user_id: U(2), owner_id: WA, workspace_id: WA, role_id: R_FIN })
      ).error,
    ),
  "deny:42501",
);
cleanup();
// Regressão 0129: criador (U1, created_by de WA) com participação inativa não administra.
const setU1 = (status: string, role: string) =>
  psql(
    `update public.workspace_members set status='${status}', role='${role}' where workspace_id='${WA}' and user_id='${U(1)}'`,
  );
const grantFin = insUjr(1, { user_id: U(3), owner_id: WA, workspace_id: WA, role_id: R_FIN });
setU1("inactive", "admin");
await run("after", "16-criador-inativo-negado", grantFin, "deny:42501");
cleanup();
setU1("inactive", "member");
await run("after", "16b-criador-inativo-membro-negado", grantFin, "deny:42501");
cleanup();
psql(`delete from public.workspace_members where workspace_id='${WA}' and user_id='${U(1)}'`);
await run("after", "16c-criador-sem-participacao-negado", grantFin, "deny:42501");
cleanup();
psql(
  `insert into public.workspace_members(workspace_id,user_id,role,status) values ('${WA}','${U(1)}','member','active')`,
);
await run("after", "17-criador-ativo-membro-concede", grantFin, "ok");
cleanup();
setU1("active", "admin");
await run("after", "18-admin-restaurado-concede", grantFin, "ok");
cleanup();
await run(
  "after",
  "19-fn-criador-inativo-false",
  async () => {
    setU1("inactive", "admin");
    const v = psql(`select public.is_active_workspace_admin('${WA}','${U(1)}')`);
    setU1("active", "admin");
    return v;
  },
  "f",
);
const fails = results.filter((r) => r.status === "fail");
mkdirSync(`${root}/artifacts`, { recursive: true });
writeFileSync(
  `${root}/artifacts/rbac-wk-phase6.json`,
  JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
);
for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(38)} ${r.detail}`);
console.log(
  `\n${results.filter((r) => r.status === "pass").length} pass / ${fails.length} fail / ${results.filter((r) => r.status === "observed").length} observados antes`,
);
proxy.stop();
process.exit(fails.length ? 1 : 0);
