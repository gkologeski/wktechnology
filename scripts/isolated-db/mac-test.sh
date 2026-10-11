#!/usr/bin/env bash
# Real local Auth/PostgREST/Realtime tests. No production endpoint is accepted.
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
node -e 'if (+process.versions.node.split(".")[0] < 24) process.exit(1); const fs=require("fs"); if(!/^project_id = "techerp-isolated.local"$/m.test(fs.readFileSync("supabase/config.toml","utf8"))) process.exit(1)' || { echo 'Node 24+ ou configuração local indisponível.'; exit 2; }
container=supabase_db_techerp-isolated.local
[ "$(docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null)" = true ] || { echo 'Inicie o Docker e os serviços locais.'; exit 2; }
mkdir -p artifacts
stamp="$(date +%Y%m%d-%H%M%S)"
for name in sdk-e2e.json sdk-e2e.xml realtime-diagnostics.json; do
  if [ -f "artifacts/$name" ]; then mv "artifacts/$name" "artifacts/$stamp-$name"; fi
done
printf '{"stage":"starting","tests_complete":false}\n' > artifacts/mac-run.json
trap 'rc=$?; if [ "$rc" -ne 0 ] && [ "$rc" -ne 3 ] && [ ! -f artifacts/sdk-e2e.json ]; then printf "{\"stage\":\"blocked_or_failed\",\"exit_code\":%s,\"tests_complete\":false}\n" "$rc" > artifacts/mac-run.json; echo "Execução interrompida. Os diagnósticos ficaram na pasta local .techerp-isolated.local."; fi' EXIT
node_modules/.bin/supabase status -o json > status.private.json 2> status-check.private.log
node -e 'const s=JSON.parse(require("fs").readFileSync("status.private.json","utf8")); if(!["http://127.0.0.1:54321","http://localhost:54321"].includes(s.API_URL) || !s.ANON_KEY) process.exit(1)'
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 > test-guard.private.log 2>&1 <<'SQL'
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id=1 AND label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Missing isolation marker'; END IF;
 IF EXISTS (SELECT 1 FROM pg_extension WHERE extname IN ('pg_net','pg_cron','http')) THEN RAISE EXCEPTION 'Outbound extensions must remain disabled'; END IF;
 IF EXISTS (SELECT 1 FROM auth.users WHERE email IS NULL OR email NOT LIKE '%@techerp-test.invalid') THEN RAISE EXCEPTION 'Unexpected users in disposable stack'; END IF;
END $$;
SQL
if [ ! -d node_modules/@supabase/supabase-js ]; then
  echo 'Preparando a biblioteca de testes na pasta isolada...'
  npm install --save-dev --save-exact @supabase/supabase-js@2.105.4 > sdk-install.private.log 2>&1
fi
echo 'Criando sete usuários fictícios e registros de teste em duas empresas fictícias...'
docker exec "$container" mkdir -p /tmp/techerp-isolated
docker cp ref-permissions.csv "$container:/tmp/techerp-isolated/ref-permissions.csv" > copy.private.log 2>&1
docker cp ref-modules.csv "$container:/tmp/techerp-isolated/ref-modules.csv" >> copy.private.log 2>&1
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < "$repo/scripts/isolated-db/seed.sql" > seed.private.log 2>&1
node "$repo/scripts/isolated-db/mac-prepare-tests.mjs"
echo 'Testando login, permissões, isolamento entre empresas e eventos realtime. Aguarde até quatro minutos...'
set +e
ISO_ROOT="$root" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON mac-sdk-e2e.ts > sdk-e2e.private.log 2>&1
rc=$?
docker logs --since 6m supabase_realtime_techerp-isolated.local > realtime-server.private.log 2>&1
set -e
if [ -f artifacts/sdk-e2e.json ]; then
  node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("artifacts/sdk-e2e.json","utf8")); console.log(`${s.pass} testes passaram; ${s.fail} falharam; ${s.not_executed} não executados.`); fs.writeFileSync("artifacts/mac-run.json",JSON.stringify({stage:"tests_finished",pass:s.pass,fail:s.fail,not_executed:s.not_executed,tests_complete:s.fail===0&&s.not_executed===0},null,2));'
else
  echo 'A suíte não chegou ao relatório final; consulte sdk-e2e.private.log.'
fi
exit "$rc"
