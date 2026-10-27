-- Preserve canonical CAS; add permission-checked recipient assignment before pausing.
CREATE OR REPLACE FUNCTION public.service_agent_commit_turn(
  p_job uuid,
  p_lease uuid,
  p_evidence jsonb,
  p_qualification jsonb,
  p_enrollment jsonb,
  p_job_patch jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.service_agent_jobs;
  cv record;
  e public.sdr_enrollments;
  v_qid uuid;
  v_cur timestamptz;
  v_answers jsonb;
  ev jsonb;
  v_has_state boolean;
  handoff_target uuid; source_table text; assignment_status text;
BEGIN
  SELECT * INTO j FROM public.service_agent_jobs WHERE id = p_job FOR UPDATE;
  IF NOT FOUND THEN RETURN 'job_missing'; END IF;
  IF j.status <> 'running' OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_until < now() THEN RETURN 'lease_lost'; END IF;
  SELECT id, workspace_id, enrollment_id, channel, source_id, ai_owner, ai_version INTO cv
    FROM public.service_agent_sessions WHERE id = j.session_id FOR SHARE;
  IF NOT FOUND OR cv.workspace_id IS DISTINCT FROM j.workspace_id THEN RETURN 'context_mismatch'; END IF;
  IF cv.ai_owner IS DISTINCT FROM 'ai' THEN RETURN 'owner_not_ai'; END IF;
  IF cv.ai_version IS DISTINCT FROM j.conversation_version THEN RETURN 'stale_version'; END IF;
  SELECT * INTO e FROM public.sdr_enrollments WHERE id = cv.enrollment_id FOR UPDATE;
  IF NOT FOUND OR e.workspace_id IS DISTINCT FROM j.workspace_id OR e.conversation_id IS NOT NULL THEN RETURN 'context_mismatch'; END IF;
  IF e.status <> 'active' THEN RETURN 'enrollment_inactive'; END IF;

  IF public.service_agent_guard(p_job,p_lease)<>'ok' THEN RETURN 'permission_revoked'; END IF;

  -- Estado da conversa: compare-and-set ANTES de qualquer escrita.
  v_has_state := p_enrollment IS NOT NULL AND jsonb_typeof(p_enrollment) = 'object'
    AND p_enrollment ? 'conversation_state'
    AND jsonb_typeof(p_enrollment->'conversation_state') = 'object';
  IF v_has_state AND p_enrollment ? 'expected_state_version'
     AND (p_enrollment->>'expected_state_version')::integer IS DISTINCT FROM e.conversation_state_version THEN
    RETURN 'state_changed';
  END IF;

  -- Qualificação canônica (mesma da Prospecção). Decisão humana nunca é alterada.
  -- Compare-and-set por data de alteração E respostas lidas antes da IA.
  IF p_qualification IS NOT NULL AND jsonb_typeof(p_qualification) = 'object' THEN
    v_qid := NULLIF(p_qualification->>'id','')::uuid;
    IF v_qid IS NOT NULL THEN
      SELECT updated_at, answers INTO v_cur, v_answers FROM public.prospecting_qualifications
        WHERE id = v_qid AND workspace_id = j.workspace_id FOR UPDATE;
      IF NOT FOUND THEN RETURN 'qualification_missing'; END IF;
      IF v_cur IS DISTINCT FROM (p_qualification->>'expected_updated_at')::timestamptz
         OR COALESCE(v_answers, '{}'::jsonb) IS DISTINCT FROM COALESCE(p_qualification->'expected_answers', '{}'::jsonb) THEN
        RETURN 'qualification_changed';
      END IF;
      UPDATE public.prospecting_qualifications SET
        answers = p_qualification->'answers',
        score = round((p_qualification->>'score')::numeric)::integer,
        questionnaire_points = (p_qualification->>'questionnaire_points')::numeric,
        icp_points = (p_qualification->>'icp_points')::numeric,
        total_score = (p_qualification->>'total_score')::numeric,
        updated_at = now()
      WHERE id = v_qid;
    ELSE
      IF EXISTS (SELECT 1 FROM public.prospecting_qualifications
                 WHERE workspace_id = j.workspace_id
                   AND questionnaire_id = (p_qualification->>'questionnaire_id')::uuid
                   AND entity = p_qualification->>'entity'
                   AND entity_id = (p_qualification->>'entity_id')::uuid) THEN
        RETURN 'qualification_changed';
      END IF;
      INSERT INTO public.prospecting_qualifications
        (owner_id, workspace_id, questionnaire_id, entity, entity_id, answers, score, questionnaire_points, icp_points, total_score, decision)
      VALUES (
        e.owner_id, j.workspace_id, (p_qualification->>'questionnaire_id')::uuid,
        p_qualification->>'entity', (p_qualification->>'entity_id')::uuid,
        p_qualification->'answers', round((p_qualification->>'score')::numeric)::integer,
        (p_qualification->>'questionnaire_points')::numeric, (p_qualification->>'icp_points')::numeric,
        (p_qualification->>'total_score')::numeric, 'pending')
      RETURNING id INTO v_qid;
    END IF;
    UPDATE public.sdr_enrollments SET qualification_id = v_qid, qualification_score = round((p_qualification->>'total_score')::numeric)::integer
      WHERE id = e.id;
  END IF;

  FOR ev IN SELECT * FROM jsonb_array_elements(COALESCE(p_evidence, '[]'::jsonb)) LOOP
    INSERT INTO public.service_agent_evidence(workspace_id,session_id,enrollment_id,field,question_id,value,source_message_id,excerpt)
    SELECT j.workspace_id,cv.id,e.id,ev->>'field',NULLIF(ev->>'question_id','')::uuid,ev->>'value',m.id,ev->>'excerpt'
    FROM (
     SELECT id,workspace_id,thread_id AS source_id,direction FROM public.email_messages WHERE cv.channel='email'
     UNION ALL SELECT id,workspace_id,session_id,direction FROM public.live_chat_messages WHERE cv.channel='chat'
    ) m WHERE m.id=(ev->>'message_id')::uuid AND m.source_id=cv.source_id AND m.workspace_id=j.workspace_id AND m.direction='inbound'
    ON CONFLICT(session_id,field,source_message_id) DO NOTHING;
  END LOOP;

  -- The configured recipient is read from the published agent's playbook, never model text.
  IF p_job_patch->'draft_payload'->>'intent'='handoff' THEN
    SELECT assigned_to INTO handoff_target FROM public.sdr_playbooks WHERE id=e.playbook_id AND workspace_id=j.workspace_id;
    source_table:=CASE cv.channel WHEN 'email' THEN 'email_threads' ELSE 'live_chat_sessions' END;
    assignment_status:='unavailable';
    IF handoff_target IS NOT NULL AND public.is_workspace_member(j.workspace_id,handoff_target) THEN
      assignment_status:='not_authorized';
      IF public.sales_worker_authorize('sdr_enrollments',e.id,jsonb_build_array(
        jsonb_build_object('table',source_table,'id',cv.source_id,'action','assign'),
        jsonb_build_object('member_id',handoff_target))) THEN
        IF cv.channel='email' THEN UPDATE public.email_threads SET assigned_to=handoff_target WHERE id=cv.source_id AND workspace_id=j.workspace_id;
        ELSE UPDATE public.live_chat_sessions SET assignee_id=handoff_target WHERE id=cv.source_id AND workspace_id=j.workspace_id;END IF;
        assignment_status:='assigned';
      END IF;
    END IF;
    p_job_patch:=jsonb_set(p_job_patch,'{draft_payload}',coalesce(p_job_patch->'draft_payload','{}')||jsonb_build_object('handoff_assignment',assignment_status));
  END IF;

  IF p_enrollment IS NOT NULL AND jsonb_typeof(p_enrollment) = 'object' THEN
    UPDATE public.sdr_enrollments SET
      offers = CASE WHEN p_enrollment ? 'offers' THEN p_enrollment->'offers' ELSE offers END,
      status = COALESCE(p_enrollment->>'status', status),
      handoff_at = CASE WHEN p_enrollment ? 'handoff_at' THEN (p_enrollment->>'handoff_at')::timestamptz ELSE handoff_at END,
      handoff_reason = CASE WHEN p_enrollment ? 'handoff_reason' THEN left(p_enrollment->>'handoff_reason',1000) ELSE handoff_reason END,
      commercial_stage = COALESCE(p_enrollment->>'commercial_stage', commercial_stage),
      opted_out_at = CASE WHEN p_enrollment ? 'opted_out_at' THEN (p_enrollment->>'opted_out_at')::timestamptz ELSE opted_out_at END,
      cancel_reason = CASE WHEN p_enrollment ? 'cancel_reason' THEN p_enrollment->>'cancel_reason' ELSE cancel_reason END,
      follow_up_at = CASE WHEN p_enrollment ? 'follow_up_at' THEN (p_enrollment->>'follow_up_at')::timestamptz ELSE follow_up_at END,
      conversation_state = CASE WHEN v_has_state
        THEN COALESCE(conversation_state, '{}'::jsonb) || (p_enrollment->'conversation_state')
        ELSE conversation_state END,
      conversation_state_version = CASE WHEN v_has_state THEN conversation_state_version + 1 ELSE conversation_state_version END,
      updated_at = now()
    WHERE id = e.id;
  END IF;

  IF p_job_patch IS NOT NULL AND jsonb_typeof(p_job_patch) = 'object' THEN
    UPDATE public.service_agent_jobs SET
      status = COALESCE(p_job_patch->>'status', status),
      draft_text = CASE WHEN p_job_patch ? 'draft_text' THEN p_job_patch->>'draft_text' ELSE draft_text END,
      draft_payload = CASE WHEN p_job_patch ? 'draft_payload' THEN p_job_patch->'draft_payload' ELSE draft_payload END,
      error = CASE WHEN p_job_patch ? 'error' THEN p_job_patch->>'error' ELSE error END,
      lease_token = CASE WHEN COALESCE(p_job_patch->>'status', 'running') = 'running' THEN lease_token ELSE NULL END,
      updated_at = now()
    WHERE id = j.id;
  END IF;
  IF p_job_patch->'draft_payload'->>'intent'='handoff' OR coalesce((p_job_patch->'draft_payload'->>'opt_out')::boolean,false) THEN
    UPDATE public.service_agent_sessions SET ai_owner=CASE WHEN p_job_patch->'draft_payload'->>'intent'='handoff' THEN 'human' ELSE 'paused' END,
      ai_version=ai_version+1 WHERE id=cv.id;
    UPDATE public.service_agent_jobs SET conversation_version=(SELECT ai_version FROM public.service_agent_sessions WHERE id=cv.id) WHERE id=j.id;
  END IF;
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.service_agent_commit_turn(uuid,uuid,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_commit_turn(uuid,uuid,jsonb,jsonb,jsonb,jsonb) TO service_role;

-- One-minute recovery covers customer wait windows longer than a single HTTP wake.
-- Keep the existing command, credentials and active/suspended state unchanged.
DO $$ DECLARE job_id bigint;BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
  FOR job_id IN SELECT jobid FROM cron.job WHERE jobname='sdr-tick' LOOP
   PERFORM cron.alter_job(job_id,schedule:='* * * * *');
  END LOOP;
 END IF;
END $$;
