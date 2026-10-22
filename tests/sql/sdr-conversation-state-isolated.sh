#!/usr/bin/env bash
# Prova isolada do estado da conversa do SDR (0184), inclusive concorrência real
# entre duas sessões no mesmo turno. Exige o harness em scripts/isolated-db já
# carregado com a estrutura extraída (somente leitura do catálogo real).
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
iso_guard
OUT=$(mktemp)
iso_psql -f tests/sql/sdr-conversation-state-isolated.sql > "$OUT" 2>&1 || { cat "$OUT"; echo "FALHOU: primeira etapa"; exit 1; }
grep -E "ok:|FALHOU" "$OUT" || true
grep -q "concurrency-point" "$OUT" || { echo "FALHOU antes do ponto de concorrência"; exit 1; }
# Duas sessões com a MESMA versão esperada: a trava do trabalho serializa; só uma vence.
call() {
  iso_psql -tA -c "begin; select public.sdr_commit_turn('7f000000-0000-4000-8000-000000000001','7a000000-0000-4000-8000-000000000001','[]',null,'{\"conversation_state\":{\"race\":\"$1\"},\"expected_state_version\":3}',null); select pg_sleep(1); commit;" | head -1
}
call a > /tmp/sdr-race-a & pa=$!
call b > /tmp/sdr-race-b & pb=$!
wait $pa; wait $pb
res="$(cat /tmp/sdr-race-a /tmp/sdr-race-b | sort | tr '\n' ' ')"
v=$(iso_psql -tAc "select conversation_state_version from public.sdr_enrollments where id='7e000000-0000-4000-8000-000000000001'")
if [ "$res" != "ok state_changed " ] || [ "$v" != "4" ]; then echo "FALHOU: corrida ($res, versão $v)"; exit 1; fi
echo "ok: corrida com a mesma versão — exatamente um ok e um state_changed (versão $v)"
iso_psql -c "delete from public.sdr_turn_jobs where id in ('7f000000-0000-4000-8000-000000000001','7f000000-0000-4000-8000-000000000002'); delete from public.sdr_enrollments where id='7e000000-0000-4000-8000-000000000001'; delete from public.sdr_playbooks where id='7b000000-0000-4000-8000-000000000001'; delete from public.whatsapp_conversations where id='7c000000-0000-4000-8000-000000000001';" >/dev/null
echo "FIM: todas as asserções passaram"
