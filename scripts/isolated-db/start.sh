#!/usr/bin/env bash
# Inicia PostgreSQL descartável (socket em /tmp, sem TCP), aplica bootstrap + migrations reais.
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
command -v initdb >/dev/null || { echo "PRECONDIÇÃO: initdb/postgres ausente" >&2; exit 3; }
id "$ISO_OS_USER" >/dev/null || { echo "PRECONDIÇÃO: usuário $ISO_OS_USER ausente" >&2; exit 3; }
mkdir -p "$ISO_ROOT" "$ISO_SOCK" "$ISO_DATA"; chown "$ISO_OS_USER" "$ISO_SOCK" "$ISO_DATA"; touch "$ISO_LOG"; chown "$ISO_OS_USER" "$ISO_LOG"
if [ ! -f "$ISO_DATA/PG_VERSION" ]; then
  runuser -u "$ISO_OS_USER" -- env PATH="$PATH" initdb -D "$ISO_DATA" -U postgres -A trust --no-sync >/dev/null
fi
if ! runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$ISO_DATA" status >/dev/null 2>&1; then
  runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$ISO_DATA" -l "$ISO_LOG" -w \
    -o "-p $ISO_PORT -k $ISO_SOCK -c listen_addresses='' -c wal_level=logical -c fsync=off" start >/dev/null
fi
if [ "$(iso_psql -tAc "select to_regclass('public.__isolated_marker') is not null")" != "t" ]; then
  iso_psql -f scripts/isolated-db/bootstrap.sql >/dev/null
  [ -s "$ISO_ROOT/schema.sql" ] || { echo "PRECONDIÇÃO: rode extract-schema.ts antes (gera $ISO_ROOT/schema.sql)" >&2; exit 3; }
  # Carrega a estrutura real; qualquer erro é reportado e interrompe (fidelidade exigida).
  if ! iso_psql -f "$ISO_ROOT/schema.sql" > "$ISO_ROOT/schema-load.log" 2>&1; then
    echo "FALHA ao carregar schema (ver $ISO_ROOT/schema-load.log)" >&2; tail -5 "$ISO_ROOT/schema-load.log" >&2; exit 4
  fi
fi
iso_guard && echo "isolated db pronto: socket $ISO_SOCK porta $ISO_PORT"
