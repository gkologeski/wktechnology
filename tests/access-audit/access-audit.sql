-- Auditoria de acesso das tabelas do schema public (somente leitura).
-- Uso: psql "$DATABASE_URL" -f tests/access-audit/access-audit.sql
-- Cada linha é um achado: categoria | tabela | detalhe. Sem linhas = nenhum achado.
-- Categorias:
--   SEM_RLS               tabela sem Row Level Security habilitado
--   ACESSO_TRAVADO        RLS habilitado sem nenhuma política (inalcançável pelo app)
--   SEM_GRANT             tabela com políticas mas sem GRANT para authenticated/service_role
--   TO_PUBLIC             política aplicada ao papel public (inclui anon)
--   ANON_ESCRITA          política de escrita liberada para anon
--   POLITICA_SEM_ESCOPO   política com USING/WITH CHECK literal "true" para authenticated
-- Filtro opcional: \set prefixo 'help_' antes de rodar para auditar só um grupo.
\if :{?prefixo}
\else
\set prefixo ''
\endif

WITH t AS (
  SELECT c.oid, c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
     AND c.relname LIKE :'prefixo' || '%'
), p AS (
  SELECT pol.polrelid, pol.polname, pol.polcmd,
         pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
         pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr,
         ARRAY(SELECT CASE WHEN r = 0 THEN 'public' ELSE pg_get_userbyid(r) END
                 FROM unnest(pol.polroles) r) AS roles
    FROM pg_policy pol
)
SELECT 'SEM_RLS' AS categoria, t.relname AS tabela, 'RLS desabilitado' AS detalhe
  FROM t WHERE NOT t.relrowsecurity
UNION ALL
SELECT 'ACESSO_TRAVADO', t.relname, 'RLS sem políticas'
  FROM t WHERE t.relrowsecurity AND NOT EXISTS (SELECT 1 FROM p WHERE p.polrelid = t.oid)
UNION ALL
SELECT 'SEM_GRANT', t.relname, 'sem privilégio para authenticated nem service_role'
  FROM t
 WHERE EXISTS (SELECT 1 FROM p WHERE p.polrelid = t.oid)
   AND NOT has_table_privilege('authenticated', t.oid, 'SELECT,INSERT,UPDATE,DELETE')
   AND NOT has_table_privilege('service_role', t.oid, 'SELECT')
UNION ALL
SELECT 'TO_PUBLIC', t.relname, p.polname
  FROM t JOIN p ON p.polrelid = t.oid WHERE 'public' = ANY (p.roles)
UNION ALL
SELECT 'ANON_ESCRITA', t.relname, p.polname
  FROM t JOIN p ON p.polrelid = t.oid
 WHERE 'anon' = ANY (p.roles) AND p.polcmd IN ('a','w','d','*')
UNION ALL
SELECT 'POLITICA_SEM_ESCOPO', t.relname, p.polname
  FROM t JOIN p ON p.polrelid = t.oid
 WHERE 'authenticated' = ANY (p.roles)
   AND (coalesce(p.using_expr, '') = 'true' OR coalesce(p.check_expr, '') = 'true')
ORDER BY 1, 2, 3;
