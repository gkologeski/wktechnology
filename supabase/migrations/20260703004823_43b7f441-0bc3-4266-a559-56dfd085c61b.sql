
-- 1. Helpers

CREATE OR REPLACE FUNCTION public.is_workspace_admin_of(_owner uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE w.id = _owner AND w.created_by = _user
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _owner
       AND wm.user_id = _user
       AND wm.role IN ('owner','admin')
  ) OR EXISTS (
    -- _owner é um usuário membro de algum workspace onde _user é admin/owner
    SELECT 1
      FROM public.workspace_members wm_owner
      JOIN public.workspace_members wm_user
        ON wm_user.workspace_id = wm_owner.workspace_id
     WHERE wm_owner.user_id = _owner
       AND wm_user.user_id = _user
       AND wm_user.role IN ('owner','admin')
  ) OR EXISTS (
    SELECT 1
      FROM public.workspace_members wm_owner
      JOIN public.workspaces w ON w.id = wm_owner.workspace_id
     WHERE wm_owner.user_id = _owner
       AND w.created_by = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_team_with(_owner uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_group_members a
      JOIN public.user_group_members b ON a.group_id = b.group_id
     WHERE a.user_id = _user AND b.user_id = _owner
  );
$$;

-- Retorna true se _user pode escrever em registro cujo owner_id é _owner.
-- _owner pode ser um workspace_id (padrão do projeto) OU um user_id.
CREATE OR REPLACE FUNCTION public.can_write_owner(_owner uuid, _user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_workspace uuid;
  v_scope public.data_scope;
BEGIN
  IF _user IS NULL OR _owner IS NULL THEN RETURN false; END IF;
  IF _owner = _user THEN RETURN true; END IF;

  -- Admin do workspace (cobre owner_id = workspace_id e owner_id = user_id)
  IF public.is_workspace_admin_of(_owner, _user) THEN RETURN true; END IF;

  -- Líder de time: mesmo grupo + escopo team/workspace/custom no workspace-alvo
  IF NOT public.shares_team_with(_owner, _user) THEN RETURN false; END IF;

  -- Descobre o workspace: se _owner é workspace, usa direto; senão pega o compartilhado com _user
  SELECT id INTO v_workspace FROM public.workspaces WHERE id = _owner;
  IF v_workspace IS NULL THEN
    SELECT wm_user.workspace_id INTO v_workspace
      FROM public.workspace_members wm_user
      JOIN public.workspace_members wm_owner
        ON wm_owner.workspace_id = wm_user.workspace_id
     WHERE wm_user.user_id = _user AND wm_owner.user_id = _owner
     LIMIT 1;
  END IF;
  IF v_workspace IS NULL THEN RETURN false; END IF;

  v_scope := public.user_data_scope(_user, v_workspace);
  RETURN v_scope IN ('workspace','team','custom');
END $$;

GRANT EXECUTE ON FUNCTION public.is_workspace_admin_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_team_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_owner(uuid, uuid) TO authenticated;

-- 2. Aplica policies aditivas em todas as tabelas de negócio

DO $mig$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- ATS
    'ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers',
    'ats_job_postings','ats_pipelines','ats_scorecards','ats_scorecard_responses',
    'ats_talent_pools','ats_talent_pool_members','ats_referrals','ats_referral_programs',
    'ats_sourcing_sequences','ats_sourcing_enrollments','ats_stage_emails',
    'ats_interview_kits','ats_interviewer_pools','ats_hunting_templates',
    -- CRM / Sales
    'deals','contacts','companies','leads','activities','meetings','calendar_events',
    'email_threads','email_messages','email_broadcasts','email_templates','email_snippets',
    'sequences','sequence_enrollments','quotes','quote_line_items','quote_templates',
    'proposals','products','pipelines',
    -- Suporte / Ops
    'tickets','sla_policies','macros','saved_views','dashboards','dashboard_widgets',
    'custom_reports','custom_properties','custom_objects','custom_object_records',
    'forms','form_submissions','landing_pages','workflows','workflow_runs',
    'outbound_webhooks','webhook_deliveries',
    'whatsapp_conversations','whatsapp_messages','whatsapp_campaigns'
  ];
  has_owner boolean;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- pula tabelas que não existem ou que não têm owner_id
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=t AND column_name='owner_id'
    ) INTO has_owner;
    IF NOT has_owner THEN CONTINUE; END IF;

    -- Admin write (UPDATE / DELETE)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_admin_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (public.is_workspace_admin_of(owner_id, auth.uid()))
         WITH CHECK (public.is_workspace_admin_of(owner_id, auth.uid()))',
      t||'_admin_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_admin_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (public.is_workspace_admin_of(owner_id, auth.uid()))',
      t||'_admin_delete', t);

    -- Team lead write
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_team_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (public.can_write_owner(owner_id, auth.uid()))
         WITH CHECK (public.can_write_owner(owner_id, auth.uid()))',
      t||'_team_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_team_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (public.can_write_owner(owner_id, auth.uid()))',
      t||'_team_delete', t);

    -- Admin/Team select (só para reforço; onde já existe shares_workspace_with é redundante mas inofensivo)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_admin_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.is_workspace_admin_of(owner_id, auth.uid())
                OR public.can_write_owner(owner_id, auth.uid()))',
      t||'_admin_select', t);
  END LOOP;
END
$mig$;
