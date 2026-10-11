-- DELETE payloads cannot reliably carry/filter tenant columns. Signal only that
-- authorized views should reconcile; no record ID, owner, title or content is exposed.
CREATE TABLE IF NOT EXISTS public.workspace_realtime_signals (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  table_name text NOT NULL CHECK (table_name IN ('activities','calendar_events','deal_line_items','meetings')),
  nonce uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, table_name)
);
ALTER TABLE public.workspace_realtime_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_realtime_signals REPLICA IDENTITY FULL;
REVOKE ALL ON public.workspace_realtime_signals FROM anon, authenticated;
GRANT SELECT ON public.workspace_realtime_signals TO authenticated;
GRANT ALL ON public.workspace_realtime_signals TO service_role;
DROP POLICY IF EXISTS workspace_realtime_signals_read ON public.workspace_realtime_signals;
CREATE POLICY workspace_realtime_signals_read ON public.workspace_realtime_signals
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE OR REPLACE FUNCTION public.signal_workspace_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.workspace_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.workspaces WHERE id=OLD.workspace_id) THEN
    INSERT INTO public.workspace_realtime_signals (workspace_id,table_name,nonce,updated_at)
    VALUES (OLD.workspace_id,TG_TABLE_NAME,gen_random_uuid(),now())
    ON CONFLICT (workspace_id,table_name) DO UPDATE SET nonce=EXCLUDED.nonce,updated_at=EXCLUDED.updated_at;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.signal_workspace_delete() FROM PUBLIC, anon, authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['activities','calendar_events','deal_line_items','meetings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_delete_signal ON public.%I', t);
    EXECUTE format('CREATE TRIGGER workspace_delete_signal AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.signal_workspace_delete()', t);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS
    (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='workspace_realtime_signals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_realtime_signals;
  END IF;
END $$;
