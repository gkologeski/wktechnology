-- Ciclo 8: tempo real do White Label. Só as duas tabelas de branding (sem segredos);
-- a leitura continua limitada por RLS a membros do workspace.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='workspace_branding') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_branding;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='module_branding') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.module_branding;
  END IF;
END $$;