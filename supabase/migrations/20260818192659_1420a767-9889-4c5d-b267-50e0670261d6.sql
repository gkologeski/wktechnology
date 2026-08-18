
-- Corrige vazamento latente: só compartilha dentro do workspace ativo
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members a
     WHERE a.user_id = _other
       AND a.workspace_id IN (SELECT public.current_user_workspaces())
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE w.id = _other AND w.id IN (SELECT public.current_user_workspaces())
  );
$$;

DO $$
DECLARE
  t text;
  shared text[] := ARRAY[
    'ats_interviews','ats_offers','ats_scorecards','ats_scorecard_responses','ats_interview_kits',
    'ats_interviewer_pools','ats_interviewer_pool_members','ats_talent_pools','ats_talent_pool_members',
    'ats_hunting_captures','ats_hunting_templates','ats_job_postings','ats_stage_emails','ats_stage_email_log',
    'ats_sourcing_sequences','ats_sourcing_sequence_steps','ats_sourcing_enrollments','ats_application_events',
    'ats_match_scores','ats_referral_programs','ats_referrals','ats_candidate_flags','ats_candidate_email_queue',
    'prospecting_questionnaires','prospecting_questions','prospecting_qualifications',
    'prospecting_cadences','prospecting_cadence_steps','prospecting_enrollments',
    'sdr_playbooks','sdr_enrollments','lead_sources','job_roles'
  ];
  personal text[] := ARRAY[
    'user_files','user_file_folders','message_drafts','feature_flags','permission_sets',
    'ats_daily_briefings','ats_interviewer_availability','ats_dsar_requests','ats_candidate_consents',
    'ats_async_video_responses'
  ];
BEGIN
  -- Barreira restritiva de workspace em todas as tabelas ajustadas
  FOREACH t IN ARRAY (shared || personal) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_ws_restrict', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
      USING (workspace_id IS NULL OR workspace_id IN (SELECT public.current_user_workspaces()) OR public.is_platform_admin(auth.uid()))
      WITH CHECK (workspace_id IS NULL OR workspace_id IN (SELECT public.current_user_workspaces()) OR public.is_platform_admin(auth.uid()))
    $f$, t||'_ws_restrict', t);
  END LOOP;

  -- Compartilhado no workspace: leitura para todos os membros, escrita para dono/admin
  FOREACH t IN ARRAY shared LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_ws_select', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.current_user_workspaces()) OR public.is_platform_admin(auth.uid()))
    $f$, t||'_ws_select', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_ws_insert', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
      WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t||'_ws_insert', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_ws_update', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
      USING (workspace_id IN (SELECT public.current_user_workspaces()))
      WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()))
    $f$, t||'_ws_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_ws_delete', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
      USING (workspace_id IN (SELECT public.current_user_workspaces())
             AND (public.is_workspace_admin_of(workspace_id, auth.uid())
                  OR (to_jsonb(%I.*) ->> 'owner_id')::uuid = auth.uid()))
    $f$, t||'_ws_delete', t, t);
  END LOOP;

  -- Pessoais: dono ou admin do workspace
  FOREACH t IN ARRAY personal LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_ws_admin_read', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.current_user_workspaces())
             AND (public.is_workspace_admin_of(workspace_id, auth.uid())
                  OR (to_jsonb(%I.*) ->> 'owner_id')::uuid = auth.uid()))
    $f$, t||'_ws_admin_read', t, t);
  END LOOP;
END $$;
