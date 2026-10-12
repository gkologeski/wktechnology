-- Lista efetiva completa (array, sem o corte de 1.000 linhas da API) para o painel de permissões.
-- Só owner/admin ativo do workspace consulta outra pessoa; a pessoa pode consultar a si mesma.
CREATE OR REPLACE FUNCTION public.effective_permissions_array(_user_id uuid, _workspace_id uuid)
 RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501'; END IF;
  IF auth.uid() <> _user_id AND NOT public.is_workspace_admin_of(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;
  RETURN ARRAY(SELECT k FROM public.user_effective_permissions(_user_id, _workspace_id) k ORDER BY k);
END $$;
REVOKE ALL ON FUNCTION public.effective_permissions_array(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_permissions_array(uuid, uuid) TO authenticated, service_role;
