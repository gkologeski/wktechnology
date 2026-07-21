
CREATE INDEX IF NOT EXISTS contracts_parent_contract_id_idx ON public.contracts(parent_contract_id) WHERE parent_contract_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_contract_parent_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  p_role public.contract_role;
  p_ws uuid;
  cursor_id uuid;
  hops int := 0;
BEGIN
  IF NEW.parent_contract_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_contract_id = NEW.id THEN
    RAISE EXCEPTION 'Um contrato não pode ser pai de si mesmo.';
  END IF;

  SELECT role, workspace_id INTO p_role, p_ws
  FROM public.contracts
  WHERE id = NEW.parent_contract_id;

  IF p_ws IS NULL THEN
    RAISE EXCEPTION 'Contrato pai não encontrado.';
  END IF;

  IF p_ws <> NEW.workspace_id THEN
    RAISE EXCEPTION 'Contrato pai pertence a outro workspace.';
  END IF;

  IF p_role <> 'provider' OR NEW.role <> 'client' THEN
    RAISE EXCEPTION 'Vínculo de outsourcing exige pai do tipo Prestação (provider) e filho do tipo Compra (client).';
  END IF;

  -- ciclo: subir a cadeia de pais e garantir que nunca alcança NEW.id
  cursor_id := NEW.parent_contract_id;
  WHILE cursor_id IS NOT NULL AND hops < 20 LOOP
    IF cursor_id = NEW.id THEN
      RAISE EXCEPTION 'Ciclo detectado no vínculo de contratos.';
    END IF;
    SELECT parent_contract_id INTO cursor_id FROM public.contracts WHERE id = cursor_id;
    hops := hops + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contract_parent_link ON public.contracts;
CREATE TRIGGER trg_validate_contract_parent_link
  BEFORE INSERT OR UPDATE OF parent_contract_id, role, workspace_id ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.validate_contract_parent_link();
