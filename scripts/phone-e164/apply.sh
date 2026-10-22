#!/usr/bin/env bash
# Aplica, em lotes curtos e retomáveis, os itens SEGUROS de uma execução de
# normalização E.164 (`phone_normalization_items`). Idempotente: só grava
# quando o valor atual ainda é o original da simulação (senão marca
# `changed_since_dry_run`). Automações/histórico ficam suprimidos pelo
# mecanismo estreito `crm_is_derivation_backfill` (token de sessão, só WK).
#
# Uso: RUN=<uuid> WS=<uuid> scripts/phone-e164/apply.sh
set -euo pipefail
: "${RUN:?RUN obrigatório}" "${WS:?WS obrigatório}"
BATCH="${BATCH:-2000}"

apply_col() {
  local table="$1" col="$2" ws_filter="$3" ext="$4"
  local ext_set=""
  [[ "$ext" == "1" ]] && ext_set=", phone_ext = coalesce(x.phone_ext, b.proposed_ext)"
  while :; do
    local n
    n=$(psql -v ON_ERROR_STOP=1 -Atq <<SQL
begin;
select set_config('app.phone_e164_backfill','wk-phone-e164-v1', true) \\g /dev/null
with batch as (
  select id, row_id, proposed_value, proposed_ext, original_value
    from public.phone_normalization_items
   where run_id = '${RUN}' and table_name = '${table}' and column_name = '${col}'
     and applied_at is null
     and classification in ('safe_explicit','safe_record_country','placeholder')
   order by id limit ${BATCH}
   for update skip locked),
upd as (
  update public.${table} x set ${col} = b.proposed_value${ext_set}
    from batch b
   where x.id = b.row_id ${ws_filter}
     and x.${col} is not distinct from b.original_value
  returning b.id),
mark as (
  update public.phone_normalization_items i
     set applied_at = case when i.id in (select id from upd) then now() end,
         classification = case when i.id in (select id from upd) then i.classification
                               else 'changed_since_dry_run' end
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
apply_col contacts phone "$W" 1
apply_col contacts mobile_phone "$W" 0
apply_col leads phone "$W" 1
apply_col leads mobile_phone "$W" 0
apply_col companies phone "$W" 1
apply_col people phone "$W" 0
apply_col people emergency_phone "$W" 0
apply_col prospecting_results phone "$W" 0
apply_col prospecting_results company_phone "$W" 0
apply_col ats_candidates phone "$W" 0
apply_col ats_referrals candidate_phone "$W" 0
apply_col bookings invitee_phone "$W" 0
# Perfis: só os exportados (usuário exclusivamente deste workspace).
apply_col profiles phone "" 0
