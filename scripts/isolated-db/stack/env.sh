# Stack isolada com serviços AUTÊNTICOS (GoTrue + PostgREST) sobre banco descartável próprio.
# Cluster separado do harness SQL (porta/socket próprios). Nunca aponta para o projeto.
export ISO_ROOT="${ISO_STACK_ROOT:-/tmp/techerp-stack}"
export ISO_PORT="${ISO_STACK_PORT:-54330}"
. "$(dirname "${BASH_SOURCE[0]}")/../env.sh"
export STACK_SRC="${STACK_SRC:-/tmp/stack-src}"
export GOTRUE_VERSION="2.180.0"
export GOTRUE_BIN="${GOTRUE_BIN:-/nix/store/53gdkzxfm58b3ihbgkr6pzj3gmg2243p-auth-2.180.0/bin/auth}"
export POSTGREST_BIN="${POSTGREST_BIN:-/nix/store/grkpy61kplv8wrf9iiga06658av4mww9-postgrest-14.1-bin/bin/postgrest}"
export STACK_AUTH_PORT="${STACK_AUTH_PORT:-59999}"
export STACK_REST_PORT="${STACK_REST_PORT:-59998}"
# Segredo efêmero gerado por execução (só desta stack descartável).
if [ -f "$ISO_ROOT/jwt.secret" ]; then export STACK_JWT_SECRET="$(cat "$ISO_ROOT/jwt.secret")"; fi
