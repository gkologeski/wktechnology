#!/usr/bin/env bash
# Stack isolada (GoTrue + PostgREST reais) para a fase 6: escrita de atribuições.
# Exit: 0 tudo passou | 1 falha | 2 bloqueado.
set -uo pipefail
cd "$(dirname "$0")/../../.."
: "${RBAC_MIGRATION:?defina RBAC_MIGRATION com o caminho do .sql}"
RBAC_MIGRATION="$(realpath "$RBAC_MIGRATION")"
bash scripts/isolated-db/stack/start.sh || exit 2
. scripts/isolated-db/stack/env.sh
iso_guard || exit 2
iso_psql -f scripts/isolated-db/seed.sql >/dev/null || { echo "seed falhou"; exit 1; }
STACK_ANON_JWT=$(bun -e '
const c=require("node:crypto");const b=(o)=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"anon",iss:"techerp-isolated",exp:Math.floor(Date.now()/1e3)+3600});
console.log(h+"."+p+"."+c.createHmac("sha256",process.env.STACK_JWT_SECRET).update(h+"."+p).digest("base64url"))')
STACK_ANON_JWT="$STACK_ANON_JWT" RBAC_MIGRATION="$RBAC_MIGRATION" bun scripts/isolated-db/stack/rbac-wk-phase6.ts
rc=$?
[ "${ISO_KEEP:-0}" = 1 ] || bash scripts/isolated-db/stack/stop.sh
exit $rc
