#!/usr/bin/env bash
# Recreate the backend from the checksum-protected snapshot in a SECOND local stack.
set -euo pipefail
umask 077
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
base="$repo/.techerp-isolated.local"
run_id="$(date +%Y%m%d%H%M%S)"
project="techerp-repro-$run_id"
repro="$base/reproduction-$run_id"
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
unset DOCKER_CONTEXT SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL SUPABASE_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE
export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
[ ! -L "$base" ] && [ "$(cat "$base/.isolation-marker" 2>/dev/null)" = techerp-empty-local-v1 ] || exit 2
[ ! -e "$repro" ] || { echo 'A pasta de reprodução já existe. Nenhum dado foi sobrescrito.'; exit 2; }
cd "$base"
shasum -a 256 -c schema-load.sha256 >/dev/null
mkdir -p "$repro/supabase" "$repro/artifacts"
node --input-type=module - "$base" "$repro" "$project" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const [base,repro,project]=process.argv.slice(2);
let config=readFileSync(base+'/supabase/config.toml','utf8');
if(!/^project_id = "techerp-isolated.local"$/m.test(config)) throw new Error('Unexpected project');
config=config.replace('project_id = "techerp-isolated.local"',`project_id = "${project}"`);
config=config.replace(/^(\s*(?:\w*_)?port\s*=\s*)(\d+)/gm,(_,p,n)=>p+(+n+100));
writeFileSync(repro+'/supabase/config.toml',config);
writeFileSync(repro+'/.isolation-marker',project);
JS
cli="$base/node_modules/.bin/supabase"
cd "$repro"
trap '"$cli" stop > stop.private.log 2>&1 || true' EXIT
"$cli" start > start.private.log 2>&1
"$cli" status -o json > status.private.json 2> status.private.log
node -e 'const s=JSON.parse(require("fs").readFileSync("status.private.json","utf8")); if(s.API_URL!=="http://127.0.0.1:54421") process.exit(1)'
container="supabase_db_$project"
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$base/schema-load.sql" > import.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0103_restricted_channels_history.sql" > migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0104_workspace_config_sources.sql" > config-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0105_workspace_integration_sources.sql" > integration-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0106_workspace_sales_sources.sql" > sales-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0107_workspace_email_sources.sql" > email-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0108_workspace_background_sources.sql" > background-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0109_workspace_crm_sources.sql" > crm-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0110_workspace_scoring_channels.sql" > scoring-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0111_workspace_activity_enrichment_sources.sql" > activities-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0112_workspace_default_active_membership.sql" > membership-migration.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0113_remaining_realtime_publication.sql" > realtime-migration.private.log 2>&1
docker exec "$container" mkdir -p /tmp/techerp-isolated
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/drizzle/migrations/0114_workspace_delete_signals.sql" > delete-signal-migration.private.log 2>&1
docker cp "$base/ref-permissions.csv" "$container:/tmp/techerp-isolated/ref-permissions.csv" > copy.private.log 2>&1
docker cp "$base/ref-modules.csv" "$container:/tmp/techerp-isolated/ref-modules.csv" >> copy.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/scripts/isolated-db/seed.sql" > seed.private.log 2>&1
node "$repo/scripts/isolated-db/mac-prepare-tests.mjs" > prepare.log
node --input-type=module - "$base" "$repro" "$project" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const [base,repro,project]=process.argv.slice(2);
let source=readFileSync(base+'/mac-sdk-e2e.ts','utf8');
source=source.replaceAll('supabase_db_techerp-isolated.local',`supabase_db_${project}`)
 .replaceAll('54321','54421').replace("root.endsWith('/.techerp-isolated.local')","root===process.env.ISO_ROOT")
 .replace("root + '/app/node_modules/ws/wrapper.mjs'","root + '/../app/node_modules/ws/wrapper.mjs'");
writeFileSync(repro+'/mac-sdk-e2e.ts',source);
JS
set +e
ISO_ROOT="$repro" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON mac-sdk-e2e.ts > sdk.private.log 2>&1
rc=$?
set -e
node -e 'const fs=require("fs"),r=JSON.parse(fs.readFileSync("artifacts/sdk-e2e.json","utf8")); console.log(`Reprodução limpa: ${r.pass} passaram; ${r.fail} falharam; ${r.not_executed} casos de interface não executados.`); fs.writeFileSync("../artifacts/reproduction-latest.json",JSON.stringify({backendRecreated:true,pass:r.pass,fail:r.fail,not_executed:r.not_executed,services:"native local Supabase on independent ports",snapshotIntegrity:"sha256 verified",published:false},null,2))'
exit "$rc"
