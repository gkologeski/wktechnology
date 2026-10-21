#!/usr/bin/env bash
# Equivalência da RLS de apontamentos antes/depois da otimização (0181), em banco descartável.
# Carrega a prova C5 (> 5.000 apontamentos; perfis próprio/líder/workspace/inativo/outro tenant/negação), registra
# para cada usuário o conjunto EXATO de apontamentos visíveis/alteráveis/excluíveis pela regra antiga,
# aplica a migração e confere que o conjunto é idêntico (a prova C6 roda à parte com as 3 migrações).
# Uso: bash tests/sql/cycle6-rls-equivalence.sh <0179> <0180> <0181>
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/isolated-db/env.sh
bash scripts/isolated-db/stop.sh >/dev/null 2>&1 || true
rm -rf "$ISO_DATA"
bash scripts/isolated-db/start.sh >/dev/null
iso_guard
iso_psql -f scripts/isolated-db/seed.sql >/dev/null
M1=$1; M2=$2; M3=$3
for MIG in "$M1" "$M2"; do iso_psql -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null 2>&1 || { echo "FALHOU ao aplicar $MIG"; exit 1; }; done
for PRE in tests/sql/project-dashboard-isolated.sql; do
  O=$(mktemp); iso_psql -f "$PRE" > "$O" 2>&1 || true
  grep -qE "FALHOU|ERROR" "$O" && { echo "FALHOU na pré-condição $PRE"; grep -m3 -E "FALHOU|ERROR" "$O"; exit 1; }
  echo "pré-condição $PRE: $(grep -c 'ok:' "$O") asserções ok"
done
iso_psql -q <<'SQL'
DROP SCHEMA IF EXISTS t_eq CASCADE; CREATE SCHEMA t_eq;
CREATE TABLE t_eq.q (cmd text, phase text, restr text, perm text);
CREATE TABLE t_eq.fp (phase text, cmd text, uid uuid, session uuid, fp text);
CREATE FUNCTION t_eq.capture(p_phase text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record; u uuid; s uuid; v text;
BEGIN
  INSERT INTO t_eq.q SELECT x.cmd, p_phase, x.qual, y.qual FROM pg_policies x JOIN pg_policies y
    ON y.tablename = x.tablename AND y.cmd = x.cmd AND y.policyname LIKE 'ws_project_time_entries_%'
   WHERE x.tablename = 'project_time_entries' AND x.policyname IN ('ptime_perm_select','ptime_perm_update','ptime_perm_delete');
  FOR r IN SELECT * FROM t_eq.q WHERE phase = p_phase LOOP
    FOR u IN SELECT id FROM auth.users WHERE email LIKE '%@techerp-test.invalid' LOOP
      FOREACH s IN ARRAY ARRAY[NULL::uuid, 'b0000000-0000-4000-8000-0000000000c6'::uuid] LOOP
        PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'session_id', s)::text, true);
        EXECUTE format('SELECT count(*) || '':'' || coalesce(md5(string_agg(id::text, '','' ORDER BY id)), ''-'') FROM public.project_time_entries WHERE (%s) AND (%s)', r.perm, r.restr) INTO v;
        INSERT INTO t_eq.fp VALUES (p_phase, r.cmd, u, s, v);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
SELECT t_eq.capture('old');
SQL
iso_psql -v ON_ERROR_STOP=1 -f "$M3" >/dev/null 2>&1 || { echo "FALHOU ao aplicar $M3"; exit 1; }
iso_psql -q -c "select t_eq.capture('new')"
N=$(iso_psql -tAc "select count(*) from t_eq.fp where phase='old'")
DIFF=$(iso_psql -tAc "select count(*) from t_eq.fp o join t_eq.fp n on n.phase='new' and n.cmd=o.cmd and n.uid=o.uid and n.session is not distinct from o.session where o.phase='old' and o.fp <> n.fp")
NONEMPTY=$(iso_psql -tAc "select count(*) from t_eq.fp where phase='old' and fp not like '0:%'")
CHANGED=$(iso_psql -tAc "select count(*) from t_eq.q o join t_eq.q n on n.cmd=o.cmd and n.phase='new' where o.phase='old' and o.restr <> n.restr")
[ "$CHANGED" = 3 ] || { echo "FALHOU: políticas não foram trocadas ($CHANGED)"; exit 1; }
[ "$DIFF" = 0 ] && echo "ok: $N combinações (usuário × sessão × comando) idênticas antes/depois; $NONEMPTY com linhas visíveis" || { echo "FALHOU: $DIFF combinações divergentes"; iso_psql -c "select o.cmd, o.uid, o.session, o.fp old, n.fp new from t_eq.fp o join t_eq.fp n on n.phase='new' and n.cmd=o.cmd and n.uid=o.uid and n.session is not distinct from o.session where o.phase='old' and o.fp<>n.fp limit 10"; exit 1; }
echo "FIM: equivalência da RLS comprovada"
