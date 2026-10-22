#!/usr/bin/env bash
# Desfaz itens aplicados de uma execução (lotes, retomável). Só restaura
# quando o valor atual ainda é o proposto pela execução — edição feita depois
# por um usuário nunca é sobrescrita (o item fica marcado e é contado).
# Uso: RUN=<uuid> WS=<uuid> [TABLE=contacts COL=phone] scripts/phone-e164/rollback.sh
set -euo pipefail
: "${RUN:?RUN obrigatório}" "${WS:?WS obrigatório}"
BATCH="${BATCH:-2000}"

rollback_col() {
  local table="$1" col="$2" ws_filter="$3" ext="$4"
  local ext_set=""
  [[ "$ext" == "1" ]] && ext_set=", phone_ext = case when x.phone_ext is not distinct from b.proposed_ext then null else x.phone_ext end"
  while :; do
    local n
    n=$(psql -v ON_ERROR_STOP=1 -Atq <<SQL
begin;
select set_config('app.phone_e164_backfill','wk-phone-e164-v1', true) \\g /dev/null
with batch as (
  select id, row_id, proposed_value, proposed_ext, original_value
    from public.phone_normalization_items
   where run_id = '${RUN}' and table_name = '${table}' and column_name = '${col}'
     and applied_at is not null and rolled_back_at is null
   order by id limit ${BATCH}
   for update skip locked),
upd as (
  update public.${table} x set ${col} = b.original_value${ext_set}
    from batch b
   where x.id = b.row_id ${ws_filter}
     and x.${col} is not distinct from b.proposed_value
  returning b.id),
mark as (
  update public.phone_normalization_items i
     set rolled_back_at = now(),
         reason = case when i.id in (select id from upd) then i.reason
                       else coalesce(i.reason,'') || ' | não restaurado: alterado depois' end
   where i.id in (select id from batch)
  returning 1)
select count(*) from mark;
commit;
SQL
)
    n=$(echo "$n" | tail -n1)
    echo "${table}.${col}: lote ${n}"
    [[ "$n" == "0" || -z "$n" ]] && break
  done
}

W="and x.workspace_id = '${WS}'"
if [[ -n "${TABLE:-}" ]]; then
  ext=0; [[ "${COL}" == "phone" && "${TABLE}" =~ ^(contacts|leads|companies)$ ]] && ext=1
  f="$W"; [[ "${TABLE}" == "profiles" ]] && f=""
  rollback_col "$TABLE" "$COL" "$f" "$ext"
  exit 0
fi
for tc in contacts:phone:1 contacts:mobile_phone:0 leads:phone:1 leads:mobile_phone:0 companies:phone:1 \
          people:phone:0 people:emergency_phone:0 prospecting_results:phone:0 prospecting_results:company_phone:0 \
          ats_candidates:phone:0 ats_referrals:candidate_phone:0 bookings:invitee_phone:0; do
  IFS=: read -r t c e <<<"$tc"; rollback_col "$t" "$c" "$W" "$e"
done
rollback_col profiles phone "" 0
