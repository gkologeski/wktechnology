import type postgres from "postgres";
import { randomUUID } from "node:crypto";

/** Data-only fixtures captured from successful real RPC setup in a disposable database.
 * Never accepts an environment URL, changes schema, replaces a resolver or skips a scenario.
 * All rows, including approval/signature evidence, come from the current version's actual setup.
 */
export type DisposableHiringSnapshot = Array<{
  schema: string;
  table: string;
  rows: unknown[];
}>;
const identifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';

export async function captureDisposableHiringSnapshot(db: postgres.Sql) {
  const tables = await db<{ schema: string; table: string }[]>`
    select schemaname as schema,tablename as table from pg_tables
    where (schemaname='public' and tablename not in ('permissions','shared_field_catalog'))
      or (schemaname='storage' and tablename='objects') order by schemaname,tablename`;
  const snapshot: DisposableHiringSnapshot = [];
  for (const table of tables) {
    const rows = await db.unsafe(
      `select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) data from ${identifier(table.schema)}.${identifier(table.table)} r`,
    );
    snapshot.push({ ...table, rows: rows[0].data });
  }
  return snapshot;
}

export async function restoreDisposableHiringSnapshot(
  db: postgres.Sql,
  snapshot: DisposableHiringSnapshot,
) {
  // This role only exists in the isolated bootstrap, never in the live integration.
  const guard =
    await db`select exists(select 1 from pg_roles where rolname='preparation_migrator') ok`;
  if (!guard[0].ok) throw Error("Disposable hiring bootstrap required");
  await db.begin(async (tx) => {
    await tx`set local session_replication_role=replica`;
    const statements: string[] = [];
    for (const { schema, table } of snapshot) {
      if (
        !(
          (schema === "public" && !["permissions", "shared_field_catalog"].includes(table)) ||
          (schema === "storage" && table === "objects")
        )
      )
        throw Error("Unexpected fixture table");
      statements.push(`delete from ${identifier(schema)}.${identifier(table)}`);
    }
    for (const { schema, table, rows } of snapshot) {
      if (!rows.length) continue;
      const target = `${identifier(schema)}.${identifier(table)}`;
      const json = JSON.stringify(rows);
      // A collision-checked dollar literal keeps arbitrary fixture text as data.
      // Send the same DELETE/INSERT operations in one round trip, with the same
      // transaction and trigger restoration before any scenario RPC is called.
      let delimiter: string;
      do delimiter = "$snapshot_" + randomUUID().replaceAll("-", "") + "$";
      while (json.includes(delimiter));
      statements.push(
        `insert into ${target} select * from jsonb_populate_recordset(null::${target},${delimiter}${json}${delimiter}::jsonb)`,
      );
    }
    if (statements.length) await tx.unsafe(statements.join(";\n"), [], { prepare: false });
    await tx`set local session_replication_role=origin`;
  });
}
