CREATE OR REPLACE FUNCTION public.current_user_permissions_json(_workspace_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(k.key), '[]'::jsonb)
    FROM public.user_effective_permissions(auth.uid(), _workspace_id) AS k(key);
$$;

REVOKE ALL ON FUNCTION public.current_user_permissions_json(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_permissions_json(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_permissions_json(uuid) TO service_role;