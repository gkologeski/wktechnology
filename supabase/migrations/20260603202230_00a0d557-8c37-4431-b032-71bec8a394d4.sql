
CREATE OR REPLACE FUNCTION public.current_user_workspaces()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_active uuid;
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT active_workspace_id INTO v_active FROM public.profiles WHERE id = v_uid;
  SELECT public.is_platform_admin(v_uid) INTO v_is_admin;

  IF v_active IS NOT NULL THEN
    -- Platform admin pode ter ativado um workspace do qual não é membro
    IF v_is_admin THEN
      RETURN QUERY SELECT v_active;
      RETURN;
    END IF;
    -- Usuário comum: só restringe se for membro do workspace ativo
    IF EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_active AND user_id = v_uid) THEN
      RETURN QUERY SELECT v_active;
      RETURN;
    END IF;
  END IF;

  -- Fallback: todos os workspaces dos quais é membro
  RETURN QUERY SELECT workspace_id FROM public.workspace_members WHERE user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.default_workspace_for_user(_user uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT active_workspace_id FROM public.profiles WHERE id = _user),
    (SELECT workspace_id FROM public.workspace_members
      WHERE user_id = _user ORDER BY joined_at ASC NULLS LAST LIMIT 1)
  );
$$;
