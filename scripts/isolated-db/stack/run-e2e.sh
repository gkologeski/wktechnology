#!/usr/bin/env bash
# Stack isolada com GoTrue + PostgREST reais: sobe, seed sintético, E2E pelo SDK, para.
# Exit: 0 tudo | 1 falha | 2 bloqueado | 3 incompleto (Realtime ausente ⇒ sempre ≥3 hoje).
set -uo pipefail
cd "$(dirname "$0")/../../.."
bash scripts/isolated-db/stack/start.sh || exit 2
. scripts/isolated-db/stack/env.sh
iso_guard || exit 2
iso_psql -f scripts/isolated-db/seed.sql >/dev/null || { echo "seed falhou"; exit 1; }
# Chave anon da stack: JWT HS256 com o segredo efêmero desta execução (mesmo formato da plataforma).
STACK_ANON_JWT=$(bun -e '
const c=require("node:crypto");const b=(o)=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:"anon",iss:"techerp-isolated",exp:Math.floor(Date.now()/1e3)+3600});
console.log(h+"."+p+"."+c.createHmac("sha256",process.env.STACK_JWT_SECRET).update(h+"."+p).digest("base64url"))')
STACK_ANON_JWT="$STACK_ANON_JWT" bun scripts/isolated-db/stack/sdk-e2e.ts; rc=$?
[ "${ISO_KEEP:-0}" = 1 ] || bash scripts/isolated-db/stack/stop.sh
exit $rc
