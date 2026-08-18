-- 1) Coluna workspace_id + backfill + índices
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.people_events ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.people_psychosocial_assessments ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.people SET workspace_id = owner_id WHERE workspace_id IS NULL;
UPDATE public.people_events e SET workspace_id = COALESCE(e.owner_id, (SELECT p.workspace_id FROM public.people p WHERE p.id = e.person_id)) WHERE e.workspace_id IS NULL;
UPDATE public.people_psychosocial_assessments a SET workspace_id = COALESCE(a.owner_id, (SELECT p.workspace_id FROM public.people p WHERE p.id = a.person_id)) WHERE a.workspace_id IS NULL;

-- registros órfãos (sem workspace válido) não existem hoje; garante integridade
DELETE FROM public.people_events WHERE workspace_id IS NULL;
DELETE FROM public.people_psychosocial_assessments WHERE workspace_id IS NULL;

ALTER TABLE public.people ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.people_events ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.people_psychosocial_assessments ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_workspace ON public.people(workspace_id);
CREATE INDEX IF NOT EXISTS idx_people_events_workspace ON public.people_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_people_psych_workspace ON public.people_psychosocial_assessments(workspace_id);

-- 2) Triggers de sincronização workspace_id <-> owner_id
CREATE OR REPLACE FUNCTION public.people_sync_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN NEW.workspace_id := NEW.owner_id; END IF;
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.workspace_id; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.people_child_sync_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ws uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    IF NEW.owner_id IS NOT NULL THEN
      NEW.workspace_id := NEW.owner_id;
    ELSIF NEW.person_id IS NOT NULL THEN
      SELECT p.workspace_id INTO v_ws FROM public.people p WHERE p.id = NEW.person_id;
      NEW.workspace_id := v_ws;
    END IF;
  END IF;
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.workspace_id; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_people_sync_workspace ON public.people;
CREATE TRIGGER trg_people_sync_workspace BEFORE INSERT OR UPDATE ON public.people
FOR EACH ROW EXECUTE FUNCTION public.people_sync_workspace_id();

DROP TRIGGER IF EXISTS trg_people_events_sync_workspace ON public.people_events;
CREATE TRIGGER trg_people_events_sync_workspace BEFORE INSERT OR UPDATE ON public.people_events
FOR EACH ROW EXECUTE FUNCTION public.people_child_sync_workspace_id();

DROP TRIGGER IF EXISTS trg_people_psych_sync_workspace ON public.people_psychosocial_assessments;
CREATE TRIGGER trg_people_psych_sync_workspace BEFORE INSERT OR UPDATE ON public.people_psychosocial_assessments
FOR EACH ROW EXECUTE FUNCTION public.people_child_sync_workspace_id();

-- 3) Funções auxiliares baseadas em workspace_id
CREATE OR REPLACE FUNCTION public.can_view_person(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.id = _person_id
      AND (
        public.is_platform_admin(auth.uid())
        OR (
          p.workspace_id IN (SELECT public.current_user_workspaces())
          AND (
            public.is_workspace_admin_v2(p.workspace_id, auth.uid())
            OR p.manager_id = auth.uid()
            OR p.profile_id = auth.uid()
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.people.view.workspace')
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.people.view.team')
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_person(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.id = _person_id
      AND (
        public.is_platform_admin(auth.uid())
        OR (
          p.workspace_id IN (SELECT public.current_user_workspaces())
          AND (
            public.is_workspace_admin_v2(p.workspace_id, auth.uid())
            OR p.profile_id = auth.uid()
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.wellbeing.assessments.manage.workspace')
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.wellbeing.assessments.update.workspace')
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.wellbeing.incidents.manage.workspace')
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.wellbeing.incidents.update.workspace')
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_person_sensitive(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.people p
    WHERE p.id = _person_id
      AND (
        public.is_platform_admin(auth.uid())
        OR (
          p.workspace_id IN (SELECT public.current_user_workspaces())
          AND (
            public.is_workspace_admin_v2(p.workspace_id, auth.uid())
            OR p.profile_id = auth.uid()
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.wellbeing.assessments.view.workspace')
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.wellbeing.incidents.view.workspace')
            OR public.user_has_permission(auth.uid(), p.workspace_id, 'techpeople.benefits.view.workspace')
          )
        )
      )
  );
$$;

-- 4) Políticas padronizadas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_psychosocial_assessments TO authenticated;
GRANT ALL ON public.people TO service_role;
GRANT ALL ON public.people_events TO service_role;
GRANT ALL ON public.people_psychosocial_assessments TO service_role;

DROP POLICY IF EXISTS people_select ON public.people;
DROP POLICY IF EXISTS people_insert ON public.people;
DROP POLICY IF EXISTS people_update ON public.people;
DROP POLICY IF EXISTS people_delete ON public.people;
DROP POLICY IF EXISTS people_perm_select ON public.people;
DROP POLICY IF EXISTS people_perm_insert ON public.people;
DROP POLICY IF EXISTS people_perm_update ON public.people;
DROP POLICY IF EXISTS people_perm_delete ON public.people;

CREATE POLICY people_ws_select ON public.people FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR manager_id = auth.uid()
      OR profile_id = auth.uid()
      OR public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.view.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.view.team')
    )
  )
);

CREATE POLICY people_ws_insert ON public.people FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.create.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.create.own')
    )
  )
);

CREATE POLICY people_ws_update ON public.people FOR UPDATE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.update.workspace')
      OR (manager_id = auth.uid() AND public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.update.team'))
    )
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.update.workspace')
      OR (manager_id = auth.uid() AND public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.update.team'))
    )
  )
);

CREATE POLICY people_ws_delete ON public.people FOR DELETE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techpeople.people.delete.workspace')
    )
  )
);

DROP POLICY IF EXISTS people_events_select ON public.people_events;
DROP POLICY IF EXISTS people_events_write ON public.people_events;

CREATE POLICY people_events_ws_select ON public.people_events FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND public.can_view_person(person_id)
    AND (
      visible_to_person = true
      OR public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_events.person_id AND p.manager_id = auth.uid())
    )
  )
);

CREATE POLICY people_events_ws_write ON public.people_events FOR ALL TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND public.is_workspace_admin_v2(workspace_id, auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND public.is_workspace_admin_v2(workspace_id, auth.uid())
  )
);

DROP POLICY IF EXISTS psych_select_sensitive ON public.people_psychosocial_assessments;
DROP POLICY IF EXISTS psych_insert_manage ON public.people_psychosocial_assessments;
DROP POLICY IF EXISTS psych_update_manage ON public.people_psychosocial_assessments;
DROP POLICY IF EXISTS psych_delete_manage ON public.people_psychosocial_assessments;

CREATE POLICY psych_ws_select ON public.people_psychosocial_assessments FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (workspace_id IN (SELECT public.current_user_workspaces()) AND public.can_view_person_sensitive(person_id))
);

CREATE POLICY psych_ws_insert ON public.people_psychosocial_assessments FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (workspace_id IN (SELECT public.current_user_workspaces()) AND public.can_manage_person(person_id))
);

CREATE POLICY psych_ws_update ON public.people_psychosocial_assessments FOR UPDATE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (workspace_id IN (SELECT public.current_user_workspaces()) AND public.can_manage_person(person_id))
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (workspace_id IN (SELECT public.current_user_workspaces()) AND public.can_manage_person(person_id))
);

CREATE POLICY psych_ws_delete ON public.people_psychosocial_assessments FOR DELETE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (workspace_id IN (SELECT public.current_user_workspaces()) AND public.can_manage_person(person_id))
);