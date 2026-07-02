
-- Fase 3: enforcement de permissões
-- Helper: retorna o conjunto de permission_keys efetivas de um usuário em um workspace
CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Owner / admin do workspace: todas as permissões catalogadas
  SELECT p.key
    FROM public.permissions p
   WHERE EXISTS (
           SELECT 1 FROM public.workspaces w
            WHERE w.id = _workspace_id AND w.created_by = _user_id
         )
      OR EXISTS (
           SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = _workspace_id
              AND wm.user_id = _user_id
              AND wm.role IN ('owner','admin')
         )
  UNION
  -- Via cargo principal / extras
  SELECT psi.permission_key
    FROM public.user_job_roles ujr
    JOIN public.job_role_sets jrs ON jrs.role_id = ujr.role_id
    JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
   WHERE ujr.user_id = _user_id
     AND ujr.workspace_id = _workspace_id
  UNION
  -- Via pacotes extras atribuídos diretamente
  SELECT psi.permission_key
    FROM public.user_permission_sets ups
    JOIN public.permission_set_items psi ON psi.set_id = ups.set_id
   WHERE ups.user_id = _user_id
     AND ups.workspace_id = _workspace_id;
$$;

GRANT EXECUTE ON FUNCTION public.user_effective_permissions(uuid, uuid) TO authenticated, service_role;

-- Checagem pontual
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _workspace_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_effective_permissions(_user_id, _workspace_id) k
     WHERE k = _permission_key
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, uuid, text) TO authenticated, service_role;

-- Versão conveniência: usuário atual
CREATE OR REPLACE FUNCTION public.current_user_permissions(_workspace_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.user_effective_permissions(auth.uid(), _workspace_id);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_permissions(uuid) TO authenticated, service_role;
