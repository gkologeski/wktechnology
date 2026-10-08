
REVOKE INSERT, UPDATE ON public.deal_role_profiles FROM authenticated;
GRANT INSERT (id, workspace_id, deal_id, company_id, contact_id, title, quantity, modality, priority, seniority, data, assigned_to, created_by)
  ON public.deal_role_profiles TO authenticated;
GRANT UPDATE (contact_id, title, quantity, modality, priority, seniority, status, data, revision, assigned_to, updated_at, archived_at)
  ON public.deal_role_profiles TO authenticated;
REVOKE UPDATE ON public.deal_role_profile_imports FROM authenticated;
GRANT UPDATE (status, error, result, profile_id, updated_at) ON public.deal_role_profile_imports TO authenticated;
REVOKE UPDATE ON public.deal_role_profile_templates FROM authenticated;
GRANT UPDATE (name, archived_at) ON public.deal_role_profile_templates TO authenticated;

-- Aprovação/encaminhamento só pelas funções do servidor (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.deal_role_profiles_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.revision <> 1 OR NEW.last_version <> 0 THEN
      RAISE EXCEPTION 'Perfil novo deve começar como rascunho' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'forwarded') THEN
    RAISE EXCEPTION 'Aprovar/encaminhar somente pelas ações próprias' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'forwarded' AND NEW.status NOT IN ('forwarded', 'in_validation') THEN
    RAISE EXCEPTION 'Perfil encaminhado só volta para validação' USING ERRCODE = '42501';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'STALE_REVISION' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER deal_role_profiles_guard BEFORE INSERT OR UPDATE ON public.deal_role_profiles
  FOR EACH ROW EXECUTE FUNCTION public.deal_role_profiles_guard();
