#!/usr/bin/env bash
# Aplica, em lotes curtos e retomáveis, os itens SEGUROS de uma execução de
# telefones (`phone_normalization_items`): safe_explicit, safe_record_country,
# placeholder e blank_short (até 4 dígitos → vazio). O SQL de cada lote vem de
# `batch-sql.ts` (compara o original, filtra workspace, idempotente, suprime
# automações pelo token estreito e resolve a fila da execução-mãe PARENT).
# Exige papel de ESCRITA no banco (o psql de leitura do sandbox não serve).
#
# Uso: RUN=<uuid> WS=<uuid> [PARENT=<uuid>] scripts/phone-e164/apply.sh
set -euo pipefail
: "${RUN:?RUN obrigatório}" "${WS:?WS obrigatório}"
BATCH="${BATCH:-2000}"
HERE="$(dirname "$0")"
for tc in contacts:phone contacts:mobile_phone leads:phone leads:mobile_phone companies:phone \
          people:phone people:emergency_phone prospecting_results:phone prospecting_results:company_phone \
          ats_candidates:phone ats_referrals:candidate_phone bookings:invitee_phone profiles:phone; do
  IFS=: read -r t c <<<"$tc"
  while :; do
    out=$(psql -v ON_ERROR_STOP=1 -Atq -c "$(bun "$HERE/batch-sql.ts" apply "$RUN" "${PARENT:--}" "$WS" "$t" "$c" "$BATCH")")
    echo "${t}.${c}: lote|gravados|marcados|resolvidos = ${out}"
    [[ "${out%%|*}" == "0" || -z "$out" ]] && break
  done
done
