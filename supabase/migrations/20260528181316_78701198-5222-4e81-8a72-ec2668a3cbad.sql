
-- 1) Add assigned_user_id to business tables that don't have an assignee column
ALTER TABLE public.leads     ADD COLUMN IF NOT EXISTS assigned_user_id uuid;
ALTER TABLE public.contacts  ADD COLUMN IF NOT EXISTS assigned_user_id uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS assigned_user_id uuid;
ALTER TABLE public.deals     ADD COLUMN IF NOT EXISTS assigned_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_user     ON public.leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_user  ON public.contacts(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_assigned_user ON public.companies(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_user     ON public.deals(assigned_user_id);

-- 2) Trigger to set assigned_user_id from auth.uid() when missing
CREATE OR REPLACE FUNCTION public.set_assigned_user_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF (to_jsonb(NEW) ->> 'assigned_user_id') IS NULL AND v_uid IS NOT NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('assigned_user_id', v_uid));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_assigned_user_leads     ON public.leads;
DROP TRIGGER IF EXISTS trg_set_assigned_user_contacts  ON public.contacts;
DROP TRIGGER IF EXISTS trg_set_assigned_user_companies ON public.companies;
DROP TRIGGER IF EXISTS trg_set_assigned_user_deals     ON public.deals;
CREATE TRIGGER trg_set_assigned_user_leads     BEFORE INSERT ON public.leads     FOR EACH ROW EXECUTE FUNCTION public.set_assigned_user_on_insert();
CREATE TRIGGER trg_set_assigned_user_contacts  BEFORE INSERT ON public.contacts  FOR EACH ROW EXECUTE FUNCTION public.set_assigned_user_on_insert();
CREATE TRIGGER trg_set_assigned_user_companies BEFORE INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_assigned_user_on_insert();
CREATE TRIGGER trg_set_assigned_user_deals     BEFORE INSERT ON public.deals     FOR EACH ROW EXECUTE FUNCTION public.set_assigned_user_on_insert();

-- 3) Permission helper: returns the user's scope ('all'|'team'|'own'|null) for an object+action
CREATE OR REPLACE FUNCTION public.user_scope_for(_user uuid, _workspace uuid, _object text, _action text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile uuid;
  v_scope text;
BEGIN
  -- Workspace owner / platform admin → always 'all'
  IF _user = _workspace OR public.is_platform_admin(_user) THEN
    RETURN 'all';
  END IF;

  SELECT access_profile_id INTO v_profile
    FROM public.team_members
   WHERE workspace_owner_id = _workspace AND member_user_id = _user
   LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT CASE _action
           WHEN 'view'   THEN view_scope
           WHEN 'edit'   THEN edit_scope
           WHEN 'delete' THEN delete_scope
         END
    INTO v_scope
    FROM public.access_profile_permissions
   WHERE profile_id = v_profile AND object_key = _object
   LIMIT 1;

  RETURN v_scope;
END;
$$;

-- 4) Boolean check used in RLS policies
CREATE OR REPLACE FUNCTION public.user_can_act(_object text, _action text, _row_owner uuid, _row_assignee uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_scope text;
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;

  v_scope := public.user_scope_for(v_user, _row_owner, _object, _action);

  IF v_scope IS NULL THEN RETURN false; END IF;
  IF v_scope = 'all' THEN RETURN true; END IF;
  IF v_scope = 'team' THEN
    -- team = anyone in the same workspace (no separate team membership yet)
    RETURN public.is_workspace_member(_row_owner, v_user);
  END IF;
  IF v_scope = 'own' THEN
    RETURN _row_assignee IS NOT NULL AND _row_assignee = v_user;
  END IF;
  RETURN false;
END;
$$;

-- 5) Replace UPDATE/DELETE policies for business tables

-- leads
DROP POLICY IF EXISTS ws_update_leads ON public.leads;
DROP POLICY IF EXISTS ws_delete_leads ON public.leads;
CREATE POLICY ws_update_leads ON public.leads FOR UPDATE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('leads','edit', owner_id, assigned_user_id));
CREATE POLICY ws_delete_leads ON public.leads FOR DELETE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('leads','delete', owner_id, assigned_user_id));

-- contacts
DROP POLICY IF EXISTS ws_update_contacts ON public.contacts;
DROP POLICY IF EXISTS ws_delete_contacts ON public.contacts;
CREATE POLICY ws_update_contacts ON public.contacts FOR UPDATE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('contacts','edit', owner_id, assigned_user_id));
CREATE POLICY ws_delete_contacts ON public.contacts FOR DELETE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('contacts','delete', owner_id, assigned_user_id));

-- companies
DROP POLICY IF EXISTS ws_update_companies ON public.companies;
DROP POLICY IF EXISTS ws_delete_companies ON public.companies;
CREATE POLICY ws_update_companies ON public.companies FOR UPDATE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('companies','edit', owner_id, assigned_user_id));
CREATE POLICY ws_delete_companies ON public.companies FOR DELETE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('companies','delete', owner_id, assigned_user_id));

-- deals
DROP POLICY IF EXISTS ws_update_deals ON public.deals;
DROP POLICY IF EXISTS ws_delete_deals ON public.deals;
CREATE POLICY ws_update_deals ON public.deals FOR UPDATE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('deals','edit', owner_id, assigned_user_id));
CREATE POLICY ws_delete_deals ON public.deals FOR DELETE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('deals','delete', owner_id, assigned_user_id));

-- tickets (uses assignee_id instead of assigned_user_id)
DROP POLICY IF EXISTS ws_update_tickets ON public.tickets;
DROP POLICY IF EXISTS ws_delete_tickets ON public.tickets;
CREATE POLICY ws_update_tickets ON public.tickets FOR UPDATE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('tickets','edit', owner_id, assignee_id));
CREATE POLICY ws_delete_tickets ON public.tickets FOR DELETE
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_can_act('tickets','delete', owner_id, assignee_id));
