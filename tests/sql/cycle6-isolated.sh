#!/usr/bin/env bash
# Runner da prova isolada do ciclo 6 (TechProjects: API sob RLS do dono da chave, idempotência,
# fila offline, competência fechada na criação, operação e privilégios) + concorrência.
# Uso: bash tests/sql/cycle6-isolated.sh drizzle/migrations/0179_*.sql
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
iso_psql -f tests/sql/cycle6-isolated.sql > "$OUT" 2>&1 || true
grep -E "ok:|FALHOU|ERROR" "$OUT" | sed 's/^.*NOTICE:  //' || true
if grep -qE "FALHOU|ERROR" "$OUT"; then echo "FALHOU"; grep -B2 -A6 -m1 -E "FALHOU|ERROR" "$OUT" || true; exit 1; fi
grep -q "fim" "$OUT" || { echo "FALHOU: roteiro incompleto"; tail -5 "$OUT"; exit 1; }
A=aaaaaaaa-0000-4000-8000-00000000000a; U2=10000000-0000-4000-8000-000000000002
K2=c6200000-0000-4000-8000-000000000002; P1=c6000000-0000-4000-8000-000000000001; T1=c6100000-0000-4000-8000-000000000001
svc() { iso_psql -tA -c "begin; set local role service_role; select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true); $1; select pg_sleep(0.3); commit;" 2>&1 || true; }
usr() { iso_psql -tA -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$U2\",\"role\":\"authenticated\"}',true); $1; select pg_sleep(0.3); commit;" 2>&1 || true; }
BODY="json_build_object('project_id','$P1','task_id','$T1','entry_date','2026-03-20','mode','duration','duration_seconds',1200)::jsonb"
N0=$(iso_psql -tAc "select count(*) from public.project_time_entries where entry_date='2026-03-20'")
# Duas requisições simultâneas da API com a mesma Idempotency-Key: um registro só.
svc "select public.project_api_create_time_entry('$K2','$U2','$A','iso-conc-0001',repeat('c',64),$BODY)" > /tmp/c6-a1.txt & p1=$!
svc "select public.project_api_create_time_entry('$K2','$U2','$A','iso-conc-0001',repeat('c',64),$BODY)" > /tmp/c6-a2.txt & p2=$!
wait $p1 $p2 || true
N1=$(iso_psql -tAc "select count(*) from public.project_time_entries where entry_date='2026-03-20'")
[ $((N1-N0)) = 1 ] && echo "ok: duas chamadas simultâneas da API com a mesma chave → 1 apontamento" || { echo "FALHOU: API concorrente criou $((N1-N0))"; cat /tmp/c6-a1.txt /tmp/c6-a2.txt; exit 1; }
# Duas abas enviando o mesmo pedido offline ao mesmo tempo: um registro só.
BODY2="json_build_object('project_id','$P1','task_id','$T1','entry_date','2026-03-21','mode','duration','duration_seconds',1500)::jsonb"
usr "select public.project_time_entry_sync('$A','c6400000-0000-4000-8000-0000000000aa',repeat('9',64),$BODY2)" > /tmp/c6-o1.txt & p1=$!
usr "select public.project_time_entry_sync('$A','c6400000-0000-4000-8000-0000000000aa',repeat('9',64),$BODY2)" > /tmp/c6-o2.txt & p2=$!
wait $p1 $p2 || true
N2=$(iso_psql -tAc "select count(*) from public.project_time_entries where entry_date='2026-03-21'")
[ "$N2" = 1 ] && echo "ok: duas abas enviando o mesmo pedido offline → 1 apontamento" || { echo "FALHOU: fila concorrente criou $N2"; cat /tmp/c6-o1.txt /tmp/c6-o2.txt; exit 1; }
grep -q '"replay": true\|"replay":true' /tmp/c6-o1.txt /tmp/c6-o2.txt && echo "ok: a segunda aba recebe o resultado já gravado (replay)" || { echo "FALHOU: nenhuma aba recebeu replay"; cat /tmp/c6-o1.txt /tmp/c6-o2.txt; exit 1; }
LEFT=$(iso_psql -tAc "select count(*) from techerp_api.subject_sessions")
[ "$LEFT" = 0 ] && echo "ok: nenhuma sessão de sujeito sobra após concorrência" || { echo "FALHOU: $LEFT sessões sobraram"; exit 1; }
echo "FIM: todas as asserções passaram"
