DO $policies$
DECLARE
  p record;
  new_qual text;
  new_check text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('leads', 'contacts', 'companies', 'deals', 'activities')
       AND cmd <> 'INSERT'
       AND (qual LIKE '%owner_id = auth.uid()%' OR with_check LIKE '%owner_id = auth.uid()%')
  LOOP
    new_qual := replace(COALESCE(p.qual, ''), 'owner_id = auth.uid()',
                        'is_own_record(owner_id, assigned_to)');
    new_check := replace(COALESCE(p.with_check, ''), 'owner_id = auth.uid()',
                         'is_own_record(owner_id, assigned_to)');

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s %s %s',
      p.policyname,
      p.tablename,
      CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      p.cmd,
      array_to_string(p.roles, ', '),
      CASE WHEN new_qual = '' THEN '' ELSE 'USING (' || new_qual || ')' END,
      CASE WHEN new_check = '' THEN '' ELSE 'WITH CHECK (' || new_check || ')' END
    );
  END LOOP;
END
$policies$;

DO $ticket_policies$
DECLARE
  p record;
  new_qual text;
  new_check text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'tickets'
       AND cmd <> 'INSERT'
       AND (qual LIKE '%owner_id = auth.uid()%' OR with_check LIKE '%owner_id = auth.uid()%')
  LOOP
    new_qual := replace(COALESCE(p.qual, ''), 'owner_id = auth.uid()',
                        'is_own_record(owner_id, assignee_id)');
    new_check := replace(COALESCE(p.with_check, ''), 'owner_id = auth.uid()',
                         'is_own_record(owner_id, assignee_id)');

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tickets', p.policyname);
    EXECUTE format(
      'CREATE POLICY %I ON public.tickets AS %s FOR %s TO %s %s %s',
      p.policyname,
      CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      p.cmd,
      array_to_string(p.roles, ', '),
      CASE WHEN new_qual = '' THEN '' ELSE 'USING (' || new_qual || ')' END,
      CASE WHEN new_check = '' THEN '' ELSE 'WITH CHECK (' || new_check || ')' END
    );
  END LOOP;
END
$ticket_policies$;