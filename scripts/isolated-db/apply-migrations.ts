// Aplica, em ordem, supabase/migrations/*.sql e depois drizzle/migrations (ordem do _journal.json)
// no banco isolado. Cada arquivo roda numa transação; falhas são registradas (nunca editadas aqui)
// em /tmp/techerp-isolated/migrations-report.json para o relatório de fidelidade.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.env.ISO_ROOT ?? "/tmp/techerp-isolated";
const sock = `${root}/sock`;
const port = process.env.ISO_PORT ?? "54329";
const env = { ...process.env } as Record<string, string | undefined>;
for (const k of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "DATABASE_URL"]) delete env[k];

const sb = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()
  .map((f) => `supabase/migrations/${f}`);
const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8")) as {
  entries: { tag: string }[];
};
const dz = journal.entries.map((e) => `drizzle/migrations/${e.tag}.sql`);

const results: { file: string; ok: boolean; error?: string }[] = [];
for (const file of [...sb, ...dz]) {
  // Divergência declarada: pg_cron/pg_net não existem no PostgreSQL local; os schemas cron/net
  // vêm do bootstrap como stubs inertes, então só o CREATE EXTENSION é neutralizado.
  const sql = readFileSync(file, "utf8")
    .replaceAll("--> statement-breakpoint", "")
    .replace(/CREATE EXTENSION IF NOT EXISTS\s+"?(pg_cron|pg_net)"?[^;]*;/gi, "/* isolated: extensão $1 substituída por stub */");
  const r = spawnSync(
    "psql",
    ["-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-h", sock, "-p", port, "-U", "postgres",
     "-d", "postgres", "-c", "SET search_path = public, extensions", "-f", "-"],
    { input: sql, env: env as NodeJS.ProcessEnv, encoding: "utf8" },
  );
  const ok = r.status === 0;
  results.push(ok ? { file, ok } : { file, ok, error: (r.stderr || "").split("\n").filter(Boolean).slice(0, 3).join(" | ") });
}
const failed = results.filter((r) => !r.ok);
writeFileSync(`${root}/migrations-report.json`, JSON.stringify({ total: results.length, failed }, null, 2));
console.log(`migrations: ${results.length - failed.length}/${results.length} aplicadas; ${failed.length} falharam`);
for (const f of failed.slice(0, 40)) console.log(` FAIL ${f.file}: ${f.error}`);
