\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'Only isolated database wk_head_rh_permission_test is allowed'; END IF; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE TABLE public.workspaces(id uuid PRIMARY KEY,created_by uuid,status text DEFAULT 'active');
CREATE TABLE public.workspace_members(workspace_id uuid,user_id uuid,role text,status text);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,active_workspace_id uuid);
CREATE TABLE public.job_roles(id uuid PRIMARY KEY,workspace_id uuid);
CREATE TABLE public.user_job_roles(user_id uuid,role_id uuid,workspace_id uuid,owner_id uuid);
CREATE TABLE public.permissions(key text PRIMARY KEY,module text);
CREATE TABLE public.job_role_permission_overrides(workspace_id uuid,role_id uuid,permission_key text REFERENCES permissions(key),effect text,created_by uuid,updated_at timestamptz DEFAULT now(),UNIQUE(workspace_id,role_id,permission_key));
CREATE TABLE public.permission_sets(id uuid PRIMARY KEY,workspace_id uuid,module text);
CREATE TABLE public.user_permission_sets(user_id uuid,set_id uuid,workspace_id uuid,owner_id uuid);
CREATE TABLE public.job_role_sets(role_id uuid,set_id uuid);
CREATE TABLE public.job_role_set_replacements(workspace_id uuid,role_id uuid,set_id uuid,replacement_set_id uuid);
CREATE TABLE public.permission_set_items(set_id uuid,permission_key text);
CREATE TABLE public.view_as_sessions(session_id uuid,mode text,ended_at timestamptz);
CREATE TABLE public.people(id uuid PRIMARY KEY,workspace_id uuid,profile_id uuid,manager_id uuid);
CREATE TABLE public.people_onboarding_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,person_id uuid,kind text DEFAULT 'onboarding',note text);
ALTER TABLE public.people_onboarding_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people_onboarding_plans TO authenticated;
CREATE TABLE public.people_onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,person_id uuid,kind text DEFAULT 'onboarding',note text, assignee_id uuid, plan_id uuid);
ALTER TABLE public.people_onboarding_tasks ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people_onboarding_tasks TO authenticated;
CREATE TABLE public.people_onboarding_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,person_id uuid,kind text DEFAULT 'onboarding',note text);
ALTER TABLE public.people_onboarding_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people_onboarding_templates TO authenticated;
CREATE TABLE public.people_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,person_id uuid,kind text DEFAULT 'onboarding',note text);
ALTER TABLE public.people_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people_documents TO authenticated;
CREATE TABLE public.people_benefits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,person_id uuid,kind text DEFAULT 'onboarding',note text);
ALTER TABLE public.people_benefits ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people_benefits TO authenticated;
CREATE TABLE public.people_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,person_id uuid,kind text DEFAULT 'onboarding',note text);
ALTER TABLE public.people_allocations ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people_allocations TO authenticated;
CREATE TABLE public.people_incidents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,person_id uuid,kind text DEFAULT 'onboarding',note text);
ALTER TABLE public.people_incidents ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people_incidents TO authenticated;
CREATE TABLE public.people_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,person_id uuid,kind text DEFAULT 'onboarding',note text);
ALTER TABLE public.people_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people_events TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
CREATE POLICY fixture_existing_read ON people_allocations FOR SELECT TO authenticated USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id=auth.uid()));
CREATE POLICY fixture_existing_read ON people_events FOR SELECT TO authenticated USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH active_member AS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id AND wm.status = 'active'
  ), ws AS (
    SELECT w.id, w.created_by FROM public.workspaces w WHERE w.id = _workspace_id
  ), my_roles AS (
    SELECT ujr.role_id
      FROM public.user_job_roles ujr
      LEFT JOIN public.job_roles jr ON jr.id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.workspace_id = _workspace_id OR ujr.owner_id = _workspace_id)
       AND (jr.id IS NULL OR jr.workspace_id IS NULL OR jr.workspace_id = _workspace_id)
  ), my_sets AS (
    SELECT ps.id AS set_id
      FROM public.user_permission_sets ups
      JOIN public.permission_sets ps ON ps.id = ups.set_id
     WHERE ups.user_id = _user_id
       AND (ups.workspace_id = _workspace_id OR ups.owner_id = _workspace_id)
       AND (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
    UNION
    SELECT ps.id
      FROM my_roles r
      JOIN public.job_role_sets jrs ON jrs.role_id = r.role_id
      LEFT JOIN public.job_role_set_replacements rep
        ON rep.workspace_id = _workspace_id AND rep.role_id = r.role_id AND rep.set_id = jrs.set_id
      JOIN public.permission_sets ps ON ps.id = COALESCE(rep.replacement_set_id, jrs.set_id)
     WHERE (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
       AND (rep.replacement_set_id IS NULL OR ps.workspace_id = _workspace_id)
  ), base_permissions AS (
    SELECT p.key FROM public.permissions p
     WHERE EXISTS (SELECT 1 FROM ws WHERE ws.created_by = _user_id)
        OR EXISTS (SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id
                AND wm.role IN ('owner','admin') AND wm.status = 'active')
    UNION
    SELECT psi.permission_key FROM my_sets s JOIN public.permission_set_items psi ON psi.set_id = s.set_id
  ), role_grants AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (SELECT key FROM base_permissions UNION SELECT key FROM role_grants) effective
   WHERE EXISTS (SELECT 1 FROM active_member)
     AND NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$
;
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace uuid, _user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
     WHERE m.workspace_id = _workspace
       AND m.user_id = _user
       AND m.role IN ('owner','admin')
       AND COALESCE(w.status, 'active') <> 'deleted'
  )
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE w.id = _workspace
       AND w.created_by = _user
       AND COALESCE(w.status, 'active') <> 'deleted'
  )
$function$
;
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace uuid, _user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
     WHERE m.workspace_id = _workspace AND m.user_id = _user
       AND m.status = 'active'
       AND COALESCE(w.status, 'active') <> 'deleted')
$function$
;
CREATE OR REPLACE FUNCTION public.user_has_permission(_user uuid, _perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user IS NULL OR _perm IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
        FROM public.profiles p
        JOIN public.workspace_members wm
          ON wm.workspace_id = p.active_workspace_id AND wm.user_id = _user AND wm.status = 'active'
       WHERE p.id = _user
         AND p.active_workspace_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.user_effective_permissions(_user, p.active_workspace_id) k WHERE k = _perm)
    )
  END;
$function$
;
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _workspace_id uuid, _permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_effective_permissions(_user_id, _workspace_id) k
     WHERE k = _permission_key
  );
$function$
;
CREATE FUNCTION public.is_workspace_admin_v2(_workspace uuid,_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_workspace_admin(_workspace,_user) $$;
CREATE FUNCTION public.is_read_only_view() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT COALESCE((SELECT EXISTS(SELECT 1 FROM view_as_sessions v WHERE v.session_id=NULLIF(auth.jwt()->>'session_id','')::uuid AND v.mode='role' AND v.ended_at IS NULL)),false) $$;
CREATE FUNCTION public.is_platform_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE SCHEMA techerp_api; CREATE TABLE techerp_api.subject_sessions(txid bigint,workspace_id uuid,user_id uuid);
CREATE OR REPLACE FUNCTION public.current_user_workspaces()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_active uuid;
  v_api uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF current_setting('app.api_subject', true) = 'on' THEN
    SELECT s.workspace_id INTO v_api FROM techerp_api.subject_sessions s
     WHERE s.txid = txid_current_if_assigned() AND s.user_id = v_uid;
    IF v_api IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.workspace_members
                  WHERE workspace_id = v_api AND user_id = v_uid AND status = 'active') THEN
        RETURN QUERY SELECT v_api;
      END IF;
      RETURN;
    END IF;
  END IF;
  SELECT active_workspace_id INTO v_active FROM public.profiles WHERE id = v_uid;
  IF v_active IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_active AND user_id = v_uid AND status = 'active'
  ) THEN
    RETURN QUERY SELECT v_active;
    RETURN;
  END IF;
  RETURN QUERY SELECT workspace_id FROM public.workspace_members WHERE user_id = v_uid AND status = 'active';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.can_view_person_sensitive(_person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_person(_person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE POLICY "people_alloc_perm_delete" ON public.people_allocations AS RESTRICTIVE FOR DELETE TO authenticated USING ((is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.allocations.delete.workspace'::text)));
CREATE POLICY "people_alloc_perm_select" ON public.people_allocations AS RESTRICTIVE FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.allocations.view.workspace'::text)));
CREATE POLICY "people_alloc_perm_update" ON public.people_allocations AS RESTRICTIVE FOR UPDATE TO authenticated USING ((is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.allocations.update.workspace'::text)));
CREATE POLICY "view_as_ro_del" ON public.people_allocations AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_ins" ON public.people_allocations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_upd" ON public.people_allocations AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "people_benefits_perm_delete" ON public.people_benefits AS RESTRICTIVE FOR DELETE TO authenticated USING ((is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.benefits.delete.workspace'::text)));
CREATE POLICY "people_benefits_perm_select" ON public.people_benefits AS RESTRICTIVE FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.benefits.view.workspace'::text)));
CREATE POLICY "people_benefits_perm_update" ON public.people_benefits AS RESTRICTIVE FOR UPDATE TO authenticated USING ((is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.benefits.update.workspace'::text)));
CREATE POLICY "view_as_ro_del" ON public.people_benefits AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_ins" ON public.people_benefits AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_upd" ON public.people_benefits AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "people_docs_perm_delete" ON public.people_documents AS RESTRICTIVE FOR DELETE TO authenticated USING ((is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.documents.delete.workspace'::text)));
CREATE POLICY "people_docs_perm_select" ON public.people_documents AS RESTRICTIVE FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.documents.view.workspace'::text)));
CREATE POLICY "people_docs_perm_update" ON public.people_documents AS RESTRICTIVE FOR UPDATE TO authenticated USING ((is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.documents.update.workspace'::text)));
CREATE POLICY "view_as_ro_del" ON public.people_documents AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_ins" ON public.people_documents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_upd" ON public.people_documents AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_del" ON public.people_events AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_ins" ON public.people_events AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_upd" ON public.people_events AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "people_incidents_perm_delete" ON public.people_incidents AS RESTRICTIVE FOR DELETE TO authenticated USING ((is_workspace_admin_v2(workspace_id, auth.uid()) OR user_has_permission(auth.uid(), workspace_id, 'techpeople.incidents.delete.workspace'::text)));
CREATE POLICY "people_incidents_select_gate" ON public.people_incidents AS RESTRICTIVE FOR SELECT TO authenticated USING ((((person_id IS NOT NULL) AND can_view_person_sensitive(person_id)) OR ((person_id IS NULL) AND is_workspace_admin_v2(workspace_id, auth.uid()))));
CREATE POLICY "people_incidents_update_gate" ON public.people_incidents AS RESTRICTIVE FOR UPDATE TO authenticated USING ((((person_id IS NOT NULL) AND can_manage_person(person_id)) OR ((person_id IS NULL) AND is_workspace_admin_v2(workspace_id, auth.uid())))) WITH CHECK ((((person_id IS NOT NULL) AND can_manage_person(person_id)) OR ((person_id IS NULL) AND is_workspace_admin_v2(workspace_id, auth.uid()))));
CREATE POLICY "view_as_ro_del" ON public.people_incidents AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_ins" ON public.people_incidents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_upd" ON public.people_incidents AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "onb_plans_ws_admin_write" ON public.people_onboarding_plans AS PERMISSIVE FOR ALL TO authenticated USING (is_workspace_admin(workspace_id, auth.uid())) WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));
CREATE POLICY "onb_plans_ws_read" ON public.people_onboarding_plans AS PERMISSIVE FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));
CREATE POLICY "view_as_ro_del" ON public.people_onboarding_plans AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_ins" ON public.people_onboarding_plans AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_upd" ON public.people_onboarding_plans AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "onb_tasks_assignee_update" ON public.people_onboarding_tasks AS PERMISSIVE FOR UPDATE TO authenticated USING ((assignee_id = auth.uid())) WITH CHECK ((assignee_id = auth.uid()));
CREATE POLICY "onb_tasks_ws_admin_write" ON public.people_onboarding_tasks AS PERMISSIVE FOR ALL TO authenticated USING (is_workspace_admin(workspace_id, auth.uid())) WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));
CREATE POLICY "onb_tasks_ws_read" ON public.people_onboarding_tasks AS PERMISSIVE FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));
CREATE POLICY "view_as_ro_del" ON public.people_onboarding_tasks AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_ins" ON public.people_onboarding_tasks AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_upd" ON public.people_onboarding_tasks AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "onb_templates_workspace_admin_manage" ON public.people_onboarding_templates AS PERMISSIVE FOR ALL TO authenticated USING (((workspace_id IS NOT NULL) AND is_workspace_admin_v2(workspace_id, auth.uid()))) WITH CHECK (((workspace_id IS NOT NULL) AND is_workspace_admin_v2(workspace_id, auth.uid())));
CREATE POLICY "onb_tpl_ws_admin_write" ON public.people_onboarding_templates AS PERMISSIVE FOR ALL TO authenticated USING (is_workspace_admin(workspace_id, auth.uid())) WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));
CREATE POLICY "onb_tpl_ws_read" ON public.people_onboarding_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((workspace_id IN ( SELECT workspace_members.workspace_id
   FROM workspace_members
  WHERE (workspace_members.user_id = auth.uid()))));
CREATE POLICY "view_as_ro_del" ON public.people_onboarding_templates AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_ins" ON public.people_onboarding_templates AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT is_read_only_view()));
CREATE POLICY "view_as_ro_upd" ON public.people_onboarding_templates AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT is_read_only_view()));
INSERT INTO workspaces VALUES ('184b9435-0a9b-4334-9e89-8854dc883f5d','1c237fbe-079e-4eb9-a3e6-c08d85e79688','active'),('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000004','active');
INSERT INTO workspace_members VALUES ('184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','member','active'),('184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','member','active'),('184b9435-0a9b-4334-9e89-8854dc883f5d','1c237fbe-079e-4eb9-a3e6-c08d85e79688','admin','active'),('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','member','active');
INSERT INTO profiles VALUES ('90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d'),('90000000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d');
INSERT INTO job_roles VALUES ('aaaaaaaa-0000-4000-8000-000000000004',NULL);
INSERT INTO user_job_roles VALUES ('90000000-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d','184b9435-0a9b-4334-9e89-8854dc883f5d'),('90000000-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002');
INSERT INTO people(id,workspace_id) VALUES ('90000000-0000-4000-8000-000000000005','184b9435-0a9b-4334-9e89-8854dc883f5d'),('90000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000002');
INSERT INTO permissions VALUES ('techpeople.wellbeing.assessments.update.workspace','techpeople'); INSERT INTO permissions SELECT 'techpeople.'||res||'.'||act||'.workspace','techpeople' FROM unnest(ARRAY['onboarding','offboarding','onboarding_templates','documents','benefits','allocations','incidents','people']) res CROSS JOIN unnest(ARRAY['view','create','update','delete']) act;
INSERT INTO permissions VALUES ('techhire.jobs.view.workspace','techhire');
INSERT INTO people_documents(id,person_id,owner_id,workspace_id,note) VALUES ('90000000-0000-4000-8000-000000000020','90000000-0000-4000-8000-000000000005','1c237fbe-079e-4eb9-a3e6-c08d85e79688',NULL,'legacy');
INSERT INTO people_benefits(id,person_id,owner_id,workspace_id,note) VALUES ('90000000-0000-4000-8000-000000000021','90000000-0000-4000-8000-000000000005','1c237fbe-079e-4eb9-a3e6-c08d85e79688',NULL,'legacy');
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
DO $$ BEGIN BEGIN INSERT INTO people_onboarding_plans(workspace_id,owner_id,person_id) VALUES ('184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000005'); RAISE EXCEPTION 'Expected baseline RLS denial'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS baseline onboarding INSERT denied'; END; END $$; RESET ROLE;
