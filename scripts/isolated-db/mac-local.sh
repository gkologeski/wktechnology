#!/usr/bin/env bash
# Stage 1 only: empty local Supabase services. Does not import TechERP schema/data.
# Run from a normal macOS Terminal. Never uses the repository's supabase/config.toml.
set -euo pipefail
umask 077
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
root="$repo/.techerp-isolated.local"
action="${1:-start}"
case "$action" in start|status|stop|check) ;; *) echo 'Use: bash scripts/isolated-db/mac-local.sh [start|status|stop|check]'; exit 2;; esac
export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
# Do not inherit remote database or Supabase credentials.
unset DOCKER_HOST DOCKER_CONTEXT SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD
unset DATABASE_URL SUPABASE_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE
export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
command -v docker >/dev/null || { echo 'Docker CLI ausente.'; exit 2; }
docker info >/dev/null 2>&1 || { echo 'Sem acesso ao Docker. Abra o Docker Desktop e execute este script no Terminal do Mac.'; exit 2; }
command -v node >/dev/null && command -v npm >/dev/null || { echo 'Node.js 20+ e npm são necessários.'; exit 2; }
node -e 'if (+process.versions.node.split(".")[0] < 20) process.exit(1)' || { echo 'Atualize para Node.js 20 ou superior.'; exit 2; }
if [ "$action" = check ]; then echo 'Docker e Node disponíveis. Nenhum serviço criado.'; exit 0; fi

if [ ! -d "$root" ]; then
  [ "$action" = start ] || { echo 'Ambiente ainda não criado.'; exit 2; }
  mkdir "$root"
  printf '%s\n' 'techerp-empty-local-v1' > "$root/.isolation-marker"
fi
[ ! -L "$root" ] && [ "$(cat "$root/.isolation-marker" 2>/dev/null)" = techerp-empty-local-v1 ] || { echo 'Diretório sem marcador de isolamento; operação recusada.'; exit 2; }
cd "$root"
[ ! -e supabase/.temp/project-ref ] || { echo 'Vínculo remoto detectado; operação recusada.'; exit 2; }

if [ ! -x node_modules/.bin/supabase ]; then
  [ "$action" = start ] || { echo 'CLI local ainda não instalada.'; exit 2; }
  printf '%s\n' '{"name":"techerp-isolated-services","private":true}' > package.json
  echo 'Instalando a CLI oficial apenas na pasta isolada (versão fixada no lockfile)...'
  npm install --save-dev --save-exact supabase@2.120.0 > install.log 2>&1 || { echo "Falha de instalação; log local: $root/install.log"; exit 1; }
fi
cli="$root/node_modules/.bin/supabase"
if [ ! -f supabase/config.toml ]; then
  [ "$action" = start ] || { echo 'Configuração local ausente.'; exit 2; }
  "$cli" init > init.log 2>&1 || { echo "Falha no init; log local: $root/init.log"; exit 1; }
fi
# This launcher must never run the project's non-reproducible migration history.
if [ -d supabase/migrations ] && [ -n "$(find supabase/migrations -type f -print -quit)" ]; then
  echo 'Há migrations nesta base. Este iniciador aceita apenas a etapa vazia; operação recusada.'
  exit 2
fi
case "$action" in
  start)
    echo 'Subindo banco, autenticação e Realtime locais. O primeiro download pode levar vários minutos.'
    "$cli" start > start.log 2>&1 || { echo "Falha ao iniciar. Consulte $root/start.log (pode conter chaves locais; não compartilhe o arquivo inteiro)."; exit 1; }
    "$cli" status > status.private.log 2>&1
    echo 'Serviços locais iniciados. Este comando não importa a estrutura nem executa testes do TechERP.'
    echo 'Studio local padrão: http://127.0.0.1:54323'
    ;;
  status)
    "$cli" status > status.private.log 2>&1 || { echo 'Serviços não estão prontos. Consulte o status.private.log local.'; exit 1; }
    echo 'CLI confirmou os serviços locais. Credenciais mantidas no status.private.log, sem exibição.'
    ;;
  stop)
    "$cli" stop > stop.log 2>&1
    echo 'Serviços deste projeto local parados; volumes preservados.'
    ;;
esac
