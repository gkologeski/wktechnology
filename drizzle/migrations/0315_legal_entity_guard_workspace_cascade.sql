CREATE OR REPLACE FUNCTION public.legal_entities_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN RETURN OLD; END IF;
    IF OLD.is_default THEN RAISE EXCEPTION 'Defina outra empresa como padrão antes de excluir esta.'; END IF;
    u := public._legal_entity_usage_counts(OLD.id);
    IF u IS NOT NULL AND u <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Não é possível excluir: existem registros vinculados. Desative a empresa em vez de excluir.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.active = false AND NEW.is_default THEN
    RAISE EXCEPTION 'Defina outra empresa como padrão antes de desativar esta.';
  END IF;
  RETURN NEW;
END $$;