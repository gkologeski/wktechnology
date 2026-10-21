#!/usr/bin/env bash
# Benchmark reproduzível do ciclo 6 em PostgreSQL DESCARTÁVEL (nunca o projeto).
# Volume: N_ENTRIES apontamentos sintéticos (padrão 1.000.000), 400 pessoas, 40 projetos.
# Concorrência: CLIENTS sessões (padrão 100) por DURATION s (padrão 60) em cada cenário.
# fsync e synchronous_commit LIGADOS (gravação durável). Saída: $ISO_ROOT/bench/summary.json
# Metas (não SLA): gravação p95 ≤ 1 s, painel p95 ≤ 2 s. Exit 0 executou | 2 bloqueado.
set -uo pipefail
cd "$(dirname "$0")/../../.."
export ISO_ROOT="${ISO_ROOT:-/tmp/c6-bench}" ISO_PORT="${ISO_PORT:-54340}"
N="${N_ENTRIES:-1000000}"; C="${CLIENTS:-100}"; T="${DURATION:-60}"
. scripts/isolated-db/env.sh
mkdir -p "$ISO_ROOT"; cp /tmp/techerp-isolated/schema.sql "$ISO_ROOT/schema.sql" || { echo "BLOQUEADO: schema.sql ausente"; exit 2; }
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true; rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null || exit 2
iso_guard || exit 2
iso_psql -f scripts/isolated-db/seed.sql >/dev/null || exit 2
for MIG in drizzle/migrations/0179_techprojects_cycle6_api_offline_ops.sql drizzle/migrations/0180_techprojects_cycle6_dashboard_performance.sql drizzle/migrations/0181_techprojects_cycle6_time_entries_rls_cost.sql; do
  iso_psql -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1 || { echo "BLOQUEADO: migração $MIG"; exit 2; }
done
S=$(date +%s); iso_psql -v n_entries="$N" -f scripts/perf/cycle6-bench-fixture.sql > "$ISO_ROOT/fixture.log" 2>&1 || { tail -5 "$ISO_ROOT/fixture.log"; exit 2; }
LOAD_S=$(( $(date +%s) - S ))
iso_psql -c "insert into public.api_keys (id, owner_id, workspace_id, name, prefix, key_hash, scopes)
  select ('c7000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, ('b0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
         'aaaaaaaa-0000-4000-8000-00000000000a', '[ISO] bench', 'lvb_bnch', 'h-bench-' || i, array['read'] from generate_series(1, 400) i" >/dev/null
# Reinicia com gravação durável e conexões suficientes (frio = primeira execução após reinício).
runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$ISO_DATA" -m fast stop >/dev/null
runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$ISO_DATA" -l "$ISO_LOG" -w \
  -o "-p $ISO_PORT -k $ISO_SOCK -c listen_addresses='' -c fsync=on -c synchronous_commit=on -c max_connections=260 -c shared_buffers=2GB -c work_mem=16MB" start >/dev/null
iso_guard || exit 2
B="$ISO_ROOT/bench"; rm -rf "$B"; mkdir -p "$B"; chown -R "$ISO_OS_USER" "$B"
iso_psql -c "select 1" >/dev/null
cold() { local t0; t0=$(date +%s%N); iso_psql -f "$1" >/dev/null; echo $(( ($(date +%s%N)-t0)/1000000 )); }
COLD_TEAM=$(cold scripts/perf/cycle6/dash_team.sql); COLD_ME=$(cold scripts/perf/cycle6/dash_me.sql)
WARM_TEAM=$(cold scripts/perf/cycle6/dash_team.sql); WARM_ME=$(cold scripts/perf/cycle6/dash_me.sql)
PGB=(pgbench -n -h "$ISO_SOCK" -p "$ISO_PORT" -U postgres -c "$C" -j 8 -T "$T" -l --log-prefix)
run() { local name=$1; shift; ( cd "$B" && "${PGB[@]}" "$name" "$@" postgres > "$name.out" 2>&1 ); }
run write -f "$PWD/scripts/perf/cycle6/write.sql"
run dash_me -f "$PWD/scripts/perf/cycle6/dash_me.sql"
run api_list -f "$PWD/scripts/perf/cycle6/api_list.sql"
run mixed -f "$PWD/scripts/perf/cycle6/write.sql@3" -f "$PWD/scripts/perf/cycle6/dash_me.sql@6" -f "$PWD/scripts/perf/cycle6/dash_team.sql@1"
iso_psql -tAc "select count(*) from public.project_time_entries" > "$B/final_count.txt"
iso_psql -tAc "select count(*) from (select user_id, client_request_id from public.project_time_client_requests group by 1,2 having count(*) > 1) x" > "$B/dup_requests.txt"
# EXPLAIN da consulta mais usada pelo painel (apontamentos do mês de uma pessoa, como ela).
iso_psql -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"b0000000-0000-4000-8000-000000000007\",\"role\":\"authenticated\"}',true);
  explain (analyze, buffers, format text) select count(*), sum(duration_seconds) from public.project_time_entries
   where workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' and user_id='b0000000-0000-4000-8000-000000000007' and entry_date between '2026-01-01' and '2026-01-31'; rollback;" > "$B/explain_me_month.txt" 2>&1
python3 scripts/perf/cycle6/summarize.py "$B" "$N" "$C" "$T" "$LOAD_S" "$COLD_TEAM" "$COLD_ME" "$WARM_TEAM" "$WARM_ME" "$(nproc)" "$(free -g | awk '/Mem/{print $2}')"
[ "${ISO_KEEP:-0}" = 1 ] || bash scripts/isolated-db/stop.sh >/dev/null
exit 0
