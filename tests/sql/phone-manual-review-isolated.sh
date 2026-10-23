#!/usr/bin/env bash
# Prova isolada da revisão manual de celulares antigos sem o 9
# (`phone_review_resolve`): só admin ativo do workspace, sugestão conferida
# contra o número gravado, valor alterado no meio não é sobrescrito, item
# resolvido uma vez só, manter/apagar, backup e rollback que reabre a fila.
# Uso: bash tests/sql/phone-manual-review-isolated.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null

A=aaaaaaaa-0000-4000-8000-00000000000a
U1=10000000-0000-4000-8000-000000000001   # admin A
U2=10000000-0000-4000-8000-000000000002   # membro comum A
U6=10000000-0000-4000-8000-000000000006   # admin de B
P=44444444-4444-4444-8444-444444444444
K1=d0000000-0000-4000-8000-000000000001
K2=d0000000-0000-4000-8000-000000000002
K3=d0000000-0000-4000-8000-000000000003
K4=d0000000-0000-4000-8000-000000000004
K5=d0000000-0000-4000-8000-000000000005

iso_psql >/dev/null <<SQL
insert into public.contacts (id, workspace_id, owner_id, first_name, phone) values
 ('$K1','$A','$U1','Confirma','(51) 9301-6927'),
 ('$K2','$A','$U1','Mudou','(51) 9301-6928'),
 ('$K3','$A','$U1','Mantem','(51) 9301-6929'),
 ('$K4','$A','$U1','Apaga','(51) 9301-6930'),
 ('$K5','$A','$U1','SemSugestao','(11) 1234-567');
insert into public.phone_normalization_runs (id, workspace_id, normalizer_version, mode, status, criteria)
 values ('$P','$A','e164-v1','apply','done','varredura');
insert into public.phone_normalization_items (id, run_id, workspace_id, table_name, row_id, column_name, original_value, classification, review_kind) values
 (9001,'$P','$A','contacts','$K1','phone','(51) 9301-6927','invalid','legacy_mobile_no9'),
 (9002,'$P','$A','contacts','$K2','phone','(51) 9301-6928','invalid','legacy_mobile_no9'),
 (9003,'$P','$A','contacts','$K3','phone','(51) 9301-6929','invalid','legacy_mobile_no9'),
 (9004,'$P','$A','contacts','$K4','phone','(51) 9301-6930','invalid','legacy_mobile_no9'),
 (9005,'$P','$A','contacts','$K5','phone','(11) 1234-567','invalid',null);
SQL

as_user() { # $1 uid, $2 sql → imprime OK ou o erro
  iso_psql -tA -c "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$1\",\"role\":\"authenticated\"}',true) \\g /dev/null
$2; commit;" >/dev/null 2>/tmp/pmr.err && echo OK || sed -n 's/.*ERROR: *//p' /tmp/pmr.err | head -1
}
q() { iso_psql -tAc "$1"; }
fail=0
ok() { echo "ok: $1"; }
bad() { echo "FALHOU: $1"; fail=1; }
expect_err() { case "$2" in OK) bad "$1 (deveria recusar)";; *"$3"*) ok "$1";; *) bad "$1: $2";; esac; }

expect_err "membro comum não revisa" "$(as_user $U2 "select public.phone_review_resolve(9001,'confirm','+5551993016927')")" "administradores"
expect_err "admin de outro workspace não revisa" "$(as_user $U6 "select public.phone_review_resolve(9001,'confirm','+5551993016927')")" "administradores"
[ "$(q "select phone from public.contacts where id='$K1'")" = "(51) 9301-6927" ] && ok "recusas não alteram o cadastro" || bad "recusa alterou"
expect_err "sugestão que não bate com o número é recusada" "$(as_user $U1 "select public.phone_review_resolve(9001,'confirm','+5551988887777')")" "não corresponde"
expect_err "valor fora do formato de celular é recusado" "$(as_user $U1 "select public.phone_review_resolve(9001,'confirm','+555193016927')")" "Sugestão inválida"
[ "$(as_user $U1 "select public.phone_review_resolve(9001,'confirm','+5551993016927')")" = "OK" ] && ok "admin confirma" || bad "confirmar"
[ "$(q "select phone from public.contacts where id='$K1'")" = "+5551993016927" ] && ok "gravou o número com o 9" || bad "valor K1"
[ "$(q "select resolution||'|'||reviewed_by from public.phone_normalization_items where id=9001")" = "manual_confirmed|$U1" ] && ok "fila resolvida com quem decidiu" || bad "resolução 9001"
[ "$(q "select original_value||'|'||proposed_value from public.phone_normalization_items i join public.phone_normalization_runs r on r.id=i.run_id where r.parent_run_id='$P' and r.criteria='revisão manual' and i.row_id='$K1'")" = "(51) 9301-6927|+5551993016927" ] && ok "backup do original na execução de revisão manual" || bad "backup"
expect_err "item resolvido não é resolvido de novo" "$(as_user $U1 "select public.phone_review_resolve(9001,'keep')")" "já foi resolvido"

q "update public.contacts set phone = '+5551993016928' where id='$K2'" >/dev/null
expect_err "valor alterado depois da revisão não é sobrescrito" "$(as_user $U1 "select public.phone_review_resolve(9002,'confirm','+5551993016928')")" "alterado depois"
[ "$(q "select phone||'|'||(resolved_at is null) from public.contacts c, public.phone_normalization_items i where c.id='$K2' and i.id=9002")" = "+5551993016928|t" ] && ok "edição posterior preservada e item segue pendente" || bad "K2"

[ "$(as_user $U1 "select public.phone_review_resolve(9003,'keep')")" = "OK" ] && [ "$(q "select phone from public.contacts where id='$K3'")" = "(51) 9301-6929" ] && ok "manter não altera o cadastro" || bad "manter"
[ "$(as_user $U1 "select public.phone_review_resolve(9004,'clear')")" = "OK" ] && [ "$(q "select coalesce(phone,'NULL') from public.contacts where id='$K4'")" = "NULL" ] && ok "apagar deixa em branco" || bad "apagar"
expect_err "item sem sugestão não pode ser confirmado" "$(as_user $U1 "select public.phone_review_resolve(9005,'confirm','+5511912345670')")" "não tem sugestão"
anon=$(iso_psql -tA -c "begin; set local role anon; select public.phone_review_resolve(9005,'keep'); commit;" 2>&1 || true)
case "$anon" in *"permission denied"*) ok "visitante sem login não executa";; *) bad "anon: $anon";; esac
[ "$(q "select count(*) from public.phone_normalization_items where run_id='$P' and applied_at is null and resolved_at is null")" = "2" ] && ok "fila: restam só os 2 não resolvidos" || bad "fila"
[ "$(q "select (counts->'resolved'->'contacts.phone')::text from public.phone_normalization_runs where parent_run_id='$P'")" = '{"manual_kept": 1, "manual_cleared": 1, "manual_confirmed": 1}' ] && ok "contagem da revisão por tipo" || bad "contagem $(q "select counts from public.phone_normalization_runs where parent_run_id='$P'")"

MR=$(q "select id from public.phone_normalization_runs where parent_run_id='$P'")
iso_psql -tA -c "$(bun scripts/phone-e164/batch-sql.ts rollback "$MR" - "$A" contacts phone)" >/dev/null
[ "$(q "select phone from public.contacts where id='$K1'")" = "(51) 9301-6927" ] && [ "$(q "select phone from public.contacts where id='$K4'")" = "(51) 9301-6930" ] && ok "desfazer restaura confirmado e apagado" || bad "rollback"
[ "$(q "select string_agg(id::text, ',' order by id) from public.phone_normalization_items where run_id='$P' and resolved_at is null")" = "9001,9002,9004,9005" ] && ok "desfazer reabre os itens gravados (mantido segue resolvido)" || bad "reabrir $(q "select string_agg(id::text, ',' order by id) from public.phone_normalization_items where run_id='$P' and resolved_at is null")"

[ "$fail" = 0 ] && echo "TODAS AS PROVAS PASSARAM" || { echo "FALHOU"; exit 1; }
