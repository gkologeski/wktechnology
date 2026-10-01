-- Conflito de carteira (decisão: liberar com aviso): ao criar um lead numa
-- empresa cujo responsável é outra pessoa, o responsável da empresa é avisado.
CREATE OR REPLACE FUNCTION public.notify_company_owner_on_foreign_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resp uuid;
  v_name text;
  v_creator uuid := coalesce(NEW.assigned_to, NEW.owner_id);
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(c.assigned_to, c.owner_id), c.name INTO v_resp, v_name
    FROM public.companies c WHERE c.id = NEW.company_id;
  IF v_resp IS NULL OR v_resp = v_creator OR v_resp = NEW.owner_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (owner_id, user_id, workspace_id, type, title, body, link, entity, entity_id)
  VALUES (v_resp, v_resp, NEW.workspace_id, 'portfolio_conflict',
          'Novo lead em empresa da sua carteira',
          'Outro vendedor criou um lead para ' || coalesce(v_name, 'uma empresa') || '.',
          '/leads/' || NEW.id, 'lead', NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- aviso nunca impede a criação do lead
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_portfolio_conflict ON public.leads;
CREATE TRIGGER trg_leads_portfolio_conflict
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_company_owner_on_foreign_lead();
