-- Fase 4 RBAC WK: fecha brechas apontadas pela prova independente (SDK/GoTrue).
-- 1) Pacotes de permissão locais não podem ser globais (workspace_id NULL) nem
--    criados/alterados por quem não é admin do workspace.
-- 2) Vínculo cargo<->pacote (ACL) exige admin do workspace do pacote.
-- 3) Mensagens de chat: leitura/envio só nas sessões realmente visíveis.
-- 4) Perfis de vaga: líder/override precisam enxergar o negócio pelo escopo real.
-- 5) Apontador: 12 chaves materializadas em pacote local da WK.

DROP POLICY IF EXISTS psets_write_admin_ins ON public.permission_sets;
CREATE POLICY psets_write_admin_ins ON public.permission_sets
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IS NOT NULL AND public.is_workspace_admin_of(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS psets_write_admin_upd ON public.permission_sets;
CREATE POLICY psets_write_admin_upd ON public.permission_sets
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IS NOT NULL AND public.is_workspace_admin_of(workspace_id, auth.uid()))
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IS NOT NULL AND public.is_workspace_admin_of(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS psets_write_admin_del ON public.permission_sets;
CREATE POLICY psets_write_admin_del ON public.permission_sets
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IS NOT NULL AND public.is_workspace_admin_of(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS psi_write_admin ON public.permission_set_items;
CREATE POLICY psi_write_admin ON public.permission_set_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.permission_sets s
       WHERE s.id = permission_set_items.set_id
         AND s.workspace_id IS NOT NULL
         AND public.is_workspace_admin_of(s.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.permission_sets s
       WHERE s.id = permission_set_items.set_id
         AND s.workspace_id IS NOT NULL
         AND public.is_workspace_admin_of(s.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS jrs_write_admin ON public.job_role_sets;
CREATE POLICY jrs_write_admin ON public.job_role_sets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.permission_sets s
       WHERE s.id = job_role_sets.set_id
         AND s.workspace_id IS NOT NULL
         AND public.is_workspace_admin_of(s.workspace_id, auth.uid())
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.permission_sets s
       WHERE s.id = job_role_sets.set_id
         AND s.workspace_id IS NOT NULL
         AND public.is_workspace_admin_of(s.workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS chat_scope_select_live_chat_messages ON public.live_chat_messages;
CREATE POLICY chat_scope_select_live_chat_messages ON public.live_chat_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.live_chat_sessions s
       WHERE s.id = live_chat_messages.session_id
         AND s.workspace_id = live_chat_messages.workspace_id
         AND (
           s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.workspace'))
           OR (s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.team'))
               AND (s.assignee_id IS NULL OR s.assignee_id = auth.uid() OR s.assignee_id IN (SELECT public.my_team_member_ids())))
           OR (s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.own'))
               AND s.assignee_id = auth.uid())
         )
         AND (
           NOT (s.workspace_id IN (SELECT public.rep_restricted_workspaces()))
           OR s.lead_id IN (SELECT public.rep_my_lead_ids())
           OR s.contact_id IN (SELECT public.rep_my_contact_ids())
         )
    )
  );

DROP POLICY IF EXISTS chat_scope_insert_visible_live_chat_messages ON public.live_chat_messages;
CREATE POLICY chat_scope_insert_visible_live_chat_messages ON public.live_chat_messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.live_chat_sessions s
       WHERE s.id = live_chat_messages.session_id
         AND s.workspace_id = live_chat_messages.workspace_id
         AND (
           s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.workspace'))
           OR (s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.team'))
               AND (s.assignee_id IS NULL OR s.assignee_id = auth.uid() OR s.assignee_id IN (SELECT public.my_team_member_ids())))
           OR (s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.view.own'))
               AND s.assignee_id = auth.uid())
         )
         AND (
           NOT (s.workspace_id IN (SELECT public.rep_restricted_workspaces()))
           OR s.lead_id IN (SELECT public.rep_my_lead_ids())
           OR s.contact_id IN (SELECT public.rep_my_contact_ids())
         )
    )
  );

CREATE OR REPLACE FUNCTION public.deal_visible_to_current_user(_deal uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.deals d
      JOIN public.workspace_members wm
        ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active'
     WHERE d.id = _deal
       AND d.deleted_at IS NULL
       AND auth.uid() IS NOT NULL
       AND (
         public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.view.workspace')
         OR (public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.view.team')
             AND (d.assigned_to = auth.uid() OR d.owner_id = auth.uid()
                  OR d.assigned_to IN (SELECT public.my_team_member_ids())))
         OR (public.user_has_permission(auth.uid(), d.workspace_id, 'techsales.deals.view.own')
             AND (d.assigned_to = auth.uid() OR d.owner_id = auth.uid()))
       )
       AND (
         NOT (d.workspace_id IN (SELECT public.rep_restricted_workspaces()))
         OR d.assigned_to = auth.uid() OR d.owner_id = auth.uid()
       )
  );
$$;

REVOKE ALL ON FUNCTION public.deal_visible_to_current_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.deal_visible_to_current_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.role_profile_leader_decide(_item uuid, _decision text, _comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE it public.role_profile_approval_items; rq public.role_profile_approval_requests; p public.deal_role_profiles;
        r jsonb; v_id uuid; v_num int; v_to text;
BEGIN
  IF _decision NOT IN ('approve','request_changes') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
  SELECT * INTO it FROM public.role_profile_approval_items WHERE id = _item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO rq FROM public.role_profile_approval_requests WHERE id = it.request_id;
  IF rq.approver_id <> auth.uid() THEN RAISE EXCEPTION 'PERMISSION_DENIED: somente o líder designado decide' USING ERRCODE = '42501'; END IF;
  IF rq.status <> 'pending' THEN RAISE EXCEPTION 'REQUEST_NOT_PENDING: %', rq.status USING ERRCODE = '42501'; END IF;
  IF NOT public.deal_visible_to_current_user(rq.deal_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: negócio fora do seu escopo de visibilidade' USING ERRCODE = '42501';
  END IF;
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
    UPDATE public.role_profile_approval_items SET status = 'approved', decided_at = now(),
           comment = left(_comment, 1000) WHERE id = it.id;
    INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, version, actor_id, reason, details)
      VALUES (p.id, p.workspace_id, 'approved', p.status, v_to, v_num, auth.uid(), left(_comment, 500),
              jsonb_build_object('request_id', rq.id));
  ELSE
    UPDATE public.deal_role_profiles SET status = 'awaiting_info', revision = revision + 1, updated_at = now()
     WHERE id = p.id;
    UPDATE public.role_profile_approval_items SET status = 'changes_requested',
           decided_at = now(), comment = left(_comment, 1000) WHERE id = it.id;
    INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, actor_id, reason, details)
      VALUES (p.id, p.workspace_id, 'changes_requested', p.status, 'awaiting_info', auth.uid(), left(_comment, 500),
              jsonb_build_object('request_id', rq.id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_profile_approval_items WHERE request_id = rq.id AND status = 'pending') THEN
    UPDATE public.role_profile_approval_requests SET status = 'decided', decided_at = now() WHERE id = rq.id;
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN _decision = 'approve' THEN 'approved' ELSE 'changes_requested' END,
                            'version', v_num, 'version_id', v_id);
END $function$;

CREATE OR REPLACE FUNCTION public.role_profile_approve(_profile uuid, _expected_revision integer, _snapshot jsonb, _commercial jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE p public.deal_role_profiles; v_item uuid; r jsonb;
BEGIN
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = _profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.deal_visible_to_current_user(p.deal_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: negócio fora do seu escopo de visibilidade' USING ERRCODE = '42501';
  END IF;
  IF p.revision <> _expected_revision THEN
    RAISE EXCEPTION 'STALE_REVISION: o perfil foi alterado (revisão %); recarregue antes de aprovar', p.revision USING ERRCODE = '40001';
  END IF;
  SELECT it.id INTO v_item
    FROM public.role_profile_approval_items it
    JOIN public.role_profile_approval_requests rq ON rq.id = it.request_id
   WHERE it.profile_id = p.id AND it.status = 'pending' AND rq.status = 'pending'
     AND rq.approver_id = auth.uid()
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
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE p public.deal_role_profiles; v_id uuid; v_num int; v_to text;
BEGIN
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = _profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = 'P0002'; END IF;
  IF auth.uid() IS NULL OR NOT public.is_workspace_admin_of(p.workspace_id, auth.uid())
     OR NOT EXISTS (SELECT 1 FROM public.workspace_members wm
                     WHERE wm.workspace_id = p.workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: somente administrador ativo do workspace' USING ERRCODE = '42501';
  END IF;
  IF NOT public.deal_visible_to_current_user(p.deal_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: negócio fora do seu escopo de visibilidade' USING ERRCODE = '42501';
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

DO $$
DECLARE wk constant uuid := '184b9435-0a9b-4334-9e89-8854dc883f5d';
        role_apont constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000b';
        v_owner uuid; v_set uuid;
BEGIN
  SELECT created_by INTO v_owner FROM public.workspaces WHERE id = wk;
  IF v_owner IS NULL THEN RETURN; END IF;

  SELECT s.id INTO v_set FROM public.permission_sets s
   WHERE s.workspace_id = wk AND s.module = '__bundle__'
     AND s.name = '__role_bundle:' || role_apont::text
   LIMIT 1;
  IF v_set IS NULL THEN
    INSERT INTO public.permission_sets(owner_id, workspace_id, module, name, description, is_system)
    VALUES (v_owner, wk, '__bundle__', '__role_bundle:' || role_apont::text,
            'Pacote local da WK para o cargo Apontador de Horas.', false)
    RETURNING id INTO v_set;
  END IF;

  INSERT INTO public.job_role_sets(role_id, set_id)
  SELECT role_apont, v_set
  WHERE NOT EXISTS (SELECT 1 FROM public.job_role_sets WHERE role_id = role_apont AND set_id = v_set);

  INSERT INTO public.permission_set_items(set_id, permission_key)
  SELECT v_set, d.permission_key
    FROM public.job_role_default_permissions d
   WHERE d.role_id = role_apont
     AND NOT EXISTS (
       SELECT 1 FROM public.permission_set_items i
        WHERE i.set_id = v_set AND i.permission_key = d.permission_key);

  INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
  SELECT wk, 'phase4_apontador_bundle', jsonb_build_object('set_id', v_set, 'role_id', role_apont)
  WHERE NOT EXISTS (SELECT 1 FROM public.rbac_wk_backup_2026_10
                     WHERE workspace_id = wk AND source = 'phase4_apontador_bundle');

  DELETE FROM public.job_role_permission_overrides o
   WHERE o.workspace_id = wk AND o.role_id = role_apont AND o.effect = 'grant'
     AND EXISTS (SELECT 1 FROM public.permission_set_items i
                  WHERE i.set_id = v_set AND i.permission_key = o.permission_key);
END $$;
