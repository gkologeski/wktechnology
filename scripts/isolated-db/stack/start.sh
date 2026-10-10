#!/usr/bin/env bash
# Sobe: PostgreSQL descartável → migrations OFICIAIS do GoTrue (schema auth real) → bootstrap sem o
# stub de auth → estrutura real do projeto → GoTrue + PostgREST em 127.0.0.1. Sem SMTP (e-mail
# desligado, autoconfirmação só nesta stack), sem provedores externos.
set -euo pipefail
cd "$(dirname "$0")/../../.."
. scripts/isolated-db/stack/env.sh
for b in "$GOTRUE_BIN" "$POSTGREST_BIN"; do [ -x "$b" ] || { echo "PRECONDIÇÃO: $b ausente (nix build nixpkgs#gotrue-supabase nixpkgs#postgrest)" >&2; exit 3; }; done
SCHEMA=/tmp/techerp-isolated/schema.sql
[ -s "$SCHEMA" ] || { echo "PRECONDIÇÃO: rode extract-schema.ts (gera $SCHEMA)" >&2; exit 3; }
if [ ! -d "$STACK_SRC/auth-$GOTRUE_VERSION/migrations" ]; then
  mkdir -p "$STACK_SRC"; curl -fsSL "https://github.com/supabase/auth/archive/v$GOTRUE_VERSION.tar.gz" | tar xz -C "$STACK_SRC"
fi
mkdir -p "$ISO_ROOT" "$ISO_SOCK" "$ISO_DATA"; chown "$ISO_OS_USER" "$ISO_SOCK" "$ISO_DATA"; touch "$ISO_LOG"; chown "$ISO_OS_USER" "$ISO_LOG"
[ -f "$ISO_ROOT/jwt.secret" ] || head -c 48 /dev/urandom | base64 | tr -d '\n/+=' > "$ISO_ROOT/jwt.secret"
export STACK_JWT_SECRET="$(cat "$ISO_ROOT/jwt.secret")"
[ -f "$ISO_DATA/PG_VERSION" ] || runuser -u "$ISO_OS_USER" -- env PATH="$PATH" initdb -D "$ISO_DATA" -U postgres -A trust --no-sync >/dev/null
runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$ISO_DATA" status >/dev/null 2>&1 || \
  runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$ISO_DATA" -l "$ISO_LOG" -w \
    -o "-p $ISO_PORT -k $ISO_SOCK -c listen_addresses='' -c wal_level=logical -c fsync=off" start >/dev/null
DSN_AUTH="postgres://supabase_auth_admin@/postgres?host=$ISO_SOCK&port=$ISO_PORT&sslmode=disable"
if [ "$(iso_psql -tAc "select to_regclass('public.__isolated_marker') is not null")" != "t" ]; then
  # 1) papéis e extensões do bootstrap (até antes da seção auth)
  sed -n '1,/===== auth/p' scripts/isolated-db/bootstrap.sql > "$ISO_ROOT/boot-pre.sql"
  iso_psql -f "$ISO_ROOT/boot-pre.sql" >/dev/null
  iso_psql -c "ALTER ROLE supabase_auth_admin LOGIN CREATEROLE; CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin; GRANT CREATE ON DATABASE postgres TO supabase_auth_admin; ALTER ROLE supabase_auth_admin SET search_path=auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;" >/dev/null
  # 2) schema auth REAL pelas migrations oficiais do GoTrue
  ( cd "$STACK_SRC/auth-$GOTRUE_VERSION" && env -i PATH="$PATH" GOTRUE_DB_DRIVER=postgres DATABASE_URL="$DSN_AUTH" \
      GOTRUE_DB_NAMESPACE=auth GOTRUE_JWT_SECRET="$STACK_JWT_SECRET" GOTRUE_SITE_URL=http://localhost:8080 \
      API_EXTERNAL_URL=http://127.0.0.1:$STACK_AUTH_PORT GOTRUE_DB_MIGRATIONS_PATH="$PWD/migrations" \
      "$GOTRUE_BIN" migrate ) > "$ISO_ROOT/gotrue-migrate.log" 2>&1 || { echo "FALHA migrate GoTrue"; tail -5 "$ISO_ROOT/gotrue-migrate.log"; exit 4; }
  iso_psql -c "GRANT SELECT ON auth.users TO service_role;" >/dev/null
  # 3) restante do bootstrap (storage/cron/net/vault/publicação/marcador), sem o stub de auth
  sed -n '/===== storage/,$p' scripts/isolated-db/bootstrap.sql > "$ISO_ROOT/boot-post.sql"
  iso_psql -f "$ISO_ROOT/boot-post.sql" >/dev/null
  # 4) estrutura real do projeto
  iso_psql -f "$SCHEMA" > "$ISO_ROOT/schema-load.log" 2>&1 || { echo "FALHA schema"; tail -5 "$ISO_ROOT/schema-load.log"; exit 4; }
  iso_psql -c "ALTER ROLE authenticator PASSWORD NULL;" >/dev/null
fi
iso_guard
pkill -f "$GOTRUE_BIN serve" 2>/dev/null || true; pkill -f "$POSTGREST_BIN" 2>/dev/null || true
env -i PATH="$PATH" GOTRUE_DB_DRIVER=postgres DATABASE_URL="$DSN_AUTH" GOTRUE_DB_NAMESPACE=auth \
  GOTRUE_API_HOST=127.0.0.1 PORT=$STACK_AUTH_PORT GOTRUE_JWT_SECRET="$STACK_JWT_SECRET" GOTRUE_JWT_EXP=3600 \
  GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_SITE_URL=http://localhost:8080 API_EXTERNAL_URL=http://127.0.0.1:$STACK_AUTH_PORT \
  GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true \
  GOTRUE_SMTP_HOST=smtp.techerp-test.invalid GOTRUE_SMTP_PORT=2525 GOTRUE_EXTERNAL_PHONE_ENABLED=false \
  GOTRUE_RATE_LIMIT_EMAIL_SENT=0 \
  nohup "$GOTRUE_BIN" serve > "$ISO_ROOT/gotrue.log" 2>&1 &
cat > "$ISO_ROOT/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@/postgres?host=$ISO_SOCK&port=$ISO_PORT"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$STACK_JWT_SECRET"
server-host = "127.0.0.1"
server-port = $STACK_REST_PORT
db-pool = 5
CONF
nohup "$POSTGREST_BIN" "$ISO_ROOT/postgrest.conf" > "$ISO_ROOT/postgrest.log" 2>&1 &
for i in $(seq 1 60); do
  a=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$STACK_AUTH_PORT/health || true)
  r=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$STACK_REST_PORT/ || true)
  [ "$a" = 200 ] && [ "$r" = 200 ] && { echo "stack pronta: auth :$STACK_AUTH_PORT rest :$STACK_REST_PORT"; exit 0; }
  sleep 1
done
echo "FALHA: serviços não responderam (auth=$a rest=$r)"; tail -5 "$ISO_ROOT/gotrue.log" "$ISO_ROOT/postgrest.log"; exit 4
