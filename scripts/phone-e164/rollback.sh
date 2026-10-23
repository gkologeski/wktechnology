#!/usr/bin/env bash
# Desfaz itens aplicados de uma execução (lotes, retomável). Só restaura
# quando o valor atual ainda é o proposto pela execução — edição feita depois
# por um usuário nunca é sobrescrita (o item fica marcado e é contado). Itens
# da fila-mãe resolvidos por esta execução voltam a ficar pendentes.
# Exige papel de ESCRITA no banco.
# Uso: RUN=<uuid> WS=<uuid> [TABLE=contacts COL=phone] scripts/phone-e164/rollback.sh
set -euo pipefail
: "${RUN:?RUN obrigatório}" "${WS:?WS obrigatório}"
BATCH="${BATCH:-2000}"
HERE="$(dirname "$0")"
list="contacts:phone contacts:mobile_phone leads:phone leads:mobile_phone companies:phone \
people:phone people:emergency_phone prospecting_results:phone prospecting_results:company_phone \
ats_candidates:phone ats_referrals:candidate_phone bookings:invitee_phone profiles:phone"
[[ -n "${TABLE:-}" ]] && list="${TABLE}:${COL:?COL obrigatório}"
for tc in $list; do
  IFS=: read -r t c <<<"$tc"
  while :; do
    out=$(psql -v ON_ERROR_STOP=1 -Atq -c "$(bun "$HERE/batch-sql.ts" rollback "$RUN" - "$WS" "$t" "$c" "$BATCH")")
    echo "${t}.${c}: lote|restaurados|reabertos = ${out}"
    [[ "${out%%|*}" == "0" || -z "$out" ]] && break
  done
done
