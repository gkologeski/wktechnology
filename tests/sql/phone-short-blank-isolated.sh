#!/usr/bin/env bash
# Prova isolada do lote de telefones (limpeza até 4 dígitos + correções v2):
# compara original, filtra workspace, idempotência, não deriva WhatsApp,
# suprime automações/histórico, resolve a fila-mãe e rollback reabre.
# Uso: bash tests/sql/phone-short-blank-isolated.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null

WK=184b9435-0a9b-4334-9e89-8854dc883f5d
B=aaaaaaaa-0000-4000-8000-00000000000b
U=10000000-0000-4000-8000-000000000001
PARENT=22222222-2222-4222-8222-222222222222
RUN=33333333-3333-4333-8333-333333333333
C1=c0000000-0000-4000-8000-000000000001
C2=c0000000-0000-4000-8000-000000000002
C3=c0000000-0000-4000-8000-000000000003
C4=c0000000-0000-4000-8000-000000000004
CB=c0000000-0000-4000-8000-0000000000bb

iso_psql >/dev/null <<SQL
insert into public.workspaces (id, name, slug, created_by) values ('$WK','[ISO] WK','iso-wk','$U');
insert into public.contacts (id, workspace_id, owner_id, first_name, phone, mobile_phone, phone_ext) values
 ('$C1','$WK','$U','Fixo','+551133334444','1234',null),
 ('$C2','$WK','$U','CelPrincipal','+5511999998888','12',null),
 ('$C3','$WK','$U','Ramal','1234 ramal 55','+5511977776666','55'),
 ('$C4','$WK','$U','Mudou','+551133335555','7',null),
 ('$CB','$B','10000000-0000-4000-8000-000000000006','OutroWs','+551133336666','1',null);
-- C2 sem WhatsApp gravado: a correção não pode derivar um.
update public.contacts set whatsapp_e164 = null where id = '$C2';
insert into public.phone_normalization_runs (id, workspace_id, normalizer_version, mode, status, criteria) values
 ('$PARENT','$WK','e164-v1','apply','done','varredura'),
 ('$RUN','$WK','e164-v2','apply','running','até 4 dígitos');
update public.phone_normalization_runs set parent_run_id = '$PARENT' where id = '$RUN';
insert into public.phone_normalization_items (run_id, workspace_id, table_name, row_id, column_name, original_value, classification) values
 ('$PARENT','$WK','contacts','$C1','mobile_phone','1234','invalid'),
 ('$PARENT','$WK','contacts','$C2','mobile_phone','12','too_short'),
 ('$PARENT','$WK','contacts','$C4','mobile_phone','7','too_short');
insert into public.phone_normalization_items (run_id, workspace_id, table_name, row_id, column_name, original_value, proposed_value, classification) values
 ('$RUN','$WK','contacts','$C1','mobile_phone','1234',null,'blank_short'),
 ('$RUN','$WK','contacts','$C2','mobile_phone','12',null,'blank_short'),
 ('$RUN','$WK','contacts','$C3','phone','1234 ramal 55',null,'blank_short'),
 ('$RUN','$WK','contacts','$C4','mobile_phone','7',null,'blank_short'),
 -- item malicioso: aponta para registro de OUTRO workspace.
 ('$RUN','$WK','contacts','$CB','mobile_phone','1',null,'blank_short');
-- Edição concorrente depois da prévia.
update public.contacts set mobile_phone = '+5511988887777' where id = '$C4';
SQL

count() { iso_psql -tAc "select (select count(*) from public.workflow_events)||'/'||(select count(*) from public.audit_logs)||'/'||(select count(*) from public.property_history)||'/'||(select count(*) from public.notifications)"; }
BEFORE=$(count)
run_apply() {
  for col in mobile_phone phone; do
    iso_psql -tA -c "$(bun scripts/phone-e164/batch-sql.ts apply $RUN $PARENT $WK contacts $col 2)"
  done
}
OUT1=$(run_apply; run_apply; run_apply)
AFTER=$(count)
fail=0
ok() { echo "ok: $1"; }
bad() { echo "FALHOU: $1"; fail=1; }
q() { iso_psql -tAc "$1"; }

[ "$(q "select coalesce(mobile_phone,'NULL')||'|'||phone from public.contacts where id='$C1'")" = "NULL|+551133334444" ] && ok "4 dígitos apagado; fixo válido intacto" || bad "C1"
[ "$(q "select coalesce(mobile_phone,'NULL')||'|'||phone||'|'||coalesce(whatsapp_e164,'NULL') from public.contacts where id='$C2'")" = "NULL|+5511999998888|NULL" ] && ok "celular principal intacto e WhatsApp não derivado" || bad "C2 $(q "select coalesce(mobile_phone,'NULL')||'|'||phone||'|'||coalesce(whatsapp_e164,'NULL') from public.contacts where id='$C2'")"
[ "$(q "select coalesce(phone,'NULL')||'|'||coalesce(phone_ext,'NULL')||'|'||mobile_phone from public.contacts where id='$C3'")" = "NULL|55|+5511977776666" ] && ok "ramal preservado em campo próprio; celular intacto" || bad "C3"
[ "$(q "select mobile_phone from public.contacts where id='$C4'")" = "+5511988887777" ] && ok "editado depois da prévia não é sobrescrito" || bad "C4"
[ "$(q "select classification from public.phone_normalization_items where run_id='$RUN' and row_id='$C4'")" = "changed_since_dry_run" ] && ok "item marcado changed_since_dry_run" || bad "C4 marca"
[ "$(q "select mobile_phone from public.contacts where id='$CB'")" = "1" ] && ok "outro workspace intacto" || bad "CB"
[ "$(q "select count(*) from public.phone_normalization_items where run_id='$RUN' and row_id='$CB' and applied_at is not null")" = "0" ] && ok "item do outro workspace não aplicado" || bad "CB item"
[ "$BEFORE" = "$AFTER" ] && ok "sem automação/auditoria/histórico/notificação ($AFTER)" || bad "efeitos colaterais $BEFORE -> $AFTER"
[ "$(q "select string_agg(row_id::text||':'||coalesce(resolution,'-'),',' order by row_id) from public.phone_normalization_items where run_id='$PARENT'")" = "$C1:blank_short,$C2:blank_short,$C4:-" ] && ok "fila-mãe resolvida só no que foi gravado" || bad "resolução $(q "select string_agg(row_id::text||':'||coalesce(resolution,'-'),',') from public.phone_normalization_items where run_id='$PARENT'")"
# Fila (mesmo filtro da tela): base sem gravação e sem resolução → só C4 resta.
[ "$(q "select string_agg(row_id::text,',') from public.phone_normalization_items where run_id='$PARENT' and applied_at is null and resolved_at is null")" = "$C4" ] && ok "fila mostra só a pendência antiga real" || bad "fila"
[ "$(q "select count(*) from public.phone_normalization_items where run_id='$PARENT' and applied_at is not null")" = "0" ] && ok "trilha antiga preservada (applied_at da varredura intacto)" || bad "trilha"
LAST=$(run_apply | tr '\n' ' ')
[ "$LAST" = "0|0|0|0 0|0|0|0 " ] && ok "idempotente (repetir grava 0)" || bad "idempotência: $LAST"

# Rollback restaura o original e reabre a fila.
for col in mobile_phone phone; do iso_psql -tA -c "$(bun scripts/phone-e164/batch-sql.ts rollback $RUN - $WK contacts $col)" >/dev/null; done
[ "$(q "select mobile_phone from public.contacts where id='$C1'")" = "1234" ] && ok "rollback restaura o original" || bad "rollback C1"
[ "$(q "select phone||'|'||phone_ext from public.contacts where id='$C3'")" = "1234 ramal 55|55" ] && ok "rollback mantém ramal" || bad "rollback C3"
[ "$(q "select count(*) from public.phone_normalization_items where run_id='$PARENT' and resolved_at is not null")" = "0" ] && ok "rollback reabre a fila" || bad "reabrir"
[ "$(q "select mobile_phone from public.contacts where id='$C4'")" = "+5511988887777" ] && ok "rollback não sobrescreve edição posterior" || bad "rollback C4"

[ "$fail" = 0 ] && echo "TODAS AS PROVAS PASSARAM" || { echo "FALHOU"; exit 1; }
