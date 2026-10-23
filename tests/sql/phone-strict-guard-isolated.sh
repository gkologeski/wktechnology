#!/usr/bin/env bash
# Prova isolada da guarda de formato (phone_strict_e164): com ela ligada,
# telefone NOVO/ALTERADO fora da forma E.164 é recusado; vazio e E.164 passam;
# telefone antigo não editado não bloqueia salvar outro campo; workspace com a
# guarda desligada não é afetado.
# Uso: bash tests/sql/phone-strict-guard-isolated.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null

A=aaaaaaaa-0000-4000-8000-00000000000a
B=aaaaaaaa-0000-4000-8000-00000000000b
U1=10000000-0000-4000-8000-000000000001
U6=10000000-0000-4000-8000-000000000006
L=e0000000-0000-4000-8000-000000000001
iso_psql >/dev/null <<SQL
insert into public.contacts (id, workspace_id, owner_id, first_name, phone) values ('$L','$A','$U1','Legado','(11) 3333-4444');
update public.workspaces set phone_strict_e164 = true where id = '$A';
SQL
q() { iso_psql -tA -c "$1" >/dev/null 2>/tmp/psg.err && echo OK || sed -n 's/.*ERROR: *//p' /tmp/psg.err | head -1; }
fail=0
ok() { echo "ok: $1"; }
bad() { echo "FALHOU: $1 ($2)"; fail=1; }

r=$(q "insert into public.contacts (workspace_id, owner_id, first_name, phone) values ('$A','$U1','Novo','(11) 3333-4444')"); [[ "$r" == *"E.164"* ]] && ok "novo telefone fora do padrão é recusado" || bad "recusa insert" "$r"
r=$(q "insert into public.contacts (workspace_id, owner_id, first_name, mobile_phone) values ('$A','$U1','Curto','1234')"); [[ "$r" == *"E.164"* ]] && ok "celular de 4 dígitos é recusado" || bad "recusa curto" "$r"
r=$(q "insert into public.contacts (workspace_id, owner_id, first_name, phone) values ('$A','$U1','Padrao','+551133334444')"); [ "$r" = OK ] && ok "E.164 é aceito" || bad "aceita e164" "$r"
r=$(q "insert into public.contacts (workspace_id, owner_id, first_name, phone) values ('$A','$U1','SemTel',null)"); [ "$r" = OK ] && ok "sem telefone é aceito (importação grava vazio)" || bad "aceita null" "$r"
r=$(q "update public.contacts set first_name = 'Legado editado' where id = '$L'"); [ "$r" = OK ] && ok "telefone antigo não editado não bloqueia outro campo" || bad "legado" "$r"
r=$(q "update public.contacts set phone = '(11) 3333-5555' where id = '$L'"); [[ "$r" == *"E.164"* ]] && ok "alterar para fora do padrão é recusado" || bad "update" "$r"
r=$(q "update public.leads set phone = phone where false"); [ "$r" = OK ] || true
r=$(q "insert into public.contacts (workspace_id, owner_id, first_name, phone) values ('$B','$U6','OutroWs','(11) 3333-4444')"); [ "$r" = OK ] && ok "workspace com a guarda desligada não é afetado" || bad "outro ws" "$r"
r=$(q "insert into public.companies (workspace_id, owner_id, name, phone) values ('$A','$U1','Emp','3333-4444')"); [[ "$r" == *"E.164"* ]] && ok "empresas também protegidas" || bad "empresa" "$r"

[ "$fail" = 0 ] && echo "TODAS AS PROVAS PASSARAM" || { echo "FALHOU"; exit 1; }
