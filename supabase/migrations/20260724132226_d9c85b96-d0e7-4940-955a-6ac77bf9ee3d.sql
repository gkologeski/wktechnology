
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['charging_templates','email_broadcasts','email_snippets'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS ws_insert_%1$s ON public.%1$s', t);
    EXECUTE format($f$CREATE POLICY ws_insert_%1$s ON public.%1$s FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()))$f$, t);
  END LOOP;
END $$;
