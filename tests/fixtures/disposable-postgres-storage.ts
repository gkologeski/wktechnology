// Only for fresh, owned --rm test clusters pinned to PostgreSQL 17's default
// PGDATA. These fixtures already disable fsync: they test real SQL/authorization,
// not persistence, restarts or crash recovery. Never use this for a real stack.
// Cap ephemeral memory without changing PostgreSQL's WAL defaults.
export const disposablePostgresStorageArgs = Object.freeze([
  "--tmpfs",
  "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m",
  "--env",
  "POSTGRES_INITDB_ARGS=--no-sync",
] as const);
