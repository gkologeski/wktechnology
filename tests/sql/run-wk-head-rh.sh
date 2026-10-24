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
run_sql tests/sql/fixtures/permission-settings.sql settings-fixture
run_sql drizzle/migrations/0192_workspace_settings_authorization.sql settings-migration
run_sql tests/sql/permission-settings.sql settings-tests
run_sql tests/sql/fixtures/permission-hr-actions.sql hr-fixture
run_sql tests/sql/fixtures/permission-hr-catalog.sql hr-catalog
run_sql tests/sql/permission-hr-before.sql hr-before
run_sql drizzle/migrations/0193_hr_action_scope_alignment.sql hr-migration
run_sql drizzle/migrations/0194_hr_ui_capabilities.sql hr-ui-migration
run_sql tests/sql/permission-hr-ui.sql hr-ui-tests
run_sql tests/sql/permission-hr-actions.sql hr-tests
run_sql tests/sql/fixtures/permission-people-children.sql children-fixture
run_sql drizzle/migrations/0195_people_resource_actions.sql children-migration
run_sql tests/sql/permission-child-responsible-before.sql children-responsible-before
run_sql drizzle/migrations/0196_hr_child_responsible_actor.sql children-responsible-migration
run_sql drizzle/migrations/0197_hr_capabilities_batch_context.sql children-caps-migration
run_sql tests/sql/permission-people-children.sql children-tests
run_sql tests/sql/permission-capabilities-equivalence.sql children-caps-tests
run_sql tests/sql/fixtures/permission-private-fields.sql private-fixture
# Match API multi-statement execution: the migration must terminate before the
# journal/verification SELECT which follows it (psql EOF alone can hide this bug).
cat drizzle/migrations/0198_hr_private_fields.sql > "$test_root/private-migration-batch.sql"
printf '\nSELECT 1 AS private_migration_statement_complete;\n' >> "$test_root/private-migration-batch.sql"
run_sql "$test_root/private-migration-batch.sql" private-migration
run_sql drizzle/migrations/0199_hr_private_fields_activation.sql private-activation
run_sql tests/sql/permission-private-fields.sql private-tests
run_sql tests/sql/fixtures/permission-jobs.sql jobs-fixture
run_sql tests/sql/permission-jobs-before.sql jobs-before
run_sql drizzle/migrations/0200_jobs_action_scope.sql jobs-migration
run_sql tests/sql/permission-jobs.sql jobs-tests
run_sql tests/sql/permission-capabilities-equivalence.sql jobs-existing-caps-tests
run_sql tests/sql/fixtures/permission-pipelines.sql pipelines-fixture
run_sql drizzle/migrations/0201_pipeline_action_scope.sql pipelines-migration
run_sql tests/sql/permission-pipelines.sql pipelines-tests
run_sql tests/sql/permission-jobs.sql pipelines-existing-jobs-tests
run_sql tests/sql/permission-capabilities-equivalence.sql pipelines-existing-caps-tests
run_sql tests/sql/fixtures/permission-applications.sql applications-fixture
run_sql drizzle/migrations/0202_application_action_scope.sql applications-migration
run_sql tests/sql/permission-applications.sql applications-tests
run_sql tests/sql/permission-capabilities-equivalence.sql applications-existing-caps-tests
run_sql tests/sql/fixtures/permission-interviews.sql interviews-fixture
run_sql tests/sql/permission-interviews-before.sql interviews-before
run_sql drizzle/migrations/0203_interview_response_action_scope.sql interviews-migration
run_sql tests/sql/permission-interviews.sql interviews-tests
run_sql tests/sql/permission-capabilities-equivalence.sql interviews-existing-caps-tests
run_sql tests/sql/fixtures/permission-ats-configuration.sql configuration-fixture
run_sql drizzle/migrations/0204_ats_configuration_actions.sql configuration-migration
run_sql drizzle/migrations/0205_ats_scheduling_privacy.sql scheduling-migration
run_sql tests/sql/permission-ats-configuration.sql configuration-tests
run_sql tests/sql/permission-capabilities-equivalence.sql configuration-existing-caps-tests
run_sql tests/sql/fixtures/permission-offers.sql offers-fixture
run_sql tests/sql/fixtures/permission-offer-completion.sql offers-completion-fixture
run_sql drizzle/migrations/0206_ats_offer_approval_boundaries.sql offers-preparation
run_sql drizzle/migrations/0207_ats_offer_hiring_activation.sql offers-activation
run_sql tests/sql/permission-offers.sql offers-tests
run_sql tests/sql/permission-capabilities-equivalence.sql offers-existing-caps-tests
run_sql tests/sql/fixtures/permission-compliance.sql compliance-fixture
run_sql drizzle/migrations/0208_ats_compliance_actions.sql compliance-preparation
run_sql drizzle/migrations/0209_ats_compliance_activation.sql compliance-activation
run_sql tests/sql/permission-compliance.sql compliance-tests
python3 - "$test_root/compliance-tests.log" <<'PYC'
import re,sys
p=re.findall(r'NOTICE:  COMPLIANCE PASS (\d+):',open(sys.argv[1]).read());assert p==[str(x) for x in range(1,10)],p
print('9 compliance behavior groups passed; all synthetic changes rolled back.')
PYC
python3 - "$test_root/offers-tests.log" "$test_root/configuration-tests.log" "$test_root/interviews-tests.log" "$test_root/applications-tests.log" "$test_root/pipelines-tests.log" "$test_root/jobs-tests.log" "$test_root/private-tests.log" "$test_root/children-tests.log" "$test_root/hr-ui-tests.log" "$test_root/tests.log" "$test_root/save-after.log" "$test_root/rpc-after.log" "$test_root/settings-tests.log" "$test_root/hr-tests.log" <<'PY'
import re,sys
offers=re.findall(r'NOTICE:  OFFER PASS (\d+):',open(sys.argv.pop(1)).read());assert offers==[str(x) for x in range(1,17)],offers
configuration=re.findall(r'NOTICE:  CONFIG PASS (\d+):',open(sys.argv.pop(1)).read());assert configuration==[str(x) for x in range(1,9)],configuration
interviews=re.findall(r'NOTICE:  INTERVIEW PASS (\d+):',open(sys.argv.pop(1)).read()); assert interviews==[str(x) for x in range(1,14)],interviews
applications=re.findall(r'NOTICE:  APPLICATION PASS (\d+):',open(sys.argv.pop(1)).read()); assert applications==[str(x) for x in range(1,14)],applications
pipelines=re.findall(r'NOTICE:  PIPELINE PASS (\d+):',open(sys.argv.pop(1)).read()); assert pipelines==[str(x) for x in range(1,11)],pipelines
jobs=re.findall(r'NOTICE:  JOB PASS (\d+):',open(sys.argv.pop(1)).read()); assert jobs==[str(x) for x in range(1,12)],jobs
private=re.findall(r'NOTICE:  PRIVATE PASS:',open(sys.argv.pop(1)).read()); assert len(private)==10,len(private)
children=re.findall(r'NOTICE:  CHILD PASS (\d+):',open(sys.argv.pop(1)).read()); assert children==[str(x) for x in range(1,113)],children
ui=re.findall(r'NOTICE:  UI PASS (\d+):',open(sys.argv.pop(1)).read()); assert ui==[str(x) for x in range(1,16)],ui
text=open(sys.argv[1]).read()
passed=re.findall(r'NOTICE:  PASS (\d+):',text)
assert passed==[str(x) for x in range(1,45)],passed
saves=re.findall(r'NOTICE:  SAVE PASS (\d+):',open(sys.argv[2]).read()); assert saves==[str(x) for x in range(1,16)],saves
rpcs=re.findall(r'NOTICE:  RPC PASS (\d+):',open(sys.argv[3]).read()); assert rpcs==[str(x) for x in range(1,43)],rpcs
settings=re.findall(r'NOTICE:  SETTINGS PASS (\d+):',open(sys.argv[4]).read()); assert settings==[str(x) for x in range(1,62)],settings
hr=re.findall(r'NOTICE:  HR PASS (\d+):',open(sys.argv[5]).read()); assert hr==[str(x) for x in range(1,113)],hr
print('16 offer/hiring action groups + 8 configuration action groups + 13 interview/evaluation groups + 13 candidature/timeline groups + 10 pipeline groups + 11 job permission groups + 10 private-field groups (including 12 differential cases) + 112/112 HR children + 15/15 UI capabilities + 112/112 HR + 61/61 settings + 44/44 RLS + 15/15 save/FK + 42/42 critical RPC checks passed. Browser/auth SDK acceptance was not run.')
PY
