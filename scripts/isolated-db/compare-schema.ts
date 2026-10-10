// Compara (somente leitura, só catálogo) a estrutura do projeto com a do banco isolado.
// Gera $ISO_ROOT/fidelity.json com contagens e divergências por categoria. Exit 1 se houver divergência.
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.env.ISO_ROOT ?? "/tmp/techerp-isolated";
const localEnv: Record<string, string | undefined> = { ...process.env };
for (const k of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]) delete localEnv[k];
const LOCAL = ["-h", `${root}/sock`, "-p", process.env.ISO_PORT ?? "54329", "-U", "postgres", "-d", "postgres"];

const CHECKS: Record<string, string> = {
  policies: `select tablename||'.'||policyname k, md5(permissive||cmd||roles::text||coalesce(qual,'')||coalesce(with_check,'')) v
             from pg_policies where schemaname='public'`,
  functions: `select p.oid::regprocedure::text k, md5(p.prosrc||p.prosecdef::text||p.provolatile||coalesce(p.proconfig::text,'')||pg_get_function_result(p.oid)) v
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
              and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')`,
  columns: `select table_name||'.'||column_name k, md5(data_type||is_nullable||coalesce(column_default,'')||coalesce(generation_expression,'')) v
            from information_schema.columns where table_schema='public' and table_name <> '__isolated_marker'`,
  table_grants: `select c.relname||':'||coalesce(r.rolname,'PUBLIC')||':'||a.privilege_type k, '1' v
                 from pg_class c join pg_namespace n on n.oid=c.relnamespace, aclexplode(c.relacl) a left join pg_roles r on r.oid=a.grantee
                 where n.nspname='public' and coalesce(r.rolname,'PUBLIC') in ('anon','authenticated','service_role','PUBLIC') and c.relname <> '__isolated_marker'`,
  function_grants: `select p.oid::regprocedure::text||':'||coalesce(r.rolname,'PUBLIC') k, '1' v
                    from pg_proc p join pg_namespace n on n.oid=p.pronamespace, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                    left join pg_roles r on r.oid=a.grantee where n.nspname='public'
                    and coalesce(r.rolname,'PUBLIC') in ('anon','authenticated','service_role','PUBLIC')
                    and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')`,
  rls: `select relname k, relrowsecurity::text||relforcerowsecurity::text v from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and relkind='r' and relname <> '__isolated_marker'`,
  triggers: `select c.relname||'.'||t.tgname k, md5(pg_get_triggerdef(t.oid)) v from pg_trigger t join pg_class c on c.oid=t.tgrelid
             join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and c.relname='users'))`,
  constraints: `select c.relname||'.'||k.conname k, md5(pg_get_constraintdef(k.oid)) v from pg_constraint k join pg_class c on c.oid=k.conrelid
                join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname <> '__isolated_marker'`,
  indexes: `select indexname k, md5(indexdef) v from pg_indexes where schemaname='public' and tablename <> '__isolated_marker'`,
  views: `select viewname k, md5(definition) v from pg_views where schemaname='public'`,
  publication: `select tablename k, '1' v from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'`,
};

function run(local: boolean, sql: string): Map<string, string> {
  const r = spawnSync("psql", ["-X", "-tA", "-F", "\t", ...(local ? LOCAL : []), "-c", sql],
    { encoding: "utf8", env: (local ? localEnv : process.env) as NodeJS.ProcessEnv, maxBuffer: 1 << 27 });
  if (r.status !== 0) throw new Error(r.stderr);
  return new Map(r.stdout.trim().split("\n").filter(Boolean).map((l) => l.split("\t") as [string, string]));
}

const report: Record<string, unknown> = {};
let diverged = 0;
for (const [name, sql] of Object.entries(CHECKS)) {
  const a = run(false, sql), b = run(true, sql);
  const onlyProject = [...a.keys()].filter((k) => !b.has(k));
  const onlyIsolated = [...b.keys()].filter((k) => !a.has(k));
  const different = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  diverged += onlyProject.length + onlyIsolated.length + different.length;
  report[name] = { project: a.size, isolated: b.size, onlyProject, onlyIsolated, different };
  console.log(`${name.padEnd(16)} projeto=${a.size} isolado=${b.size} faltando=${onlyProject.length} extra=${onlyIsolated.length} diferente=${different.length}`);
}
writeFileSync(`${root}/fidelity.json`, JSON.stringify({ generatedAt: new Date().toISOString(), diverged, report }, null, 2));
process.exit(diverged ? 1 : 0);
