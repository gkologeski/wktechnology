-- Usado só pelo motor de workflows (service_role) para achar o usuário de uma pessoa pelo e-mail.
CREATE OR REPLACE FUNCTION public.workspace_member_by_email(_workspace_id uuid, _email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT wm.user_id FROM public.workspace_members wm
  JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = _workspace_id AND lower(u.email) = lower(trim(_email))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.workspace_member_by_email(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_member_by_email(uuid, text) TO service_role;