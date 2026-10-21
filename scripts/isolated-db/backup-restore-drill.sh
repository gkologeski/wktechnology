#!/usr/bin/env bash
# Ensaio de backup e restauração do ciclo 6 — SOMENTE em bancos descartáveis com dados SINTÉTICOS.
# 1) origem: harness isolado + migração do ciclo + roteiro C6 (apontamentos, API, fila, fechamento)
#    + anexos privados sintéticos (arquivos + linhas em storage.objects de bucket privado);
# 2) backup: pg_dumpall --roles-only (papéis/associações) + pg_dump -Fc (banco inteiro) + tar dos anexos;
# 3) restauração em OUTRO cluster/porta; 4) compara contagens, hashes por tabela, privilégios/políticas,
#    donos de função, hashes dos anexos e a "impressão" de RLS (o que cada perfil vê); 5) mede RTO.
# NÃO é o backup gerenciado da plataforma (diário/retenção/PITR): ver docs/architecture/operations-cycle6.md.
# Uso: bash scripts/isolated-db/backup-restore-drill.sh drizzle/migrations/0179_*.sql
# Exit: 0 restauração idêntica | 1 divergência | 2 bloqueado.
set -uo pipefail
cd "$(dirname "$0")/../.."
SRC_ROOT=/tmp/techerp-isolated; DST_ROOT=/tmp/c6-restore; DST_PORT=54341
ART=/tmp/c6-drill; rm -rf "$ART"; mkdir -p "$ART"; chmod 700 "$ART"
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true; rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null || exit 2
iso_guard || exit 2
iso_psql -f scripts/isolated-db/seed.sql >/dev/null || exit 2
for MIG in "$@"; do iso_psql -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1 || { echo "BLOQUEADO: migração $MIG"; exit 2; }; done
iso_psql -f tests/sql/cycle6-isolated.sql > "$ART/source-c6.log" 2>&1
grep -q "fim" "$ART/source-c6.log" && ! grep -qE "FALHOU|ERROR" "$ART/source-c6.log" || { echo "BLOQUEADO: roteiro de origem falhou"; exit 2; }

# Anexos privados sintéticos (bytes aleatórios; nenhum dado real).
STORE="$ART/storage-src"; mkdir -p "$STORE/iso-private"
iso_psql -c "insert into storage.buckets (id, name, public) values ('iso-private', 'iso-private', false) on conflict do nothing" >/dev/null
for i in $(seq 1 20); do
  f="aaaaaaaa-0000-4000-8000-00000000000a/anexo-$i.bin"; mkdir -p "$STORE/iso-private/$(dirname "$f")"
  head -c $((1024 * i)) /dev/urandom > "$STORE/iso-private/$f"
  h=$(sha256sum "$STORE/iso-private/$f" | cut -d' ' -f1)
  iso_psql -c "insert into storage.objects (bucket_id, name, owner_id, metadata) values ('iso-private', '$f', '10000000-0000-4000-8000-000000000002', jsonb_build_object('sha256','$h','size',$((1024 * i))))" >/dev/null
done

FP_SQL=$(cat <<'SQL'
with t as (
  select format('%I.%I', n.nspname, c.relname) as tbl from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind = 'r' and n.nspname in ('public','auth','storage','techerp_api','cron') and c.relname not like 'pg_%')
select string_agg(tbl, ',' order by tbl) from t
SQL
)
manifest() { # $1 = função psql; $2 = arquivo
  local q="$1" out="$2"; : > "$out"
  for tbl in $($q -tAc "$FP_SQL" | tr ',' ' '); do
    echo "$tbl $($q -tAc "select count(*) || ':' || coalesce(md5(string_agg(x::text, '|' order by x::text)), '-') from $tbl x")" >> "$out"
  done
  echo "policies $($q -tAc "select md5(string_agg(schemaname||tablename||policyname||cmd||permissive||array_to_string(roles,',')||coalesce(qual,'')||coalesce(with_check,''), '|' order by schemaname, tablename, policyname)) from pg_policies")" >> "$out"
  echo "table_grants $($q -tAc "select md5(string_agg(grantee||table_schema||table_name||privilege_type, '|' order by grantee, table_schema, table_name, privilege_type)) from information_schema.role_table_grants where table_schema in ('public','techerp_api','storage')")" >> "$out"
  echo "function_acl $($q -tAc "select md5(string_agg(p.oid::regprocedure::text||coalesce(p.proacl::text,'')||pg_get_userbyid(p.proowner)||p.prosecdef::text||coalesce(array_to_string(p.proconfig,','),''), '|' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','techerp_api')")" >> "$out"
  echo "role_members $($q -tAc "select md5(string_agg(roleid::regrole::text||'>'||member::regrole::text||inherit_option::text, '|' order by 1)) from pg_auth_members where roleid::regrole::text in ('authenticated','anon','service_role','techerp_api_subject')")" >> "$out"
  # Impressão de RLS: quanto cada perfil enxerga, como ele mesmo.
  for u in 1 2 3 4 5 6 7 8; do
    local uid="10000000-0000-4000-8000-00000000000$u"
    echo "rls_u$u $($q -tAc "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"$uid\",\"role\":\"authenticated\"}',true) ; 
      select (select count(*) from public.project_time_entries)||'/'||(select count(*) from public.projects)||'/'||(select count(*) from public.project_time_client_requests)||'/'||(select count(*) from public.financial_entries); rollback;" | tail -1)" >> "$out"
  done
  echo "api_port_u2 $($q -tAc "begin; set local role service_role; select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true) ; 
    select public.project_api_list_time_entries('c6200000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a',null,null,null,null,null,false,200,0)->>'total'; rollback;" | tail -1)" >> "$out"
}
src_q() { iso_psql "$@"; }
manifest src_q "$ART/manifest-before.txt"
(cd "$STORE" && find . -type f -print0 | sort -z | xargs -0 sha256sum) > "$ART/files-before.txt"

# ---------------------------------------------------------------- backup
T0=$(date +%s%N)
pg_dumpall -h "$ISO_SOCK" -p "$ISO_PORT" -U postgres --roles-only --no-role-passwords > "$ART/roles.sql"
pg_dump -h "$ISO_SOCK" -p "$ISO_PORT" -U postgres -Fc -f "$ART/db.dump" postgres
tar -C "$STORE" -czf "$ART/storage.tgz" .
BACKUP_MS=$(( ($(date +%s%N)-T0)/1000000 ))
DUMP_BYTES=$(stat -c %s "$ART/db.dump")
grep -qiE "password|secret_value|lvb_[0-9a-f]{20}" "$ART/roles.sql" && { echo "FALHOU: dump de papéis contém senha"; exit 1; }

# ---------------------------------------------------------------- restauração em outro cluster
T1=$(date +%s%N)
rm -rf "$DST_ROOT"; mkdir -p "$DST_ROOT/data" "$DST_ROOT/sock"; chown "$ISO_OS_USER" "$DST_ROOT/data" "$DST_ROOT/sock"
runuser -u "$ISO_OS_USER" -- env PATH="$PATH" initdb -D "$DST_ROOT/data" -U postgres -A trust --no-sync >/dev/null
runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$DST_ROOT/data" -l "$DST_ROOT/data/pg.log" -w \
  -o "-p $DST_PORT -k $DST_ROOT/sock -c listen_addresses='' -c wal_level=logical" start >/dev/null
dst_q() { psql -X -q -h "$DST_ROOT/sock" -p "$DST_PORT" -U postgres -d postgres "$@"; }
dst_q -f "$ART/roles.sql" > "$ART/restore-roles.log" 2>&1
dst_q -c "alter database postgres set search_path = \"\$user\", public, extensions" >/dev/null
pg_restore -h "$DST_ROOT/sock" -p "$DST_PORT" -U postgres -d postgres --no-comments "$ART/db.dump" > "$ART/restore.log" 2>&1
RESTORE_ERRORS=$(grep -c "ERROR" "$ART/restore.log" || true)
DST_STORE="$ART/storage-dst"; mkdir -p "$DST_STORE"; tar -C "$DST_STORE" -xzf "$ART/storage.tgz"
RTO_MS=$(( ($(date +%s%N)-T1)/1000000 ))
[ "$(dst_q -tAc "select label from public.__isolated_marker where id=1")" = "techerp-isolated-harness" ] || { echo "FALHOU: marcador ausente no restaurado"; exit 1; }
manifest dst_q "$ART/manifest-after.txt"
(cd "$DST_STORE" && find . -type f -print0 | sort -z | xargs -0 sha256sum) > "$ART/files-after.txt"
# Anexos: arquivo restaurado confere com o hash gravado na linha de storage.objects.
META_OK=$(dst_q -tAc "select string_agg(name||' '||(metadata->>'sha256'), E'\n' order by name) from storage.objects where bucket_id='iso-private'" | while read -r n h; do
  [ "$(sha256sum "$DST_STORE/iso-private/$n" | cut -d' ' -f1)" = "$h" ] && echo ok || echo bad; done | sort | uniq -c | tr '\n' ' ')
# Fluxo depois de restaurar: API e fila continuam funcionando com as mesmas regras.
FLOW=$(dst_q -tAc "begin; set local role authenticated; select set_config('request.jwt.claims','{\"sub\":\"10000000-0000-4000-8000-000000000002\",\"role\":\"authenticated\"}',true) ; 
  select (public.project_time_entry_sync('aaaaaaaa-0000-4000-8000-00000000000a','c6400000-0000-4000-8000-000000000001',repeat('1',64),'{}'::jsonb)->>'replay'); rollback;" 2>&1 | tail -1)
DIFF=$(diff "$ART/manifest-before.txt" "$ART/manifest-after.txt"; diff "$ART/files-before.txt" "$ART/files-after.txt")
[ "${ISO_KEEP:-0}" = 1 ] || runuser -u "$ISO_OS_USER" -- env PATH="$PATH" pg_ctl -D "$DST_ROOT/data" -m fast stop >/dev/null
[ "${ISO_KEEP:-0}" = 1 ] || bash scripts/isolated-db/stop.sh >/dev/null
python3 - "$ART" "$BACKUP_MS" "$RTO_MS" "$DUMP_BYTES" "$RESTORE_ERRORS" "$META_OK" "$FLOW" "$([ -z "$DIFF" ] && echo identical || echo different)" <<'PY'
import json, sys
art, bms, rto, size, errs, meta, flow, same = sys.argv[1:9]
lines = open(f"{art}/manifest-before.txt").read().splitlines()
out = {"tables_and_checks": len(lines), "backup_ms": int(bms), "restore_rto_ms": int(rto), "dump_bytes": int(size),
       "restore_errors": int(errs), "attachments": meta.strip(), "replay_after_restore": flow.strip(), "manifest": same,
       "files": len(open(f"{art}/files-before.txt").read().splitlines())}
json.dump(out, open(f"{art}/drill-summary.json", "w"), indent=1); print(json.dumps(out, indent=1))
PY
[ -z "$DIFF" ] && [ "$FLOW" = "true" ] || { echo "DIVERGÊNCIA:"; echo "$DIFF" | head -20; exit 1; }
echo "ok: restauração idêntica (contagens, hashes por tabela, políticas, privilégios, donos, RLS por perfil, anexos) e fluxo funcionando"
