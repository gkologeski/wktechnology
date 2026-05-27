
CREATE OR REPLACE FUNCTION public.default_workspace_for_user(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
    FROM public.workspace_members
   WHERE user_id = _user
   ORDER BY joined_at ASC NULLS LAST
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.set_workspace_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ws uuid;
BEGIN
  v_ws := (to_jsonb(NEW) ->> 'workspace_id')::uuid;

  IF v_ws IS NULL THEN
    IF v_uid IS NOT NULL THEN
      v_ws := public.default_workspace_for_user(v_uid);
      IF v_ws IS NOT NULL THEN
        NEW := jsonb_populate_record(NEW, jsonb_build_object('workspace_id', v_ws));
      END IF;
    END IF;
  ELSE
    IF v_uid IS NOT NULL
       AND NOT public.is_platform_admin(v_uid)
       AND NOT public.is_workspace_member(v_ws, v_uid) THEN
      RAISE EXCEPTION 'Access denied: user is not a member of workspace %', v_ws
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['contacts','companies','deals','leads','tickets','activities'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_workspace_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_workspace_%I BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert()',
      t, t
    );
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY['contacts','companies','deals','leads','tickets','activities'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format($f$
      CREATE POLICY "ws_select_%1$s" ON public.%1$I
        FOR SELECT TO authenticated
        USING (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "ws_insert_%1$s" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "ws_update_%1$s" ON public.%1$I
        FOR UPDATE TO authenticated
        USING (workspace_id IN (SELECT public.current_user_workspaces()))
        WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "ws_delete_%1$s" ON public.%1$I
        FOR DELETE TO authenticated
        USING (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t);
  END LOOP;
END $$;
