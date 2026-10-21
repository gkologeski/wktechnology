#!/usr/bin/env bash
# Fluxo integrado não admin do ciclo 6 (banco descartável, dados fictícios).
# Carrega as provas C2 e C4 (fixtures de funil, contrato, serviço, tarifa e modelo) e depois o fluxo.
# Uso: bash tests/sql/cycle6-e2e-isolated.sh drizzle/migrations/0179_*.sql
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null
for MIG in "$@"; do iso_psql -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1 || { echo "FALHOU ao aplicar $MIG"; exit 1; }; done
for PRE in tests/sql/project-billing-isolated.sql; do
  O=$(mktemp); iso_psql -f "$PRE" > "$O" 2>&1 || true
  if grep -qE "FALHOU|ERROR" "$O"; then echo "FALHOU na pré-condição $PRE"; grep -m3 -E "FALHOU|ERROR" "$O"; exit 1; fi
  echo "pré-condição $PRE: $(grep -c 'ok:' "$O") asserções ok"
done
OUT=$(mktemp)
iso_psql -f tests/sql/cycle6-e2e-isolated.sql > "$OUT" 2>&1 || true
grep -E "ok:|FALHOU|ERROR" "$OUT" | sed 's/^.*NOTICE:  //' || true
if grep -qE "FALHOU|ERROR" "$OUT"; then echo "FALHOU"; grep -B2 -A6 -m1 -E "FALHOU|ERROR" "$OUT" || true; exit 1; fi
grep -q "fim" "$OUT" || { echo "FALHOU: roteiro incompleto"; tail -5 "$OUT"; exit 1; }
echo "FIM: fluxo integrado passou"
