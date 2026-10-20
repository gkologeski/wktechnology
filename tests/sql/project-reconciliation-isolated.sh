#!/usr/bin/env bash
# Runner da prova isolada do ciclo 1 (TechProjects). Exige o harness em scripts/isolated-db.
# Uso: bash tests/sql/project-reconciliation-isolated.sh <arquivo-da-migração.sql>
set -euo pipefail
cd "$(dirname "$0")/../.."
MIG="${1:?informe o arquivo da migração}"
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null
iso_psql -f "$MIG" >/dev/null 2>&1
OUT=$(mktemp)
iso_psql -f tests/sql/project-reconciliation-isolated.sql 2>&1 | tee "$OUT" | grep -E "ok:|FALHOU|ERROR" || true
grep -q "concurrency-point" "$OUT" || { echo "FALHOU antes do ponto de concorrência"; exit 1; }
apply() {
  iso_psql -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"10000000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',true); select public.project_links_apply_exact('aaaaaaaa-0000-4000-8000-00000000000a'); select pg_sleep(1); commit;" >/dev/null
}
apply & apply & wait
iso_psql -f tests/sql/project-reconciliation-isolated-after.sql 2>&1 | grep -E "ok:|FALHOU|ERROR|FIM" || true
