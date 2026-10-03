CREATE TABLE public.view_as_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('user','role')),
  role_id uuid,
  read_only boolean NOT NULL DEFAULT true,
  nonce text NOT NULL,
  session_id uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.view_as_sessions TO authenticated;
GRANT ALL ON public.view_as_sessions TO service_role;
ALTER TABLE public.view_as_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY view_as_sessions_admin_read ON public.view_as_sessions
  FOR SELECT TO authenticated USING (admin_id = auth.uid());
CREATE INDEX view_as_sessions_session_idx ON public.view_as_sessions (session_id) WHERE ended_at IS NULL;

ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS is_test_user boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_read_only_view()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT EXISTS (
      SELECT 1 FROM public.view_as_sessions v
       WHERE v.session_id = NULLIF(auth.jwt()->>'session_id','')::uuid
         AND v.read_only AND v.ended_at IS NULL AND v.expires_at > now()
    )
  ), false);
$$;
GRANT EXECUTE ON FUNCTION public.is_read_only_view() TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_schema=c.table_schema AND tb.table_name=c.table_name
     WHERE c.table_schema='public' AND c.column_name='workspace_id'
       AND tb.table_type='BASE TABLE' AND c.table_name <> 'view_as_sessions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS view_as_ro_ins ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS view_as_ro_upd ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS view_as_ro_del ON public.%I', t);
    EXECUTE format('CREATE POLICY view_as_ro_ins ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_read_only_view())', t);
    EXECUTE format('CREATE POLICY view_as_ro_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_read_only_view())', t);
    EXECUTE format('CREATE POLICY view_as_ro_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_read_only_view())', t);
  END LOOP;
END $$;