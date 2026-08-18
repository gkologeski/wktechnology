
-- Helper: workspace de um usuário (ativo, senão o mais antigo, senão o que ele criou)
CREATE OR REPLACE FUNCTION public.workspace_for_user(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.active_workspace_id FROM public.profiles p
      WHERE p.id = _user AND p.active_workspace_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.workspace_members wm
                     WHERE wm.workspace_id = p.active_workspace_id AND wm.user_id = _user)),
    (SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = _user ORDER BY wm.joined_at LIMIT 1),
    (SELECT w.id FROM public.workspaces w WHERE w.created_by = _user ORDER BY w.created_at LIMIT 1),
    (SELECT w.id FROM public.workspaces w WHERE w.id = _user)
  );
$$;
REVOKE ALL ON FUNCTION public.workspace_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_for_user(uuid) TO authenticated, service_role;

-- Trigger genérico de preenchimento
CREATE OR REPLACE FUNCTION public.set_workspace_id_generic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid;
BEGIN
  IF NEW.workspace_id IS NOT NULL THEN RETURN NEW; END IF;
  v_ws := public.workspace_for_user(auth.uid());
  IF v_ws IS NULL THEN
    BEGIN
      v_ws := public.workspace_for_user((to_jsonb(NEW) ->> 'owner_id')::uuid);
    EXCEPTION WHEN others THEN v_ws := NULL;
    END;
  END IF;
  NEW.workspace_id := v_ws;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_workspace_id_generic() FROM PUBLIC, anon;

-- Adiciona coluna + índice + trigger em todas as tabelas alvo
DO $$
DECLARE
  t text;
  targets text[] := ARRAY[
    'ats_interviews','ats_offers','ats_scorecards','ats_scorecard_responses','ats_interview_kits',
    'ats_interviewer_pools','ats_interviewer_pool_members','ats_interviewer_availability',
    'ats_talent_pools','ats_talent_pool_members','ats_hunting_captures','ats_hunting_templates',
    'ats_job_postings','ats_stage_emails','ats_stage_email_log','ats_sourcing_sequences',
    'ats_sourcing_sequence_steps','ats_sourcing_enrollments','ats_application_events','ats_match_scores',
    'ats_referral_programs','ats_referrals','ats_candidate_flags','ats_candidate_consents',
    'ats_candidate_email_queue','ats_daily_briefings','ats_dsar_requests','ats_async_video_responses',
    'prospecting_questionnaires','prospecting_questions','prospecting_qualifications',
    'prospecting_cadences','prospecting_cadence_steps','prospecting_enrollments',
    'sdr_playbooks','sdr_enrollments','user_files','user_file_folders','message_drafts',
    'feature_flags','job_roles','permission_sets','lead_sources'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (workspace_id)', 'idx_'||t||'_workspace_id', t);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_workspace_id ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_%I_set_workspace_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_workspace_id_generic()', t, t);
    END IF;
  END LOOP;
END $$;

-- Backfill a partir do pai (ordem importa)
UPDATE public.ats_interviews t SET workspace_id = j.workspace_id FROM public.ats_jobs j WHERE t.job_id = j.id AND t.workspace_id IS NULL AND j.workspace_id IS NOT NULL;
UPDATE public.ats_offers t SET workspace_id = j.workspace_id FROM public.ats_jobs j WHERE t.job_id = j.id AND t.workspace_id IS NULL AND j.workspace_id IS NOT NULL;
UPDATE public.ats_scorecards t SET workspace_id = j.workspace_id FROM public.ats_jobs j WHERE t.job_id = j.id AND t.workspace_id IS NULL AND j.workspace_id IS NOT NULL;
UPDATE public.ats_job_postings t SET workspace_id = j.workspace_id FROM public.ats_jobs j WHERE t.job_id = j.id AND t.workspace_id IS NULL AND j.workspace_id IS NOT NULL;
UPDATE public.ats_match_scores t SET workspace_id = j.workspace_id FROM public.ats_jobs j WHERE t.job_id = j.id AND t.workspace_id IS NULL AND j.workspace_id IS NOT NULL;
UPDATE public.ats_stage_email_log t SET workspace_id = j.workspace_id FROM public.ats_jobs j WHERE t.job_id = j.id AND t.workspace_id IS NULL AND j.workspace_id IS NOT NULL;
UPDATE public.ats_referrals t SET workspace_id = j.workspace_id FROM public.ats_jobs j WHERE t.job_id = j.id AND t.workspace_id IS NULL AND j.workspace_id IS NOT NULL;
UPDATE public.ats_application_events t SET workspace_id = a.workspace_id FROM public.ats_applications a WHERE t.application_id = a.id AND t.workspace_id IS NULL AND a.workspace_id IS NOT NULL;
UPDATE public.ats_candidate_email_queue t SET workspace_id = a.workspace_id FROM public.ats_applications a WHERE t.application_id = a.id AND t.workspace_id IS NULL AND a.workspace_id IS NOT NULL;
UPDATE public.ats_scorecard_responses t SET workspace_id = a.workspace_id FROM public.ats_applications a WHERE t.application_id = a.id AND t.workspace_id IS NULL AND a.workspace_id IS NOT NULL;
UPDATE public.ats_candidate_flags t SET workspace_id = c.workspace_id FROM public.ats_candidates c WHERE t.candidate_id = c.id AND t.workspace_id IS NULL AND c.workspace_id IS NOT NULL;
UPDATE public.ats_candidate_consents t SET workspace_id = c.workspace_id FROM public.ats_candidates c WHERE t.candidate_id = c.id AND t.workspace_id IS NULL AND c.workspace_id IS NOT NULL;
UPDATE public.ats_dsar_requests t SET workspace_id = c.workspace_id FROM public.ats_candidates c WHERE t.candidate_id = c.id AND t.workspace_id IS NULL AND c.workspace_id IS NOT NULL;
UPDATE public.ats_hunting_captures t SET workspace_id = c.workspace_id FROM public.ats_candidates c WHERE t.candidate_id = c.id AND t.workspace_id IS NULL AND c.workspace_id IS NOT NULL;
UPDATE public.ats_talent_pool_members t SET workspace_id = c.workspace_id FROM public.ats_candidates c WHERE t.candidate_id = c.id AND t.workspace_id IS NULL AND c.workspace_id IS NOT NULL;
UPDATE public.ats_sourcing_enrollments t SET workspace_id = c.workspace_id FROM public.ats_candidates c WHERE t.candidate_id = c.id AND t.workspace_id IS NULL AND c.workspace_id IS NOT NULL;
UPDATE public.ats_interview_kits t SET workspace_id = p.workspace_id FROM public.ats_pipelines p WHERE t.pipeline_id = p.id AND t.workspace_id IS NULL AND p.workspace_id IS NOT NULL;
UPDATE public.ats_async_video_responses t SET workspace_id = i.workspace_id FROM public.ats_interviews i WHERE t.interview_id = i.id AND t.workspace_id IS NULL AND i.workspace_id IS NOT NULL;
UPDATE public.ats_interviewer_pool_members t SET workspace_id = p.workspace_id FROM public.ats_interviewer_pools p WHERE t.pool_id = p.id AND t.workspace_id IS NULL AND p.workspace_id IS NOT NULL;
UPDATE public.ats_sourcing_sequence_steps t SET workspace_id = s.workspace_id FROM public.ats_sourcing_sequences s WHERE t.sequence_id = s.id AND t.workspace_id IS NULL AND s.workspace_id IS NOT NULL;
UPDATE public.prospecting_questions t SET workspace_id = q.workspace_id FROM public.prospecting_questionnaires q WHERE t.questionnaire_id = q.id AND t.workspace_id IS NULL AND q.workspace_id IS NOT NULL;
UPDATE public.prospecting_qualifications t SET workspace_id = q.workspace_id FROM public.prospecting_questionnaires q WHERE t.questionnaire_id = q.id AND t.workspace_id IS NULL AND q.workspace_id IS NOT NULL;
UPDATE public.prospecting_cadence_steps t SET workspace_id = c.workspace_id FROM public.prospecting_cadences c WHERE t.cadence_id = c.id AND t.workspace_id IS NULL AND c.workspace_id IS NOT NULL;
UPDATE public.prospecting_enrollments t SET workspace_id = c.workspace_id FROM public.prospecting_cadences c WHERE t.cadence_id = c.id AND t.workspace_id IS NULL AND c.workspace_id IS NOT NULL;
UPDATE public.sdr_enrollments t SET workspace_id = p.workspace_id FROM public.sdr_playbooks p WHERE t.playbook_id = p.id AND t.workspace_id IS NULL AND p.workspace_id IS NOT NULL;
UPDATE public.user_files t SET workspace_id = f.workspace_id FROM public.user_file_folders f WHERE t.folder_id = f.id AND t.workspace_id IS NULL AND f.workspace_id IS NOT NULL;
UPDATE public.ats_referrals t SET workspace_id = pr.workspace_id FROM public.ats_referral_programs pr WHERE t.program_id = pr.id AND t.workspace_id IS NULL AND pr.workspace_id IS NOT NULL;

-- Backfill restante pelo dono do registro
DO $$
DECLARE
  t text;
  targets text[] := ARRAY[
    'ats_interviews','ats_offers','ats_scorecards','ats_scorecard_responses','ats_interview_kits',
    'ats_interviewer_pools','ats_interviewer_pool_members','ats_interviewer_availability',
    'ats_talent_pools','ats_talent_pool_members','ats_hunting_captures','ats_hunting_templates',
    'ats_job_postings','ats_stage_emails','ats_stage_email_log','ats_sourcing_sequences',
    'ats_sourcing_sequence_steps','ats_sourcing_enrollments','ats_application_events','ats_match_scores',
    'ats_referral_programs','ats_referrals','ats_candidate_flags','ats_candidate_consents',
    'ats_candidate_email_queue','ats_daily_briefings','ats_dsar_requests','ats_async_video_responses',
    'prospecting_questionnaires','prospecting_questions','prospecting_qualifications',
    'prospecting_cadences','prospecting_cadence_steps','prospecting_enrollments',
    'sdr_playbooks','sdr_enrollments','user_files','user_file_folders','message_drafts',
    'feature_flags','job_roles','permission_sets','lead_sources'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='owner_id') THEN
      EXECUTE format('UPDATE public.%I SET workspace_id = public.workspace_for_user(owner_id) WHERE workspace_id IS NULL AND owner_id IS NOT NULL', t);
    END IF;
  END LOOP;
END $$;
