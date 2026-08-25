-- Função e trigger para validar duplicidade de leads com mensagem amigável
CREATE OR REPLACE FUNCTION public.leads_check_duplicate()
RETURNS TRIGGER AS $$
DECLARE
  normalized_phone text;
  existing_id uuid;
BEGIN
  -- Normaliza email
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    NEW.email := lower(trim(NEW.email));
  END IF;

  -- Normaliza telefone (apenas dígitos para comparação)
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    normalized_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  END IF;

  -- Verifica duplicidade de e-mail
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    SELECT id INTO existing_id
    FROM public.leads
    WHERE workspace_id = NEW.workspace_id
      AND deleted_at IS NULL
      AND lower(email) = NEW.email
      AND id IS DISTINCT FROM NEW.id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um lead com o e-mail % neste workspace.', NEW.email
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Verifica duplicidade de telefone
  IF normalized_phone IS NOT NULL AND normalized_phone <> '' THEN
    SELECT id INTO existing_id
    FROM public.leads
    WHERE workspace_id = NEW.workspace_id
      AND deleted_at IS NULL
      AND regexp_replace(phone, '[^0-9]', '', 'g') = normalized_phone
      AND id IS DISTINCT FROM NEW.id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um lead com o telefone % neste workspace.', NEW.phone
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS leads_check_duplicate_trigger ON public.leads;
CREATE TRIGGER leads_check_duplicate_trigger
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_check_duplicate();