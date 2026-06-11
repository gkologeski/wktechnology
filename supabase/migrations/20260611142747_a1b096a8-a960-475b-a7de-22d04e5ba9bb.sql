-- Reconciliar convite aceito de sabrina@wktechnology.com.br que confirmou email/login
-- mas não passou pelo fluxo completeInviteProfile, ficando sem workspace_members.

DO $$
DECLARE
  v_user_id uuid;
  v_inv RECORD;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'sabrina@wktechnology.com.br';
  IF v_user_id IS NULL THEN RETURN; END IF;

  FOR v_inv IN
    SELECT id, workspace_id, role, expires_at
      FROM public.workspace_invites
     WHERE lower(email) = 'sabrina@wktechnology.com.br'
       AND accepted_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
  LOOP
    INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
    VALUES (v_inv.workspace_id, v_user_id, v_inv.role, NULL)
    ON CONFLICT DO NOTHING;

    UPDATE public.workspace_invites SET accepted_at = now() WHERE id = v_inv.id;

    DELETE FROM public.user_roles
     WHERE workspace_owner_id = v_inv.workspace_id AND user_id = v_user_id;
    INSERT INTO public.user_roles (workspace_owner_id, user_id, role)
    VALUES (v_inv.workspace_id, v_user_id, v_inv.role::app_role)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- active_workspace_id
  UPDATE public.profiles p
     SET active_workspace_id = COALESCE(
       p.active_workspace_id,
       (SELECT workspace_id FROM public.workspace_members WHERE user_id = v_user_id ORDER BY joined_at LIMIT 1)
     )
   WHERE p.id = v_user_id;
END $$;