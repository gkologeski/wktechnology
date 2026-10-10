// Extrai SOMENTE a estrutura (catálogo) do banco do projeto, em modo leitura, para recriá-la no
// banco isolado. Nenhuma linha de tabela é lida. Saída: $ISO_ROOT/schema.sql.
// Uso: bun scripts/isolated-db/extract-schema.ts   (usa o acesso de leitura PG* do ambiente)
// O alvo de ESCRITA (banco isolado) nunca recebe estas variáveis — ver load-schema.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.env.ISO_ROOT ?? "/tmp/techerp-isolated";
mkdirSync(root, { recursive: true });

function q<T>(sql: string): T[] {
  const r = spawnSync(
    "psql",
    [
      "-X",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `select coalesce(json_agg(t), '[]'::json) from (${sql}) t`,
    ],
    { encoding: "utf8", maxBuffer: 1 << 28 },
  );
  if (r.status !== 0) throw new Error(`catálogo: ${r.stderr}`);
  return JSON.parse(r.stdout.trim()) as T[];
}

const NS = "n.nspname = 'public'";
const notExt = (cls: string, oid: string) =>
  `not exists (select 1 from pg_depend d where d.classid = '${cls}'::regclass and d.objid = ${oid} and d.deptype = 'e')`;
const ROLES = "('anon','authenticated','service_role','PUBLIC')";
const out: string[] = [
  "-- Gerado por scripts/isolated-db/extract-schema.ts (somente estrutura, sem dados).",
  "SET check_function_bodies = off;",
  "SET search_path = public, extensions;",
];
const sec = (t: string) => out.push(`\n-- ==== ${t} ====`);

sec("enums");
for (const e of q<{ name: string; labels: string[] }>(`
  select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
  from pg_type t join pg_namespace n on n.oid = t.typnamespace join pg_enum e on e.enumtypid = t.oid
  where ${NS} and ${notExt("pg_type", "t.oid")} group by t.typname order by 1`))
  out.push(
    `CREATE TYPE public.${JSON.stringify(e.name)} AS ENUM (${e.labels.map((l) => `'${l.replaceAll("'", "''")}'`).join(", ")});`,
  );

sec("sequências");
for (const s of q<{
  name: string;
}>(`select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where ${NS} and c.relkind = 'S' and ${notExt("pg_class", "c.oid")} order by 1`))
  out.push(
    `CREATE SEQUENCE IF NOT EXISTS public.${JSON.stringify(s.name)};`,
    `REVOKE ALL ON SEQUENCE public.${JSON.stringify(s.name)} FROM anon, authenticated, service_role, PUBLIC;`,
  );

type Col = {
  tbl: string;
  col: string;
  typ: string;
  notnull: boolean;
  def: string | null;
  gen: string;
  ident: string;
  num: number;
};
const cols = q<Col>(`
  select c.relname as tbl, a.attname as col, format_type(a.atttypid, a.atttypmod) as typ, a.attnotnull as notnull,
         pg_get_expr(ad.adbin, ad.adrelid) as def, a.attgenerated as gen, a.attidentity as ident, a.attnum as num
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
  where ${NS} and c.relkind in ('r','p') and ${notExt("pg_class", "c.oid")} order by c.relname, a.attnum`);
const tables = [...new Set(cols.map((c) => c.tbl))];
const id = (s: string) => JSON.stringify(s);

sec("tabelas (sem defaults; colunas geradas depois das funções)");
for (const t of tables) {
  const cs = cols.filter((c) => c.tbl === t && c.gen === "");
  out.push(
    `CREATE TABLE public.${id(t)} (\n${cs
      .map(
        (c) =>
          `  ${id(c.col)} ${c.typ}${c.ident ? ` GENERATED ${c.ident === "a" ? "ALWAYS" : "BY DEFAULT"} AS IDENTITY` : ""}${c.notnull ? " NOT NULL" : ""}`,
      )
      .join(",\n")}\n);`,
  );
}

sec("funções");
for (const f of q<{
  def: string;
}>(`select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where ${NS} and p.prokind in ('f','p') and ${notExt("pg_proc", "p.oid")} order by p.proname, p.oid`))
  out.push(`${f.def.trim()};`);

sec("colunas geradas e defaults");
for (const c of cols.filter((c) => c.gen !== ""))
  out.push(
    `ALTER TABLE public.${id(c.tbl)} ADD COLUMN ${id(c.col)} ${c.typ} GENERATED ALWAYS AS (${c.def}) STORED;`,
  );
for (const c of cols.filter((c) => c.gen === "" && c.def && !c.ident))
  out.push(`ALTER TABLE public.${id(c.tbl)} ALTER COLUMN ${id(c.col)} SET DEFAULT ${c.def};`);

type Con = { tbl: string; name: string; def: string; type: string };
const cons =
  q<Con>(`select c.relname as tbl, k.conname as name, pg_get_constraintdef(k.oid) as def, k.contype as type
  from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
  where ${NS} and ${notExt("pg_class", "c.oid")} and k.contype in ('p','u','c','f','x') order by (k.contype = 'f'), c.relname, k.conname`);
sec("restrições");
for (const k of cons) {
  // FKs para auth.users e demais schemas gerenciados são mantidas: o bootstrap cria auth.users.
  out.push(`ALTER TABLE public.${id(k.tbl)} ADD CONSTRAINT ${id(k.name)} ${k.def};`);
}

sec("índices");
for (const i of q<{ def: string }>(`select pg_get_indexdef(i.indexrelid) as def from pg_index i
  join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace
  where ${NS} and ${notExt("pg_class", "c.oid")}
    and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid) order by 1`))
  out.push(`${i.def};`);

sec("views");
for (const v of q<{
  name: string;
  def: string;
  kind: string;
  opts: string[] | null;
}>(`select c.relname as name, pg_get_viewdef(c.oid) as def,
  c.relkind as kind, c.reloptions as opts from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where ${NS} and c.relkind in ('v','m') order by 1`))
  out.push(
    `CREATE ${v.kind === "m" ? "MATERIALIZED VIEW" : "VIEW"} public.${id(v.name)}${v.opts?.length ? ` WITH (${v.opts.join(", ")})` : ""} AS ${v.def.trim().replace(/;$/, "")};`,
  );

sec("triggers (public e auth.users)");
for (const t of q<{ def: string }>(`select pg_get_triggerdef(t.oid) as def from pg_trigger t
  join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and (${NS} or (n.nspname = 'auth' and c.relname = 'users')) order by 1`))
  out.push(`${t.def};`);

sec("RLS e políticas");
for (const r of q<{
  tbl: string;
  rls: boolean;
  force: boolean;
}>(`select c.relname as tbl, c.relrowsecurity as rls, c.relforcerowsecurity as force
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where ${NS} and c.relkind in ('r','p') and (c.relrowsecurity or c.relforcerowsecurity)`)) {
  if (r.rls) out.push(`ALTER TABLE public.${id(r.tbl)} ENABLE ROW LEVEL SECURITY;`);
  if (r.force) out.push(`ALTER TABLE public.${id(r.tbl)} FORCE ROW LEVEL SECURITY;`);
}
for (const p of q<{
  tbl: string;
  name: string;
  permissive: string;
  cmd: string;
  roles: string[];
  qual: string | null;
  chk: string | null;
}>(`
  select tablename as tbl, policyname as name, permissive, cmd, roles, qual, with_check as chk
  from pg_policies where schemaname = 'public' order by tablename, policyname`))
  out.push(
    `CREATE POLICY ${id(p.name)} ON public.${id(p.tbl)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map((r) => (r === "public" ? "public" : id(r))).join(", ")}${p.qual ? ` USING (${p.qual})` : ""}${p.chk ? ` WITH CHECK (${p.chk})` : ""};`,
  );

sec("privilégios (tabelas, colunas, funções, sequências)");
for (const t of tables.concat(
  q<{ name: string }>(
    `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where ${NS} and c.relkind in ('v','m')`,
  ).map((v) => v.name),
))
  out.push(`REVOKE ALL ON public.${id(t)} FROM anon, authenticated, service_role, PUBLIC;`);
for (const g of q<{ tbl: string; priv: string; grantee: string; kind: string }>(`
  select c.relkind as kind, c.relname as tbl, a.privilege_type as priv, coalesce(r.rolname, 'PUBLIC') as grantee
  from pg_class c join pg_namespace n on n.oid = c.relnamespace, aclexplode(c.relacl) a
  left join pg_roles r on r.oid = a.grantee where ${NS} and c.relkind in ('r','p','v','m','S') and coalesce(r.rolname,'PUBLIC') in ${ROLES}`))
  out.push(
    `GRANT ${g.priv} ON ${g.kind === "S" ? "SEQUENCE" : "TABLE"} public.${id(g.tbl)} TO ${g.grantee === "PUBLIC" ? "PUBLIC" : id(g.grantee)};`,
  );
for (const g of q<{ tbl: string; col: string; priv: string; grantee: string }>(`
  select c.relname as tbl, a.attname as col, x.privilege_type as priv, coalesce(r.rolname, 'PUBLIC') as grantee
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace, aclexplode(a.attacl) x
  left join pg_roles r on r.oid = x.grantee where ${NS} and a.attacl is not null and coalesce(r.rolname,'PUBLIC') in ${ROLES}`))
  out.push(
    `GRANT ${g.priv} (${id(g.col)}) ON public.${id(g.tbl)} TO ${g.grantee === "PUBLIC" ? "PUBLIC" : id(g.grantee)};`,
  );
for (const f of q<{ sig: string; acl: { priv: string; grantee: string }[] | null }>(`
  select p.oid::regprocedure::text as sig,
    (select json_agg(json_build_object('priv', x.privilege_type, 'grantee', coalesce(r.rolname, 'PUBLIC')))
       from aclexplode(p.proacl) x left join pg_roles r on r.oid = x.grantee) as acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where ${NS} and ${notExt("pg_proc", "p.oid")} and p.proacl is not null`)) {
  out.push(`REVOKE ALL ON FUNCTION ${f.sig} FROM PUBLIC, anon, authenticated, service_role;`);
  for (const a of f.acl ?? [])
    if (["anon", "authenticated", "service_role", "PUBLIC"].includes(a.grantee))
      out.push(
        `GRANT EXECUTE ON FUNCTION ${f.sig} TO ${a.grantee === "PUBLIC" ? "PUBLIC" : id(a.grantee)};`,
      );
}

sec("publicação realtime");
for (const p of q<{ tbl: string }>(
  `select tablename as tbl from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1`,
))
  out.push(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${id(p.tbl)};`);

writeFileSync(`${root}/schema.sql`, out.join("\n") + "\n");
console.log(
  `schema extraído: ${tables.length} tabelas, ${out.length} instruções → ${root}/schema.sql`,
);

// Catálogos GLOBAIS do sistema (sem workspace, sem dados pessoais): chaves de permissão e módulos.
// Necessários para user_effective_permissions/admin; nenhuma tabela de tenant é lida.
for (const [tbl, cols] of [
  ["permissions", "key,module,resource,action,scope,label_pt,description,is_system"],
  ["modules", "id,name,host_suffix,default_color,default_product_name,icon,sort_order"],
] as const) {
  const r = spawnSync(
    "psql",
    [
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `\\copy (select ${cols} from public.${tbl} order by 1) to '${root}/ref-${tbl}.csv' with csv`,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`catálogo ${tbl}: ${r.stderr}`);
}
console.log("catálogos globais exportados: permissions, modules");
