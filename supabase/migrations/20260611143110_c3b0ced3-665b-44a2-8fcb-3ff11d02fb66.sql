CREATE OR REPLACE FUNCTION public.consume_workspace_invites_on_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(NEW.email, ''));
  v_inv RECORD;
BEGIN
  IF v_email = '' THEN RETURN NEW; END IF;
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN
    -- já processado anteriormente; mesmo assim varremos convites novos pendentes
    NULL;
  END IF;

  FOR v_inv IN
    SELECT id, workspace_id, role
      FROM public.workspace_invites
     WHERE lower(email) = v_email
       AND accepted_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
  LOOP
    INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
    VALUES (v_inv.workspace_id, NEW.id, v_inv.role, NULL)
    ON CONFLICT DO NOTHING;

    UPDATE public.workspace_invites SET accepted_at = now() WHERE id = v_inv.id;

    DELETE FROM public.user_roles
      WHERE workspace_owner_id = v_inv.workspace_id AND user_id = NEW.id;
    BEGIN
      INSERT INTO public.user_roles (workspace_owner_id, user_id, role)
      VALUES (v_inv.workspace_id, NEW.id, v_inv.role::app_role);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  -- garante active_workspace_id
  UPDATE public.profiles p
     SET active_workspace_id = COALESCE(
       p.active_workspace_id,
       (SELECT workspace_id FROM public.workspace_members WHERE user_id = NEW.id ORDER BY joined_at LIMIT 1)
     )
   WHERE p.id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirm_consume_invites ON auth.users;
CREATE TRIGGER on_auth_user_confirm_consume_invites
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.consume_workspace_invites_on_confirm();