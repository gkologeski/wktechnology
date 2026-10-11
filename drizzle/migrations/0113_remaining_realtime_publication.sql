-- Assinaturas existentes: manter RLS e publicar apenas as tabelas ausentes.
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['deal_line_items', 'meetings'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
      AND schemaname='public' AND tablename=target) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target);
    END IF;
  END LOOP;
END $$;
