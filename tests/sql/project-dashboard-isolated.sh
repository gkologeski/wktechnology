#!/usr/bin/env bash
# Runner da prova isolada do ciclo 5 (TechProjects: painel por perfil, capacidade, alertas e previsão).
# Exige o harness em scripts/isolated-db (estrutura real extraída, sem dados).
# Uso: bash tests/sql/project-dashboard-isolated.sh [<migração.sql> ...]
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
START=$(date +%s%N)
iso_psql -f tests/sql/project-dashboard-isolated.sql > "$OUT" 2>&1 || true
END=$(date +%s%N)
grep -E "ok:|FALHOU|ERROR" "$OUT" || true
if grep -qE "FALHOU|ERROR" "$OUT"; then echo "FALHOU"; grep -B2 -A6 -m1 -E "FALHOU|ERROR" "$OUT" || true; exit 1; fi
grep -q "fim" "$OUT" || { echo "FALHOU: roteiro incompleto"; tail -5 "$OUT"; exit 1; }
U1=10000000-0000-4000-8000-000000000001
F='{"from":"2026-01-01","to":"2026-10-31","tz":"America/Sao_Paulo"}'
# Duas avaliações simultâneas: uma conclui, a outra recebe "busy" ou repete sem criar duplicata nem evento extra.
as_u1() { iso_psql -tA -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$U1\",\"role\":\"authenticated\"}',true); $1; select pg_sleep(0.3); commit;" 2>&1 || true; }
EV0=$(iso_psql -tAc "select count(*) from public.project_alert_events")
as_u1 "select public.project_alert_refresh('America/Sao_Paulo')" > /tmp/c5-r1.txt & p1=$!
as_u1 "select public.project_alert_refresh('America/Sao_Paulo')" > /tmp/c5-r2.txt & p2=$!
wait $p1 $p2 || true
EV1=$(iso_psql -tAc "select count(*) from public.project_alert_events")
DUP=$(iso_psql -tAc "select count(*) from (select dedupe_key from public.project_alerts group by 1 having count(*) > 1) x")
[ "$EV0" = "$EV1" ] && [ "$DUP" = "0" ] && echo "ok: duas avaliações simultâneas → nenhum alerta ou evento duplicado" || { echo "FALHOU: eventos $EV0→$EV1 duplicados=$DUP"; cat /tmp/c5-r1.txt /tmp/c5-r2.txt; exit 1; }
# Latência medida (banco isolado, fixture > 5.000 apontamentos e tarefas): resumo e lista por visão/perfil.
lat() { # $1 usuário, $2 SQL
  printf '%s\n' "begin;" "set local role authenticated;" \
    "select set_config('request.jwt.claims','{\"sub\":\"$1\",\"role\":\"authenticated\"}',true) \\g /dev/null" \
    "\\timing on" "$2" "\\timing off" "rollback;" > /tmp/c5-lat.sql
  iso_psql -tA -f /tmp/c5-lat.sql 2>&1 | grep -E "^Time" | tail -1
}
U2=10000000-0000-4000-8000-000000000002; U3=10000000-0000-4000-8000-000000000003
echo "latência resumo team (admin): $(lat $U1 "select length(public.project_dash_summary('team', '$F')::text);")"
echo "latência resumo team (líder): $(lat $U3 "select length(public.project_dash_summary('team', '$F')::text);")"
echo "latência resumo me (profissional): $(lat $U2 "select length(public.project_dash_summary('me', '$F')::text);")"
echo "latência resumo quality (admin): $(lat $U1 "select length(public.project_dash_summary('quality', '$F')::text);")"
echo "latência lista apontamentos team (líder, 50 linhas): $(lat $U3 "select length(public.project_dash_drill('team', 'entries', 'total', '$F', 50, 0)::text);")"
echo "latência avaliação de alertas (admin): $(lat $U1 "select public.project_alert_refresh('America/Sao_Paulo');")"
echo "duração total do roteiro: $(( (END-START)/1000000 )) ms"
echo "FIM: todas as asserções passaram"
