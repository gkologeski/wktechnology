CREATE OR REPLACE FUNCTION public.resolve_workspace_id(_owner uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT w.id FROM public.workspaces w WHERE w.id = _owner),
    (SELECT w.id FROM public.workspaces w WHERE w.created_by = _owner ORDER BY w.created_at LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_workspace_id(uuid) TO authenticated, service_role;

DO $do$
DECLARE
  r record;
  ws_expr text;
  new_qual text;
  new_wc text;
  cmd text;
  roles text;
  sql text;
BEGIN
  FOR r IN
    SELECT c.oid AS relid,
           c.relname,
           p.polname,
           p.polcmd,
           p.polpermissive,
           pg_get_expr(p.polqual, p.polrelid) AS qual,
           pg_get_expr(p.polwithcheck, p.polrelid) AS wc,
           ARRAY(SELECT pg_get_userbyid(oid_role) FROM unnest(p.polroles) AS oid_role) AS role_names
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
            || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
           LIKE '%user_has_permission(auth.uid(), ''%'
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = r.relid AND a.attname = 'workspace_id'
         AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      ws_expr := 'workspace_id';
    ELSIF EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = r.relid AND a.attname = 'owner_id'
         AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      ws_expr := 'public.resolve_workspace_id(owner_id)';
    ELSE
      CONTINUE;
    END IF;

    new_qual := replace(coalesce(r.qual, ''),
      'user_has_permission(auth.uid(), ''',
      'user_has_permission(auth.uid(), ' || ws_expr || ', ''');
    new_wc := replace(coalesce(r.wc, ''),
      'user_has_permission(auth.uid(), ''',
      'user_has_permission(auth.uid(), ' || ws_expr || ', ''');

    cmd := CASE r.polcmd
             WHEN 'r' THEN 'SELECT'
             WHEN 'a' THEN 'INSERT'
             WHEN 'w' THEN 'UPDATE'
             WHEN 'd' THEN 'DELETE'
             ELSE 'ALL'
           END;

    IF r.role_names IS NULL OR array_length(r.role_names, 1) IS NULL THEN
      roles := 'public';
    ELSE
      roles := array_to_string(ARRAY(SELECT quote_ident(x) FROM unnest(r.role_names) x), ', ');
    END IF;

    EXECUTE format('DROP POLICY %I ON public.%I', r.polname, r.relname);

    sql := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
                  r.polname, r.relname,
                  CASE WHEN r.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
                  cmd, roles);
    IF r.qual IS NOT NULL THEN
      sql := sql || ' USING (' || new_qual || ')';
    END IF;
    IF r.wc IS NOT NULL THEN
      sql := sql || ' WITH CHECK (' || new_wc || ')';
    END IF;
    EXECUTE sql;
  END LOOP;
END
$do$;

DROP POLICY IF EXISTS wm_update_admin ON public.workspace_members;
CREATE POLICY wm_update_admin ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));