#!/usr/bin/env bash
# Ciclo 6: stack isolada (GoTrue + PostgREST reais) + migração do ciclo + prova HTTP das rotas da API v1.
# Uso: bash scripts/isolated-db/stack/run-cycle6.sh drizzle/migrations/0179_*.sql
# Exit: 0 tudo | 1 falha | 2 bloqueado.
set -uo pipefail
cd "$(dirname "$0")/../../.."
bash scripts/isolated-db/stack/stop.sh >/dev/null 2>&1 || true
rm -rf /tmp/techerp-stack/data
bash scripts/isolated-db/stack/start.sh || exit 2
. scripts/isolated-db/stack/env.sh
iso_guard || exit 2
iso_psql -f scripts/isolated-db/seed.sql >/dev/null || { echo "seed falhou"; exit 1; }
for MIG in "$@"; do iso_psql -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null || { echo "FALHOU ao aplicar $MIG"; exit 1; }; done
STACK_JWT_SECRET="$STACK_JWT_SECRET" bun scripts/isolated-db/stack/cycle6-http.ts; rc=$?
[ "${ISO_KEEP:-0}" = 1 ] || bash scripts/isolated-db/stack/stop.sh
exit $rc
