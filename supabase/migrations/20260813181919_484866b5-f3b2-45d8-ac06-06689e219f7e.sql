CREATE OR REPLACE FUNCTION public.user_can_act(_object text, _action text, _row_owner uuid, _row_assignee uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_scope text;
  v_act text;
  v_keys text[];
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;

  -- Dono do registro sempre pode agir sobre o próprio registro.
  IF _row_owner = v_user THEN RETURN true; END IF;
  IF public.is_platform_admin(v_user) THEN RETURN true; END IF;

  v_act := CASE _action
             WHEN 'view'   THEN 'view'
             WHEN 'edit'   THEN 'update'
             WHEN 'delete' THEN 'delete'
             ELSE _action
           END;

  -- RBAC atual: chaves efetivas do usuário em todos os workspaces dele.
  SELECT coalesce(array_agg(DISTINCT k), '{}')
    INTO v_keys
    FROM (
      SELECT w.id FROM public.workspaces w WHERE w.created_by = v_user
      UNION
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = v_user
    ) ws(id)
    CROSS JOIN LATERAL public.user_effective_permissions(v_user, ws.id) AS k;

  IF EXISTS (
    SELECT 1 FROM unnest(v_keys) x
     WHERE x LIKE '%.' || _object || '.' || v_act || '.workspace'
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_keys) x
     WHERE x LIKE '%.' || _object || '.' || v_act || '.team'
  ) AND public.is_workspace_member(_row_owner, v_user) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_keys) x
     WHERE x LIKE '%.' || _object || '.' || v_act || '.own'
  ) AND (_row_assignee IS NOT NULL AND _row_assignee = v_user) THEN
    RETURN true;
  END IF;

  -- Compatibilidade: perfis de acesso legados.
  v_scope := public.user_scope_for(v_user, _row_owner, _object, _action);
  IF v_scope IS NULL THEN RETURN false; END IF;
  IF v_scope = 'all' THEN RETURN true; END IF;
  IF v_scope = 'team' THEN
    RETURN public.is_workspace_member(_row_owner, v_user);
  END IF;
  IF v_scope = 'own' THEN
    RETURN (_row_assignee IS NOT NULL AND _row_assignee = v_user);
  END IF;
  RETURN false;
END;
$function$;