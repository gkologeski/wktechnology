CREATE OR REPLACE FUNCTION public.sdr_commit_turn(
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
  j public.sdr_turn_jobs;
  cv record;
  e public.sdr_enrollments;
  v_qid uuid;
  v_cur timestamptz;
  ev jsonb;
BEGIN
  SELECT * INTO j FROM public.sdr_turn_jobs WHERE id = p_job FOR UPDATE;
  IF NOT FOUND THEN RETURN 'job_missing'; END IF;
  IF j.status <> 'running' OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_until < now() THEN RETURN 'lease_lost'; END IF;
  SELECT id, workspace_id, ai_owner, ai_version INTO cv
    FROM public.whatsapp_conversations WHERE id = j.conversation_id FOR SHARE;
  IF NOT FOUND OR cv.workspace_id IS DISTINCT FROM j.workspace_id THEN RETURN 'context_mismatch'; END IF;
  IF cv.ai_owner IS DISTINCT FROM 'ai' THEN RETURN 'owner_not_ai'; END IF;
  IF cv.ai_version IS DISTINCT FROM j.conversation_version THEN RETURN 'stale_version'; END IF;
  SELECT * INTO e FROM public.sdr_enrollments WHERE id = j.enrollment_id FOR UPDATE;
  IF NOT FOUND OR e.workspace_id IS DISTINCT FROM j.workspace_id OR e.conversation_id IS DISTINCT FROM j.conversation_id THEN RETURN 'context_mismatch'; END IF;
  IF e.status <> 'active' THEN RETURN 'enrollment_inactive'; END IF;

  -- Qualificação canônica (mesma da Prospecção). Decisão humana nunca é alterada.
  IF p_qualification IS NOT NULL AND jsonb_typeof(p_qualification) = 'object' THEN
    v_qid := NULLIF(p_qualification->>'id','')::uuid;
    IF v_qid IS NOT NULL THEN
      SELECT updated_at INTO v_cur FROM public.prospecting_qualifications
        WHERE id = v_qid AND workspace_id = j.workspace_id FOR UPDATE;
      IF NOT FOUND THEN RETURN 'qualification_missing'; END IF;
      IF v_cur IS DISTINCT FROM (p_qualification->>'expected_updated_at')::timestamptz THEN RETURN 'qualification_changed'; END IF;
      UPDATE public.prospecting_qualifications SET
        answers = p_qualification->'answers',
        score = round((p_qualification->>'score')::numeric)::integer,
        questionnaire_points = (p_qualification->>'questionnaire_points')::numeric,
        icp_points = (p_qualification->>'icp_points')::numeric,
        total_score = (p_qualification->>'total_score')::numeric,
        updated_at = now()
      WHERE id = v_qid;
    ELSE
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

  -- Evidências: mensagem precisa ser inbound desta conversa.
  FOR ev IN SELECT * FROM jsonb_array_elements(COALESCE(p_evidence, '[]'::jsonb)) LOOP
    INSERT INTO public.sdr_qualification_evidence (workspace_id, enrollment_id, field, question_id, value, source_message_id, excerpt)
    SELECT j.workspace_id, e.id, ev->>'field', NULLIF(ev->>'question_id','')::uuid, ev->>'value', m.id, ev->>'excerpt'
    FROM public.whatsapp_messages m
    WHERE m.id = (ev->>'message_id')::uuid AND m.conversation_id = j.conversation_id AND m.direction = 'inbound'
    ON CONFLICT (enrollment_id, field, source_message_id) DO NOTHING;
  END LOOP;

  IF p_enrollment IS NOT NULL AND jsonb_typeof(p_enrollment) = 'object' THEN
    UPDATE public.sdr_enrollments SET
      offers = CASE WHEN p_enrollment ? 'offers' THEN p_enrollment->'offers' ELSE offers END,
      status = COALESCE(p_enrollment->>'status', status),
      commercial_stage = COALESCE(p_enrollment->>'commercial_stage', commercial_stage),
      opted_out_at = CASE WHEN p_enrollment ? 'opted_out_at' THEN (p_enrollment->>'opted_out_at')::timestamptz ELSE opted_out_at END,
      cancel_reason = CASE WHEN p_enrollment ? 'cancel_reason' THEN p_enrollment->>'cancel_reason' ELSE cancel_reason END,
      follow_up_at = CASE WHEN p_enrollment ? 'follow_up_at' THEN (p_enrollment->>'follow_up_at')::timestamptz ELSE follow_up_at END,
      updated_at = now()
    WHERE id = e.id;
  END IF;

  IF p_job_patch IS NOT NULL AND jsonb_typeof(p_job_patch) = 'object' THEN
    UPDATE public.sdr_turn_jobs SET
      status = COALESCE(p_job_patch->>'status', status),
      draft_text = CASE WHEN p_job_patch ? 'draft_text' THEN p_job_patch->>'draft_text' ELSE draft_text END,
      draft_payload = CASE WHEN p_job_patch ? 'draft_payload' THEN p_job_patch->'draft_payload' ELSE draft_payload END,
      error = CASE WHEN p_job_patch ? 'error' THEN p_job_patch->>'error' ELSE error END,
      lease_token = CASE WHEN COALESCE(p_job_patch->>'status', 'running') = 'running' THEN lease_token ELSE NULL END,
      updated_at = now()
    WHERE id = j.id;
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.sdr_commit_turn(uuid, uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_commit_turn(uuid, uuid, jsonb, jsonb, jsonb, jsonb) TO service_role;