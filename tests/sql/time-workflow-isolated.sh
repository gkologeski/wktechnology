#!/usr/bin/env bash
# Runner da prova isolada do ciclo 3 (TechProjects: apontamento, cronômetro, aprovação, fechamento).
# Exige o harness em scripts/isolated-db (estrutura real extraída, sem dados).
# Uso: bash tests/sql/time-workflow-isolated.sh <migração.sql> [<migração.sql> ...]
set -euo pipefail
cd "$(dirname "$0")/../.."
[ "$#" -ge 1 ] || { echo "informe as migrações"; exit 2; }
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null
for MIG in "$@"; do iso_psql -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1 || { echo "FALHOU ao aplicar $MIG"; iso_psql -v ON_ERROR_STOP=1 -f "$MIG" 2>&1 | grep -m3 ERROR; exit 1; }; done
OUT=$(mktemp)
iso_psql -f tests/sql/time-workflow-isolated.sql > "$OUT" 2>&1 || true
grep -E "ok:|FALHOU|ERROR" "$OUT" || true
if grep -qE "FALHOU|ERROR" "$OUT"; then echo "FALHOU: erro na primeira etapa"; exit 1; fi
grep -q "concurrency-point" "$OUT" || { echo "FALHOU antes do ponto de concorrência"; exit 1; }
U7=10000000-0000-4000-8000-000000000007
A=aaaaaaaa-0000-4000-8000-00000000000a
P1=83000000-0000-4000-8000-000000000001
as_u7() { iso_psql -v ON_ERROR_STOP=1 -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$U7\",\"role\":\"authenticated\"}',true); $1; select pg_sleep(0.5); commit;" >/dev/null 2>&1 || true; }
# Duas abas iniciam o cronômetro ao mesmo tempo (pedidos diferentes) e duas abas enviam o mesmo período.
iso_psql -c "insert into public.project_time_entries (workspace_id, project_id, user_id, entry_date, start_time, end_time) values ('$A','$P1','$U7','2026-04-01','09:00','10:00');" >/dev/null
pids=()
as_u7 "select public.project_timer_start('$A','$P1',null,null,true,'America/Sao_Paulo','tab-a')" & pids+=($!)
as_u7 "select public.project_timer_start('$A','$P1',null,null,true,'America/Sao_Paulo','tab-b')" & pids+=($!)
as_u7 "select public.project_timesheet_submit('$A','2026-04-01','2026-04-07',null,null)" & pids+=($!)
as_u7 "select public.project_timesheet_submit('$A','2026-04-01','2026-04-07',null,null)" & pids+=($!)
for p in "${pids[@]}"; do wait "$p"; done
ACTIVE=$(iso_psql -tAc "select count(*) from public.project_timer_sessions where user_id='$U7' and state in ('running','paused')")
SUBS=$(iso_psql -tAc "select count(*) from public.project_timesheet_submissions where user_id='$U7' and period_from='2026-04-01'")
ITEMS=$(iso_psql -tAc "select count(*) from public.project_timesheet_submission_items i join public.project_timesheet_submissions s on s.id=i.submission_id where s.user_id='$U7' and s.period_from='2026-04-01'")
[ "$ACTIVE" = "1" ] && echo "ok: duas abas simultâneas → um único cronômetro ativo" || { echo "FALHOU: cronômetros ativos=$ACTIVE"; exit 1; }
[ "$SUBS" = "1" ] && [ "$ITEMS" = "1" ] && echo "ok: dois envios simultâneos → uma versão e um item" || { echo "FALHOU: envios=$SUBS itens=$ITEMS"; exit 1; }
echo "FIM: todas as asserções passaram"
