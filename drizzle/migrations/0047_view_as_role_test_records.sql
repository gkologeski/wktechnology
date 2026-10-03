CREATE TABLE public.view_as_test_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.view_as_sessions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_name, record_id)
);
GRANT SELECT ON public.view_as_test_records TO authenticated;
GRANT ALL ON public.view_as_test_records TO service_role;
ALTER TABLE public.view_as_test_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY view_as_test_records_admin_read ON public.view_as_test_records
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.view_as_sessions s WHERE s.id = session_id AND s.admin_id = auth.uid()));
CREATE INDEX view_as_test_records_record_idx ON public.view_as_test_records (record_id);

CREATE OR REPLACE FUNCTION public.current_role_test_session()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id FROM public.view_as_sessions v
   WHERE v.session_id = NULLIF(auth.jwt()->>'session_id','')::uuid
     AND v.mode = 'role' AND v.ended_at IS NULL
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_role_test_session() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_test_record(_record_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.view_as_test_records r WHERE r.record_id = _record_id);
$$;
GRANT EXECUTE ON FUNCTION public.is_test_record(uuid) TO authenticated, service_role;

-- Bloqueia vínculos de registros de teste com registros reais.
CREATE OR REPLACE FUNCTION public.view_as_guard_test_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; v text; rec jsonb;
BEGIN
  IF public.current_role_test_session() IS NULL THEN RETURN NEW; END IF;
  rec := to_jsonb(NEW);
  FOREACH k IN ARRAY ARRAY['company_id','contact_id','lead_id','deal_id','parent_company_id','parent_id','entity_id','related_id'] LOOP
    v := rec->>k;
    IF v IS NOT NULL AND v <> '' AND (TG_OP = 'INSERT' OR v IS DISTINCT FROM to_jsonb(OLD)->>k) THEN
      IF NOT public.is_test_record(v::uuid) THEN
        RAISE EXCEPTION 'Modo teste: não é possível vincular a registros reais.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.view_as_register_test_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s uuid := public.current_role_test_session();
BEGIN
  IF s IS NOT NULL THEN
    INSERT INTO public.view_as_test_records (session_id, workspace_id, table_name, record_id)
    VALUES (s, NEW.workspace_id, TG_TABLE_NAME, NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END $$;

-- Suprime automações e notificações disparadas pelo papel de teste.
CREATE OR REPLACE FUNCTION public.view_as_suppress_side_effect()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_role_test_session() IS NOT NULL THEN RETURN NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER view_as_suppress BEFORE INSERT ON public.workflow_events
  FOR EACH ROW EXECUTE FUNCTION public.view_as_suppress_side_effect();
CREATE TRIGGER view_as_suppress BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.view_as_suppress_side_effect();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','contacts','leads','deals','activities'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS view_as_ro_ins ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS view_as_ro_upd ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS view_as_ro_del ON public.%I', t);
    EXECUTE format('CREATE POLICY view_as_ro_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_read_only_view() OR public.is_test_record(id)) WITH CHECK (NOT public.is_read_only_view() OR public.is_test_record(id))', t);
    EXECUTE format('CREATE POLICY view_as_ro_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_read_only_view() OR public.is_test_record(id))', t);
    EXECUTE format('CREATE TRIGGER view_as_guard_links BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.view_as_guard_test_links()', t);
    EXECUTE format('CREATE TRIGGER view_as_register AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.view_as_register_test_record()', t);
  END LOOP;
END $$;