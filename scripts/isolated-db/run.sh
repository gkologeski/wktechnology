#!/usr/bin/env bash
# Ciclo completo do harness isolado: extrair estrutura (só leitura) → subir banco descartável →
# comparar fidelidade → seed sintético → matriz de permissões → camada WAL do tempo real → parar.
# Exit: 0 tudo passou E nada ficou sem executar | 1 falha | 2 bloqueado | 3 incompleto (not_executed).
# Um "3" NUNCA conta como verde de publicação.
set -uo pipefail
cd "$(dirname "$0")/../.."
KEEP="${ISO_KEEP:-0}"
test -n "${PGHOST:-}" || { echo "BLOQUEADO: sem acesso de leitura ao catálogo do projeto (PGHOST)"; exit 2; }
bun scripts/isolated-db/extract-schema.ts || exit 2
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
bash scripts/isolated-db/start.sh || exit 2
rc=0
# Comparação precisa do acesso de leitura do projeto: roda antes de env.sh limpar as PG*.
bun scripts/isolated-db/compare-schema.ts || rc=1
. scripts/isolated-db/env.sh
iso_guard || exit 2
iso_psql -f scripts/isolated-db/seed.sql >/dev/null || { echo "seed falhou"; exit 1; }
bun scripts/isolated-db/permission-matrix.ts || rc=1
bun scripts/isolated-db/realtime-wal.ts || rc=1
ne=$(python3 -c "import json;print(json.load(open('$ISO_ROOT/artifacts/realtime.json'))['not_executed'])")
[ "$KEEP" = "1" ] || bash scripts/isolated-db/stop.sh >/dev/null
echo "artefatos: $ISO_ROOT/artifacts (JUnit + JSON) e $ISO_ROOT/fidelity.json"
[ $rc -ne 0 ] && exit 1
[ "$ne" != "0" ] && { echo "INCOMPLETO: $ne asserção(ões) de tempo real não executadas"; exit 3; }
exit 0
