
-- =========================================================
-- security_scan_runs
-- =========================================================
CREATE TABLE IF NOT EXISTS public.security_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_scan_runs TO authenticated;
GRANT ALL ON public.security_scan_runs TO service_role;

ALTER TABLE public.security_scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_runs platform admins read"
  ON public.security_scan_runs FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "scan_runs service write"
  ON public.security_scan_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS security_scan_runs_started_idx
  ON public.security_scan_runs (started_at DESC);

-- =========================================================
-- security_scan_findings
-- =========================================================
CREATE TABLE IF NOT EXISTS public.security_scan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.security_scan_runs(id) ON DELETE CASCADE,
  scanner text NOT NULL,           -- 'rls' | 'grants' | 'functions' | 'linter'
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  category text NOT NULL,
  code text NOT NULL,              -- short stable code
  title text NOT NULL,
  detail text,
  ref jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { schema, table, function, role, ... }
  fingerprint text NOT NULL,       -- hash for dedupe between runs
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_scan_findings TO authenticated;
GRANT ALL ON public.security_scan_findings TO service_role;

ALTER TABLE public.security_scan_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_findings platform admins read"
  ON public.security_scan_findings FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "scan_findings service write"
  ON public.security_scan_findings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS security_scan_findings_run_idx
  ON public.security_scan_findings (run_id);
CREATE INDEX IF NOT EXISTS security_scan_findings_severity_idx
  ON public.security_scan_findings (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS security_scan_findings_fingerprint_idx
  ON public.security_scan_findings (fingerprint);

-- =========================================================
-- Collector: returns JSON array of findings
-- =========================================================
CREATE OR REPLACE FUNCTION public.security_scan_collect()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_results jsonb := '[]'::jsonb;
  r record;
BEGIN
  -- 1. Tables in public without RLS enabled
  FOR r IN
    SELECT c.relname AS tbl
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND NOT c.relrowsecurity
       AND c.relname NOT LIKE 'pg_%'
  LOOP
    v_results := v_results || jsonb_build_object(
      'scanner','rls',
      'severity','critical',
      'category','RLS desabilitado',
      'code','rls_disabled',
      'title', format('Tabela public.%s sem RLS', r.tbl),
      'detail','A tabela está exposta pela Data API sem Row Level Security ativo.',
      'ref', jsonb_build_object('schema','public','table',r.tbl),
      'fingerprint', md5('rls_disabled:'||r.tbl)
    );
  END LOOP;

  -- 2. Tables with RLS enabled but no policies
  FOR r IN
    SELECT c.relname AS tbl
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity
       AND NOT EXISTS (
         SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname
       )
  LOOP
    v_results := v_results || jsonb_build_object(
      'scanner','rls',
      'severity','error',
      'category','Sem políticas',
      'code','rls_no_policies',
      'title', format('Tabela public.%s tem RLS mas nenhuma política', r.tbl),
      'detail','Sem políticas, todo acesso autenticado é negado — verifique se isso é intencional.',
      'ref', jsonb_build_object('schema','public','table',r.tbl),
      'fingerprint', md5('rls_no_policies:'||r.tbl)
    );
  END LOOP;

  -- 3. anon grants on public tables (read or write)
  FOR r IN
    SELECT table_name AS tbl, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND grantee = 'anon'
     GROUP BY table_name
  LOOP
    v_results := v_results || jsonb_build_object(
      'scanner','grants',
      'severity', CASE WHEN r.privs ~ '(INSERT|UPDATE|DELETE|TRUNCATE)' THEN 'critical' ELSE 'warning' END,
      'category','GRANT a anon',
      'code','anon_grant',
      'title', format('public.%s tem GRANT %s para anon', r.tbl, r.privs),
      'detail','Confirme se a tabela deve ser pública. Para dados sensíveis remova o GRANT a anon.',
      'ref', jsonb_build_object('schema','public','table',r.tbl,'privileges',r.privs),
      'fingerprint', md5('anon_grant:'||r.tbl||':'||r.privs)
    );
  END LOOP;

  -- 4. SECURITY DEFINER functions in public without search_path set
  FOR r IN
    SELECT p.proname AS fn
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND NOT EXISTS (
         SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
          WHERE c LIKE 'search_path=%'
       )
  LOOP
    v_results := v_results || jsonb_build_object(
      'scanner','functions',
      'severity','warning',
      'category','SECURITY DEFINER sem search_path',
      'code','secdef_search_path',
      'title', format('Função public.%s é SECURITY DEFINER sem search_path fixo', r.fn),
      'detail','Adicione SET search_path = public para evitar sequestro por objetos de outros schemas.',
      'ref', jsonb_build_object('schema','public','function',r.fn),
      'fingerprint', md5('secdef_search_path:'||r.fn)
    );
  END LOOP;

  RETURN v_results;
END;
$fn$;

REVOKE ALL ON FUNCTION public.security_scan_collect() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_scan_collect() TO service_role;

-- updated_at trigger not needed; tables are append-only-ish
