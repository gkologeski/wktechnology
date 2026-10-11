#!/usr/bin/env bash
# Import a prepared schema-only snapshot into the dedicated, EMPTY local stack.
set -euo pipefail
umask 077
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
root="$repo/.techerp-isolated.local"
export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
unset DOCKER_HOST DOCKER_CONTEXT SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD DATABASE_URL SUPABASE_DB_URL
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE
export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
[ ! -L "$root" ] && [ "$(cat "$root/.isolation-marker" 2>/dev/null)" = techerp-empty-local-v1 ] || { echo 'Marcador local inválido.'; exit 2; }
[ ! -e "$root/supabase/.temp/project-ref" ] || { echo 'Vínculo remoto detectado; carga recusada.'; exit 2; }
cd "$root"
[ -f schema-load.sql ] && [ -f schema-load.sha256 ] || { echo 'Pacote de estrutura ainda não preparado.'; exit 2; }
shasum -a 256 -c schema-load.sha256 > checksum.log 2>&1 || { echo 'Pacote alterado ou incompleto. Carga recusada.'; exit 2; }
container=supabase_db_techerp-isolated.local
node -e 'const fs=require("fs"); const s=fs.readFileSync("supabase/config.toml","utf8"); if(!/^project_id = "techerp-isolated.local"$/m.test(s)) process.exit(1)' || { echo 'Projeto local diferente do esperado.'; exit 2; }
[ "$(docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null)" = true ] || { echo 'Abra o Docker Desktop e inicie o ambiente local.'; exit 2; }
echo 'Carregando somente a estrutura do TechERP. O banco precisa estar vazio.'
if ! docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < schema-load.sql > import.private.log 2>&1; then
  echo 'Carga não concluída. A transação foi revertida; o diagnóstico está no arquivo local import.private.log.'
  exit 1
fi
docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -tA > import-summary.json <<'SQL'
SELECT json_build_object(
  'stage', 'schema_loaded_without_customer_data',
  'tables', (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename <> '__isolated_marker'),
  'policies', (SELECT count(*) FROM pg_policies WHERE schemaname='public'),
  'auth_users', (SELECT count(*) FROM auth.users),
  'realtime_tables', (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public'),
  'outbound_http', 'inert_local_stub',
  'e2e_tests', 'not_executed');
SQL
echo 'Estrutura carregada. Resumo salvo em import-summary.json. Testes funcionais ainda não executados.'
