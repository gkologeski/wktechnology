#!/usr/bin/env bash
# Runner da prova isolada do ciclo 2 (TechProjects: negócio ganho -> entrega). Exige o harness em scripts/isolated-db.
# Uso: bash tests/sql/deal-delivery-isolated.sh <migração.sql> [<migração.sql> ...]
set -euo pipefail
cd "$(dirname "$0")/../.."
[ "$#" -ge 1 ] || { echo "informe as migrações"; exit 2; }
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null
for MIG in "$@"; do iso_psql -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1 || { echo "FALHOU ao aplicar $MIG"; exit 1; }; done
OUT=$(mktemp)
iso_psql -f tests/sql/deal-delivery-isolated.sql > "$OUT" 2>&1 || true
grep -E "ok:|FALHOU|ERROR" "$OUT" || true
if grep -qE "FALHOU|ERROR" "$OUT"; then echo "FALHOU: erro na primeira etapa"; exit 1; fi
grep -q "concurrency-point" "$OUT" || { echo "FALHOU antes do ponto de concorrência"; exit 1; }
# Concorrência real: sessões paralelas sobre o mesmo negócio.
iso_psql -c "insert into public.deals (id, workspace_id, owner_id, name, value, stage, company_id) values
  ('52000000-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000004','[ISO] Concorrência workflow',1,'won','61000000-0000-4000-8000-0000000000c1'),
  ('52000000-0000-4000-8000-000000000011','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000004','[ISO] Concorrência criação',1,'won','61000000-0000-4000-8000-0000000000c1');" >/dev/null
create_as_u4() {
  iso_psql -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"10000000-0000-4000-8000-000000000004\",\"role\":\"authenticated\"}',true); select public.deal_delivery_create_project('52000000-0000-4000-8000-000000000011'); select pg_sleep(1); commit;" >/dev/null
}
wf() { iso_psql -v ON_ERROR_STOP=1 -c "begin; select public.deal_delivery_workflow_ensure('52000000-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-00000000000a'); select pg_sleep(1); commit;" >/dev/null; }
worker() { iso_psql -v ON_ERROR_STOP=1 -c "begin; select public.deal_delivery_run_jobs(50); select pg_sleep(1); commit;" >/dev/null; }
pids=()
create_as_u4 & pids+=($!); create_as_u4 & pids+=($!); worker & pids+=($!); wf & pids+=($!); wf & pids+=($!)
for p in "${pids[@]}"; do wait "$p" || { echo "FALHOU: chamada concorrente com erro"; exit 1; }; done
OUT2=$(mktemp)
iso_psql -f tests/sql/deal-delivery-isolated-after.sql > "$OUT2" 2>&1 || true
grep -E "ok:|FALHOU|ERROR|FIM" "$OUT2" || true
if grep -qE "FALHOU|ERROR" "$OUT2" || ! grep -q "FIM: todas as asserções passaram" "$OUT2"; then
  echo "FALHOU: provas finais"; exit 1
fi
