#!/usr/bin/env bash
# PostgreSQL-only behavioral test. Creates its own cluster, with no TCP listener.
# It never reads production connection variables or reuses an existing database.
set -euo pipefail
cd "$(dirname "$0")/../.."
pg_bin="${PG_BIN:-}"
if [ -z "$pg_bin" ]; then
  pg_ctl_path="$(command -v pg_ctl || true)"
  [ -n "$pg_ctl_path" ] || { echo 'Set PG_BIN to a PostgreSQL 15+ bin directory.'; exit 2; }
  pg_bin="$(dirname "$pg_ctl_path")"
fi
for binary in initdb pg_ctl createdb psql; do
  [ -x "$pg_bin/$binary" ] || { echo "Missing executable: $pg_bin/$binary"; exit 2; }
done
export PGCONNECT_TIMEOUT=5
unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE PGOPTIONS
test_root="$(mktemp -d /tmp/techerp-head-rh-test.XXXXXX)"
mkdir "$test_root/socket"
started=0
cleanup() {
  if [ "$started" = 1 ]; then "$pg_bin/pg_ctl" -D "$test_root/data" -m fast -w stop >/dev/null; fi
  echo "Test logs: $test_root"
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$test_root/data" -A trust --no-locale -E UTF8 >"$test_root/init.log" 2>&1
"$pg_bin/pg_ctl" -D "$test_root/data" -l "$test_root/postgres.log" -o "-c listen_addresses='' -c unix_socket_directories='$test_root/socket' -p 55439" -w start >/dev/null
started=1
"$pg_bin/createdb" -h "$test_root/socket" -p 55439 wk_head_rh_permission_test
run_sql() {
  "$pg_bin/psql" -X -q -v ON_ERROR_STOP=1 -h "$test_root/socket" -p 55439 -d wk_head_rh_permission_test -f "$1" >"$test_root/$2.log" 2>&1 || { cat "$test_root/$2.log"; exit 1; }
}
run_sql tests/sql/fixtures/wk-head-rh-baseline.sql fixture
run_sql drizzle/migrations/0189_wk_head_rh_full_access.sql migration
run_sql tests/sql/wk-head-rh-access.sql tests
run_sql tests/sql/wk-people-responsible-before.sql save-before
run_sql drizzle/migrations/0190_wk_people_responsible_actor.sql responsible-migration
run_sql tests/sql/wk-people-responsible.sql save-after
run_sql tests/sql/fixtures/permission-critical-rpcs.sql rpc-fixture
run_sql tests/sql/permission-critical-before.sql rpc-before
run_sql drizzle/migrations/0191_permission_critical_rpc_boundaries.sql rpc-migration
run_sql tests/sql/permission-critical-rpcs.sql rpc-after
python3 - "$test_root/tests.log" "$test_root/save-after.log" "$test_root/rpc-after.log" <<'PY'
import re,sys
text=open(sys.argv[1]).read()
passed=re.findall(r'NOTICE:  PASS (\d+):',text)
assert passed==[str(x) for x in range(1,45)],passed
saves=re.findall(r'NOTICE:  SAVE PASS (\d+):',open(sys.argv[2]).read()); assert saves==[str(x) for x in range(1,16)],saves
rpcs=re.findall(r'NOTICE:  RPC PASS (\d+):',open(sys.argv[3]).read()); assert rpcs==[str(x) for x in range(1,43)],rpcs
print('44/44 RLS + 15/15 save/FK + 42/42 critical RPC checks passed. Browser/auth SDK acceptance was not run.')
PY
