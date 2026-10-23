-- Corrige people_assigned_to_fkey no cadastro da WK.
-- people.owner_id mantém o workspace por compatibilidade histórica. O gatilho
-- compartilhado o copiava para assigned_to, que referencia auth.users, não tenants.
-- Executar após trg_sync_responsible, sem mudar esse gatilho dos demais módulos.
CREATE OR REPLACE FUNCTION public.wk_people_responsible_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid
     AND NEW.assigned_to = NEW.workspace_id THEN
    IF auth.uid() IS NOT NULL AND public.is_workspace_member(NEW.workspace_id, auth.uid()) THEN
      NEW.assigned_to := auth.uid();
    ELSIF NEW.created_by IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.created_by)
      AND public.is_workspace_member(NEW.workspace_id, NEW.created_by) THEN
      NEW.assigned_to := NEW.created_by;
    ELSE
      -- Importação sem ator: responsável opcional fica vazio. Não inventar usuário.
      NEW.assigned_to := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.wk_people_responsible_actor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_wk_people_responsible_actor ON public.people;
CREATE TRIGGER zz_wk_people_responsible_actor BEFORE INSERT ON public.people
FOR EACH ROW EXECUTE FUNCTION public.wk_people_responsible_actor();
