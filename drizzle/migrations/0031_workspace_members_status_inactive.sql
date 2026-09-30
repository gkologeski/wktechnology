ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE OR REPLACE FUNCTION public.workspace_members_validate_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('active','inactive') THEN
    RAISE EXCEPTION 'Situação de membro inválida: %', NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_workspace_members_validate_status ON public.workspace_members;
CREATE TRIGGER trg_workspace_members_validate_status
BEFORE INSERT OR UPDATE OF status ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.workspace_members_validate_status();

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace uuid, _user uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
     WHERE m.workspace_id = _workspace AND m.user_id = _user
       AND m.status = 'active'
       AND COALESCE(w.status, 'active') <> 'deleted')
$function$;

CREATE OR REPLACE FUNCTION public.current_user_workspaces()
 RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_active uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT active_workspace_id INTO v_active FROM public.profiles WHERE id = v_uid;
  IF v_active IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_active AND user_id = v_uid AND status = 'active'
  ) THEN
    RETURN QUERY SELECT v_active;
    RETURN;
  END IF;
  RETURN QUERY SELECT workspace_id FROM public.workspace_members WHERE user_id = v_uid AND status = 'active';
END;
$function$;