-- 0122 — Fase 0 (foto + reversão) e Fase 1 (correções estruturais) da revisão de cargos WK.
-- Idempotente. Não apaga dados. Não altera pacotes/cargos globais. Provada no isolado (37/0).

CREATE TABLE IF NOT EXISTS public.rbac_wk_backup_2026_10 (
  id bigserial PRIMARY KEY,
  taken_at timestamptz NOT NULL DEFAULT now(),
  workspace_id uuid NOT NULL,
  source text NOT NULL,
  row_data jsonb NOT NULL
);
GRANT SELECT ON public.rbac_wk_backup_2026_10 TO authenticated;
GRANT ALL ON public.rbac_wk_backup_2026_10 TO service_role;
ALTER TABLE public.rbac_wk_backup_2026_10 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rbac_wk_backup_admin_read ON public.rbac_wk_backup_2026_10;
CREATE POLICY rbac_wk_backup_admin_read ON public.rbac_wk_backup_2026_10
  FOR SELECT TO authenticated USING (public.is_workspace_admin_of(workspace_id, auth.uid()));

DO $$
DECLARE wk constant uuid := '184b9435-0a9b-4334-9e89-8854dc883f5d';
BEGIN
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = wk)
     AND NOT EXISTS (SELECT 1 FROM public.rbac_wk_backup_2026_10 WHERE workspace_id = wk) THEN
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
      SELECT wk, 'job_role_permission_overrides', to_jsonb(o) FROM public.job_role_permission_overrides o WHERE o.workspace_id = wk;
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
      SELECT wk, 'job_roles', to_jsonb(r) FROM public.job_roles r WHERE r.workspace_id = wk;
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
      SELECT wk, 'job_role_sets', to_jsonb(s) FROM public.job_role_sets s
       JOIN public.job_roles r ON r.id = s.role_id WHERE r.workspace_id = wk;
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
      SELECT wk, 'user_job_roles', to_jsonb(u) FROM public.user_job_roles u WHERE u.workspace_id = wk OR u.owner_id = wk;
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
      SELECT wk, 'user_permission_sets', to_jsonb(u) FROM public.user_permission_sets u WHERE u.owner_id = wk;
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
      SELECT wk, 'function:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
             jsonb_build_object('def', pg_get_functiondef(p.oid))
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN
         ('user_effective_permissions','role_profile_resolve_leader','role_profile_leader_decide','role_profile_approve');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rbac_wk_restore_overrides_2026_10()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wk constant uuid := '184b9435-0a9b-4334-9e89-8854dc883f5d'; n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rbac_wk_backup_2026_10 WHERE workspace_id = wk) THEN
    RAISE EXCEPTION 'Foto de backup ausente';
  END IF;
  DELETE FROM public.job_role_permission_overrides WHERE workspace_id = wk;
  INSERT INTO public.job_role_permission_overrides
    SELECT (jsonb_populate_record(NULL::public.job_role_permission_overrides, b.row_data)).*
      FROM public.rbac_wk_backup_2026_10 b
     WHERE b.workspace_id = wk AND b.source = 'job_role_permission_overrides';
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.access_audit_log(workspace_id, action, entity_type, details)
    VALUES (wk, 'rbac_restore', 'job_role_permission_overrides', jsonb_build_object('restored', n));
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.rbac_wk_restore_overrides_2026_10() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_wk_restore_overrides_2026_10() TO service_role;

CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)
 RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH active_member AS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id AND wm.status = 'active'
  ), ws AS (
    SELECT w.id, w.created_by FROM public.workspaces w WHERE w.id = _workspace_id
  ), base_permissions AS (
    SELECT p.key
      FROM public.permissions p
     WHERE EXISTS (SELECT 1 FROM ws WHERE ws.created_by = _user_id)
        OR EXISTS (
             SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id
                AND wm.role IN ('owner','admin') AND wm.status = 'active')
    UNION
    SELECT psi.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_sets jrs ON jrs.role_id = ujr.role_id
      JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
     WHERE ujr.user_id = _user_id
       AND (ujr.owner_id = _workspace_id OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
    UNION
    SELECT psi.permission_key AS key
      FROM public.user_permission_sets ups
      JOIN public.permission_set_items psi ON psi.set_id = ups.set_id
     WHERE ups.user_id = _user_id
       AND (ups.owner_id = _workspace_id OR ups.owner_id = (SELECT created_by FROM ws))
  ), role_grants AS (
    SELECT o.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.owner_id = _workspace_id OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
       AND o.workspace_id = _workspace_id AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.owner_id = _workspace_id OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
       AND o.workspace_id = _workspace_id AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (SELECT key FROM base_permissions UNION SELECT key FROM role_grants) effective
   WHERE EXISTS (SELECT 1 FROM active_member)
     AND NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$;

DROP POLICY IF EXISTS job_roles_admin_write_ins ON public.job_roles;
DROP POLICY IF EXISTS job_roles_admin_write_upd ON public.job_roles;
DROP POLICY IF EXISTS job_roles_admin_write_del ON public.job_roles;
CREATE POLICY job_roles_admin_write_ins ON public.job_roles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid())
              OR (workspace_id IS NOT NULL AND public.is_workspace_admin_of(workspace_id, auth.uid())));
CREATE POLICY job_roles_admin_write_upd ON public.job_roles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid())
         OR (workspace_id IS NOT NULL AND public.is_workspace_admin_of(workspace_id, auth.uid())))
  WITH CHECK (public.is_platform_admin(auth.uid())
              OR (workspace_id IS NOT NULL AND public.is_workspace_admin_of(workspace_id, auth.uid())));
CREATE POLICY job_roles_admin_write_del ON public.job_roles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid())
         OR (workspace_id IS NOT NULL AND public.is_workspace_admin_of(workspace_id, auth.uid())));

CREATE OR REPLACE FUNCTION public.job_roles_guard_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND COALESCE(NEW.is_system, false) THEN
    RAISE EXCEPTION 'Somente a plataforma cria cargos de sistema' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.is_system IS DISTINCT FROM OLD.is_system
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    RAISE EXCEPTION 'Não é permitido alterar sistema, dono ou workspace do cargo' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_job_roles_guard_identity ON public.job_roles;
CREATE TRIGGER trg_job_roles_guard_identity BEFORE INSERT OR UPDATE ON public.job_roles
  FOR EACH ROW EXECUTE FUNCTION public.job_roles_guard_identity();

CREATE OR REPLACE FUNCTION public.role_profile_resolve_leader(_deal uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d record; v_owner uuid; v_groups jsonb; v_group_ids uuid[]; v_leaders uuid[];
BEGIN
  SELECT id, workspace_id, assigned_to, owner_id INTO d FROM public.deals WHERE id = _deal AND deleted_at IS NULL;
  IF NOT FOUND OR NOT public.is_workspace_member(d.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Negócio não encontrado ou sem acesso' USING ERRCODE = '42501';
  END IF;
  v_owner := COALESCE(d.assigned_to, d.owner_id);
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('status','no_owner','owner_id',NULL,'groups','[]'::jsonb,'leader_ids','[]'::jsonb);
  END IF;
  SELECT COALESCE(array_agg(g.id), '{}'), COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) ORDER BY g.name), '[]'::jsonb)
    INTO v_group_ids, v_groups
    FROM public.user_groups g JOIN public.user_group_members m ON m.group_id = g.id
   WHERE g.workspace_id = d.workspace_id AND m.user_id = v_owner;
  IF cardinality(v_group_ids) = 0 THEN
    RETURN jsonb_build_object('status','no_team','owner_id',v_owner,'groups',v_groups,'leader_ids','[]'::jsonb);
  END IF;
  SELECT COALESCE(array_agg(DISTINCT l.user_id), '{}') INTO v_leaders
    FROM public.user_group_members l
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = l.user_id
   WHERE l.group_id = ANY(v_group_ids) AND l.is_leader AND wm.status = 'active';
  RETURN jsonb_build_object(
    'status', CASE WHEN cardinality(v_leaders) = 0 THEN 'no_leader' WHEN cardinality(v_leaders) > 1 THEN 'ambiguous' ELSE 'ok' END,
    'owner_id', v_owner, 'groups', v_groups, 'group_ids', to_jsonb(v_group_ids),
    'leader_ids', to_jsonb(v_leaders),
    'leader_id', CASE WHEN cardinality(v_leaders) = 1 THEN v_leaders[1] END);
END $function$;

CREATE OR REPLACE FUNCTION public.role_profile_leader_decide(_item uuid, _decision text, _comment text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE it public.role_profile_approval_items; rq public.role_profile_approval_requests; p public.deal_role_profiles;
        r jsonb; v_id uuid; v_num int; v_to text;
BEGIN
  IF _decision NOT IN ('approve','request_changes') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
  SELECT * INTO it FROM public.role_profile_approval_items WHERE id = _item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO rq FROM public.role_profile_approval_requests WHERE id = it.request_id;
  IF rq.approver_id <> auth.uid() THEN RAISE EXCEPTION 'PERMISSION_DENIED: somente o líder designado decide' USING ERRCODE = '42501'; END IF;
  r := public.role_profile_resolve_leader(rq.deal_id);
  IF r->>'status' <> 'ok' OR (r->>'leader_id')::uuid <> auth.uid() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: você não é mais o líder da equipe deste negócio' USING ERRCODE = '42501';
  END IF;
  IF NOT public.role_profile_can(rq.workspace_id, 'techsales.role_profiles.view.workspace') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles.view.workspace' USING ERRCODE = '42501';
  END IF;
  IF _decision = 'approve' AND NOT public.role_profile_can(rq.workspace_id, 'techsales.role_profiles.approve.workspace') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles.approve.workspace' USING ERRCODE = '42501';
  END IF;
  IF it.status <> 'pending' THEN RAISE EXCEPTION 'ITEM_NOT_PENDING: %', it.status; END IF;
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = it.profile_id FOR UPDATE;
  IF p.revision <> it.profile_revision OR p.status <> 'in_validation' THEN
    UPDATE public.role_profile_approval_items SET status = 'superseded' WHERE id = it.id;
    RETURN jsonb_build_object('status','superseded');
  END IF;
  IF _decision = 'approve' THEN
    v_num := p.last_version + 1;
    v_to := CASE WHEN p.ats_job_id IS NOT NULL THEN 'forwarded' ELSE 'approved' END;
    INSERT INTO public.deal_role_profile_versions(profile_id, workspace_id, version, snapshot, approved_by)
      VALUES (p.id, p.workspace_id, v_num,
              jsonb_build_object('title',p.title,'quantity',p.quantity,'modality',p.modality,'priority',p.priority,
                                 'seniority',p.seniority,'contact_id',p.contact_id,'data',p.data),
              auth.uid())
      RETURNING id INTO v_id;
    UPDATE public.deal_role_profiles SET status = v_to, approved_version_id = v_id, last_version = v_num,
           revision = revision + 1, updated_at = now() WHERE id = p.id;
    UPDATE public.role_profile_approval_items SET status = 'approved', version = v_num, decided_by = auth.uid(),
           decided_at = now(), comment = left(_comment, 1000) WHERE id = it.id;
    INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, version, actor_id, details)
      VALUES (p.id, p.workspace_id, 'approved', p.status, v_to, v_num, auth.uid(), jsonb_build_object('request_id', rq.id, 'via', 'leader'));
  ELSE
    IF coalesce(btrim(_comment),'') = '' THEN RAISE EXCEPTION 'Descreva os ajustes necessários'; END IF;
    UPDATE public.deal_role_profiles SET status = 'awaiting_info', revision = revision + 1, updated_at = now() WHERE id = p.id;
    UPDATE public.role_profile_approval_items SET status = 'changes_requested', decided_by = auth.uid(),
           decided_at = now(), comment = left(_comment, 1000) WHERE id = it.id;
    INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, actor_id, reason, details)
      VALUES (p.id, p.workspace_id, 'changes_requested', p.status, 'awaiting_info', auth.uid(), left(_comment, 500), jsonb_build_object('request_id', rq.id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_profile_approval_items WHERE request_id = rq.id AND status = 'pending') THEN
    UPDATE public.role_profile_approval_requests SET status = 'decided', decided_at = now() WHERE id = rq.id;
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN _decision = 'approve' THEN 'approved' ELSE 'changes_requested' END,
                            'version', v_num, 'version_id', v_id);
END $function$;

CREATE OR REPLACE FUNCTION public.role_profile_approve(_profile uuid, _expected_revision integer, _snapshot jsonb, _commercial jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.deal_role_profiles; v_item uuid; r jsonb;
BEGIN
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = _profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = 'P0002'; END IF;
  IF p.revision <> _expected_revision THEN
    RAISE EXCEPTION 'STALE_REVISION: o perfil foi alterado (revisão %); recarregue antes de aprovar', p.revision USING ERRCODE = '40001';
  END IF;
  SELECT it.id INTO v_item
    FROM public.role_profile_approval_items it
    JOIN public.role_profile_approval_requests rq ON rq.id = it.request_id
   WHERE it.profile_id = p.id AND it.status = 'pending' AND rq.approver_id = auth.uid()
   ORDER BY it.created_at DESC LIMIT 1;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'LEADER_REQUIRED: a aprovação é feita pelo líder da equipe do negócio. Use "Solicitar validação" ou o override administrativo com motivo.' USING ERRCODE = '42501';
  END IF;
  r := public.role_profile_leader_decide(v_item, 'approve', '');
  IF r->>'status' = 'superseded' THEN
    RAISE EXCEPTION 'STALE_REVISION: o perfil foi editado depois da solicitação; peça nova validação' USING ERRCODE = '40001';
  END IF;
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.role_profile_admin_override_approve(_profile uuid, _expected_revision integer, _reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.deal_role_profiles; v_id uuid; v_num int; v_to text;
BEGIN
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = _profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = 'P0002'; END IF;
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p.workspace_id, auth.uid())
     OR NOT public.is_workspace_admin_of(p.workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: somente administrador do workspace' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(_reason,''))) < 10 THEN
    RAISE EXCEPTION 'Informe o motivo do override (mínimo 10 caracteres)';
  END IF;
  IF p.revision <> _expected_revision THEN
    RAISE EXCEPTION 'STALE_REVISION: o perfil foi alterado (revisão %); recarregue antes de aprovar', p.revision USING ERRCODE = '40001';
  END IF;
  IF p.status NOT IN ('in_validation','awaiting_info','draft') THEN
    RAISE EXCEPTION 'Status % não permite aprovação', p.status;
  END IF;
  v_num := p.last_version + 1;
  v_to := CASE WHEN p.ats_job_id IS NOT NULL THEN 'forwarded' ELSE 'approved' END;
  INSERT INTO public.deal_role_profile_versions(profile_id, workspace_id, version, snapshot, approved_by)
    VALUES (p.id, p.workspace_id, v_num,
            jsonb_build_object('title',p.title,'quantity',p.quantity,'modality',p.modality,'priority',p.priority,
                               'seniority',p.seniority,'contact_id',p.contact_id,'data',p.data),
            auth.uid())
    RETURNING id INTO v_id;
  UPDATE public.deal_role_profiles SET status = v_to, approved_version_id = v_id, last_version = v_num,
         revision = revision + 1, updated_at = now() WHERE id = p.id;
  UPDATE public.role_profile_approval_items SET status = 'superseded'
   WHERE profile_id = p.id AND status = 'pending';
  INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, version, actor_id, reason, details)
    VALUES (p.id, p.workspace_id, 'approved', p.status, v_to, v_num, auth.uid(), left(_reason, 500),
            jsonb_build_object('via', 'admin_override'));
  INSERT INTO public.access_audit_log(workspace_id, actor_id, action, entity_type, entity_id, details)
    VALUES (p.workspace_id, auth.uid(), 'role_profile_admin_override', 'deal_role_profile', p.id,
            jsonb_build_object('reason', left(_reason, 500), 'version', v_num));
  RETURN jsonb_build_object('status','approved','version_id', v_id, 'version', v_num);
END $function$;
REVOKE ALL ON FUNCTION public.role_profile_admin_override_approve(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_admin_override_approve(uuid, integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_perm_workspaces(_key text)
 RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT wm.workspace_id FROM public.workspace_members wm
   WHERE wm.user_id = auth.uid() AND wm.status = 'active'
     AND public.user_has_permission(auth.uid(), wm.workspace_id, _key)
$$;
REVOKE ALL ON FUNCTION public.my_perm_workspaces(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_perm_workspaces(text) TO authenticated, service_role;

DROP POLICY IF EXISTS chat_scope_select_live_chat_sessions ON public.live_chat_sessions;
CREATE POLICY chat_scope_select_live_chat_sessions ON public.live_chat_sessions AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.workspace'))
  OR (workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.team'))
      AND (assignee_id IS NULL OR assignee_id = auth.uid() OR assignee_id IN (SELECT public.my_team_member_ids())))
  OR (workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.own'))
      AND assignee_id = auth.uid())
);
DROP POLICY IF EXISTS chat_scope_update_live_chat_sessions ON public.live_chat_sessions;
CREATE POLICY chat_scope_update_live_chat_sessions ON public.live_chat_sessions AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.update.workspace'))
  OR (workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.update.team'))
      AND (assignee_id IS NULL OR assignee_id = auth.uid() OR assignee_id IN (SELECT public.my_team_member_ids())))
  OR (workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.update.own'))
      AND assignee_id = auth.uid())
);

DROP POLICY IF EXISTS chat_scope_select_live_chat_messages ON public.live_chat_messages;
CREATE POLICY chat_scope_select_live_chat_messages ON public.live_chat_messages AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.live_chat_sessions s WHERE s.id = live_chat_messages.session_id)
);
DROP POLICY IF EXISTS chat_scope_insert_live_chat_messages ON public.live_chat_messages;
CREATE POLICY chat_scope_insert_live_chat_messages ON public.live_chat_messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (direction = 'outbound' AND author_user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.live_chat_sessions s
                   WHERE s.id = live_chat_messages.session_id
                     AND s.workspace_id = live_chat_messages.workspace_id
                     AND (s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.create.workspace'))
                          OR (s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.create.own'))
                              AND s.assignee_id = auth.uid()))))
);
