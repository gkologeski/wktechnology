-- Realtime só do histórico de propriedades (RLS do assinante continua valendo).
-- Os clientes assinam com filtro entity_id=eq.<ficha>, nunca a tabela inteira.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'property_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.property_history;
  END IF;
END $$;