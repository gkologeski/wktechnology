#!/usr/bin/env bash
# Runner da prova isolada do ciclo 4 (TechProjects: tarifas, medições, Financeiro, rentabilidade).
# Exige o harness em scripts/isolated-db (estrutura real extraída, sem dados).
# Uso: bash tests/sql/project-billing-isolated.sh [<migração.sql> ...]
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null
for MIG in "$@"; do iso_psql -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1 || { echo "FALHOU ao aplicar $MIG"; iso_psql -v ON_ERROR_STOP=1 -f "$MIG" 2>&1 | grep -m3 ERROR; exit 1; }; done
OUT=$(mktemp)
iso_psql -f tests/sql/project-billing-isolated.sql > "$OUT" 2>&1 || true
grep -E "ok:|FALHOU|ERROR" "$OUT" || true
if grep -qE "FALHOU|ERROR" "$OUT"; then echo "FALHOU: erro na primeira etapa"; grep -B2 -A3 -m1 "ERROR" "$OUT" || true; exit 1; fi
grep -q "concurrency-point" "$OUT" || { echo "FALHOU antes do ponto de concorrência"; exit 1; }
U3=10000000-0000-4000-8000-000000000003
U4=10000000-0000-4000-8000-000000000004
A=aaaaaaaa-0000-4000-8000-00000000000a
M=$(iso_psql -tAc "select v from t_c4.kv where k='MREADY'")
H=$(iso_psql -tAc "select lines_hash from public.project_measurements where id='$M'")
as_u() { iso_psql -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$1\",\"role\":\"authenticated\"}',true); $2; select pg_sleep(0.3); commit;" >/dev/null 2>&1 || true; }
# Duas abas geram a mesma medição enquanto o tick legado tenta faturar o serviço; e duas abas medem o mesmo pacote.
pids=()
as_u "$U4" "select public.project_measurement_generate('$M','$H','2026-09-15')" & pids+=($!)
as_u "$U4" "select public.project_measurement_generate('$M','$H','2026-09-15')" & pids+=($!)
iso_psql -c "insert into public.financial_entries (workspace_id, owner_id, direction, origin_type, origin_id, service_id, description, amount, currency, competence_date, due_date, status) values ('$A','10000000-0000-4000-8000-000000000001','receivable','service','c4100000-0000-4000-8000-000000000002','c4100000-0000-4000-8000-000000000002','tick concorrente',1,'BRL','2026-08-01','2026-08-01','open')" >/dev/null 2>&1 & pids+=($!)
as_u "$U3" "select public.project_measurement_build('c4800000-0000-4000-8000-000000000003','2026-10-01','regular','America/Sao_Paulo')" & pids+=($!)
as_u "$U3" "select public.project_measurement_build('c4800000-0000-4000-8000-000000000003','2026-10-01','regular','America/Sao_Paulo')" & pids+=($!)
for p in "${pids[@]}"; do wait "$p" || true; done
FE=$(iso_psql -tAc "select count(*) from public.financial_entries where external_ref like 'project_measurement:$M:%'")
LK=$(iso_psql -tAc "select count(*) from public.project_measurement_financial_links where measurement_id='$M' and active")
ST=$(iso_psql -tAc "select status from public.project_measurements where id='$M'")
TK=$(iso_psql -tAc "select count(*) from public.financial_entries where service_id='c4100000-0000-4000-8000-000000000002' and origin_type::text='service'")
PK=$(iso_psql -tAc "select count(*) from public.project_measurements where config_id='c4800000-0000-4000-8000-000000000003' and period_from='2026-10-01'")
[ "$FE" = "1" ] && [ "$LK" = "1" ] && [ "$ST" = "generated" ] && echo "ok: duas gerações simultâneas → um título e um vínculo" || { echo "FALHOU: títulos=$FE vínculos=$LK situação=$ST"; exit 1; }
[ "$TK" = "0" ] && echo "ok: tick legado concorrente não fatura serviço com dono Medições" || { echo "FALHOU: títulos do tick=$TK"; exit 1; }
[ "$PK" = "1" ] && echo "ok: duas medições simultâneas do pacote → uma só" || { echo "FALHOU: medições do pacote=$PK"; exit 1; }
BILLED=$(iso_psql -tAc "select count(*) from public.project_time_entries where financial_entry_id is not null or invoiced_at is not null or invoice_id is not null")
[ "$BILLED" = "0" ] && echo "ok: nenhum apontamento marcado como faturado pelas medições" || { echo "FALHOU: apontamentos marcados=$BILLED"; exit 1; }
echo "FIM: todas as asserções passaram"
