#!/usr/bin/env bash
set -euo pipefail
umask 077
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
root="$repo/.techerp-isolated.local"
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
unset DOCKER_HOST DOCKER_CONTEXT SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL SUPABASE_DB_URL
unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE
export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
[ ! -L "$root" ] && [ "$(cat "$root/.isolation-marker" 2>/dev/null)" = techerp-empty-local-v1 ] || { echo 'Marcador local inválido.'; exit 2; }
[ ! -e "$root/supabase/.temp/project-ref" ] || { echo 'Vínculo remoto detectado.'; exit 2; }
cd "$root"
node -e 'if (+process.versions.node.split(".")[0]<24) process.exit(1); if(!/^project_id = "techerp-isolated.local"$/m.test(require("fs").readFileSync("supabase/config.toml","utf8"))) process.exit(1)'
node_modules/.bin/supabase status -o json > status.private.json 2> status-check.private.log
docker exec -i supabase_db_techerp-isolated.local psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 > app-guard.private.log 2>&1 <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id=1 AND label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Missing isolation marker'; END IF;
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('pg_net','pg_cron','http')) THEN RAISE EXCEPTION 'Outbound extensions must remain disabled'; END IF;
END $$;
SQL
node "$repo/scripts/isolated-db/mac-app.mjs"
