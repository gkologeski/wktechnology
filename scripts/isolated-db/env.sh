# Ambiente do banco ISOLADO. Sempre socket local; nunca herda PG* do projeto compartilhado.
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGSSLMODE DATABASE_URL SUPABASE_DB_URL
export ISO_ROOT="${ISO_ROOT:-/tmp/techerp-isolated}"
export ISO_DATA="$ISO_ROOT/data"
export ISO_SOCK="$ISO_ROOT/sock"
export ISO_PORT="${ISO_PORT:-54329}"
export ISO_LOG="$ISO_ROOT/postgres.log"
export ISO_OS_USER="${ISO_OS_USER:-techerp_iso}"
export ISO_PROJECT_REF="czrmhtzaeonzjmbgbabz"

iso_psql() { psql -X -q -v ON_ERROR_STOP=1 -h "$ISO_SOCK" -p "$ISO_PORT" -U postgres -d postgres "$@"; }

# Recusa qualquer alvo que não seja o socket local do harness com o marcador presente.
iso_guard() {
  case "$ISO_SOCK" in /tmp/*) ;; *) echo "GUARD: socket fora de /tmp" >&2; return 1;; esac
  case "$ISO_SOCK$ISO_ROOT" in *"$ISO_PROJECT_REF"*|*supabase.co*|*pooler*) echo "GUARD: alvo compartilhado recusado" >&2; return 1;; esac
  local m; m=$(iso_psql -tAc "select label from public.__isolated_marker where id=1" 2>/dev/null || true)
  [ "$m" = "techerp-isolated-harness" ] || { echo "GUARD: marcador do banco isolado ausente" >&2; return 1; }
}
