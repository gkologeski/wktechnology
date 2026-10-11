#!/usr/bin/env bash
# Applies only the new local migration, then validates through real local sessions.
set -euo pipefail
umask 077
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
root="$repo/.techerp-isolated.local"
export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
unset DOCKER_CONTEXT SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL SUPABASE_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE
export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
[ ! -L "$root" ] && [ "$(cat "$root/.isolation-marker" 2>/dev/null)" = techerp-empty-local-v1 ] || exit 2
[ ! -e "$root/supabase/.temp/project-ref" ] || exit 2
node -e 'const fs=require("fs"); if(!/^project_id = "techerp-isolated.local"$/m.test(fs.readFileSync(process.argv[1],"utf8"))) process.exit(1)' "$root/supabase/config.toml"
container=supabase_db_techerp-isolated.local
{
cat <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id=1 AND label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Missing isolation marker'; END IF;
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('pg_net','pg_cron','http')) THEN RAISE EXCEPTION 'Outbound extensions must remain disabled'; END IF;
 IF EXISTS (SELECT 1 FROM auth.users WHERE email IS NULL OR email NOT LIKE '%@techerp-test.invalid') THEN RAISE EXCEPTION 'Unexpected users'; END IF;
END $$;
SQL
cat "$repo/drizzle/migrations/0103_restricted_channels_history.sql"
cat "$repo/drizzle/migrations/0104_workspace_config_sources.sql"
cat "$repo/drizzle/migrations/0105_workspace_integration_sources.sql"
cat "$repo/drizzle/migrations/0106_workspace_sales_sources.sql"
cat "$repo/drizzle/migrations/0107_workspace_email_sources.sql"
cat "$repo/drizzle/migrations/0108_workspace_background_sources.sql"
cat "$repo/drizzle/migrations/0109_workspace_crm_sources.sql"
cat "$repo/drizzle/migrations/0110_workspace_scoring_channels.sql"
cat "$repo/drizzle/migrations/0111_workspace_activity_enrichment_sources.sql"
cat "$repo/drizzle/migrations/0112_workspace_default_active_membership.sql"
} | docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction > "$root/cycle11-migration.private.log" 2>&1
printf 'Correção de acesso aplicada somente no ambiente isolado. Iniciando os testes.\n'
bash "$repo/scripts/isolated-db/mac-test.sh"
