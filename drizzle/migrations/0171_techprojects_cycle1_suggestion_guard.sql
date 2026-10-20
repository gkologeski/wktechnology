-- Confirmação de sugestão recusa casos que não seriam aplicados (pessoa já usada, empresa já definida).
CREATE OR REPLACE FUNCTION public.project_link_suggestions_decide(p_ws uuid, p_ids uuid[], p_action text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch uuid; v_applied int := 0; v_n int := 0; v_dup int;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  IF p_action NOT IN ('confirm','reject') THEN RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023'; END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 OR cardinality(p_ids) > 1000 THEN
    RAISE EXCEPTION 'Selecione entre 1 e 1000 sugestões.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_links:' || p_ws::text));
  PERFORM set_config('app.project_link_backfill', 'on', true);
  INSERT INTO public.project_link_batches (workspace_id, kind, actor)
    VALUES (p_ws, CASE WHEN p_action = 'confirm' THEN 'confirm_suggestion' ELSE 'reject_suggestion' END, auth.uid())
    RETURNING id INTO v_batch;

  IF p_action = 'reject' THEN
    UPDATE public.project_link_suggestions SET status = 'rejected', note = nullif(btrim(p_note), ''),
           decided_by = auth.uid(), decided_at = now(), updated_at = now()
     WHERE workspace_id = p_ws AND id = ANY (p_ids) AND status = 'suggested';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.project_link_batches SET counts = jsonb_build_object('rejected', v_n) WHERE id = v_batch;
    RETURN jsonb_build_object('rejected', v_n, 'batch_id', v_batch);
  END IF;

  SELECT count(*) - count(DISTINCT (kind, subject_id)) INTO v_dup
    FROM public.project_link_suggestions WHERE workspace_id = p_ws AND id = ANY (p_ids) AND status = 'suggested';
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'Escolha só um candidato por registro.' USING ERRCODE = '22023';
  END IF;
  -- Confirmar nunca marca como aplicada uma sugestão que não pode ser aplicada.
  IF (SELECT count(*) - count(DISTINCT candidate_id) FROM public.project_link_suggestions
       WHERE workspace_id = p_ws AND id = ANY (p_ids) AND status = 'suggested' AND kind = 'person') > 0 THEN
    RAISE EXCEPTION 'A mesma pessoa foi escolhida para mais de um usuário.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_link_suggestions s
              WHERE s.workspace_id = p_ws AND s.id = ANY (p_ids) AND s.status = 'suggested' AND s.kind = 'person'
                AND (EXISTS (SELECT 1 FROM public.project_time_entries x
                              WHERE x.workspace_id = p_ws AND x.person_id = s.candidate_id AND x.user_id <> s.subject_id)
                  OR EXISTS (SELECT 1 FROM public.project_time_entries x
                              WHERE x.workspace_id = p_ws AND x.user_id = s.subject_id
                                AND x.person_id IS NOT NULL AND x.person_id <> s.candidate_id))) THEN
    RAISE EXCEPTION 'Uma das pessoas já está ligada a outro usuário (ou o usuário já tem outra pessoa). Desvincule antes ou recuse a sugestão.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_link_suggestions s
               JOIN public.projects p ON p.id = s.subject_id AND p.workspace_id = p_ws
              WHERE s.workspace_id = p_ws AND s.id = ANY (p_ids) AND s.status = 'suggested' AND s.kind = 'company'
                AND p.company_id IS NOT NULL AND p.company_id <> s.candidate_id) THEN
    RAISE EXCEPTION 'O projeto já tem outra empresa. Desvincule antes de confirmar.' USING ERRCODE = '22023';
  END IF;

  WITH s AS (
    SELECT s.* FROM public.project_link_suggestions s
      JOIN public.companies c ON c.id = s.candidate_id AND c.workspace_id = p_ws AND c.deleted_at IS NULL
     WHERE s.workspace_id = p_ws AND s.id = ANY (p_ids) AND s.status = 'suggested' AND s.kind = 'company'),
  upd AS (
    UPDATE public.projects p SET company_id = s.candidate_id FROM s
     WHERE p.id = s.subject_id AND p.workspace_id = p_ws AND p.company_id IS NULL
    RETURNING p.id, s.candidate_id, s.provider, s.id AS sid)
  INSERT INTO public.project_link_changes (workspace_id, batch_id, target_table, target_id, field, subject_id,
    old_value, new_value, criterion, provider, evidence, actor)
  SELECT p_ws, v_batch, 'projects', upd.id, 'company_id', upd.id, NULL, upd.candidate_id, 'confirmed_suggestion',
         upd.provider, jsonb_build_object('suggestion_id', upd.sid, 'note', nullif(btrim(p_note), '')), auth.uid() FROM upd;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_applied := v_applied + v_n;

  WITH s AS (
    SELECT s.* FROM public.project_link_suggestions s
      JOIN public.people pe ON pe.id = s.candidate_id AND pe.workspace_id = p_ws
     WHERE s.workspace_id = p_ws AND s.id = ANY (p_ids) AND s.status = 'suggested' AND s.kind = 'person'
       AND NOT EXISTS (SELECT 1 FROM public.project_time_entries x
                        WHERE x.workspace_id = p_ws AND x.person_id = s.candidate_id AND x.user_id <> s.subject_id)),
  upd AS (
    UPDATE public.project_time_entries e SET person_id = s.candidate_id FROM s
     WHERE e.workspace_id = p_ws AND e.user_id = s.subject_id AND e.person_id IS NULL
    RETURNING e.id, e.user_id, s.candidate_id, s.id AS sid)
  INSERT INTO public.project_link_changes (workspace_id, batch_id, target_table, target_id, field, subject_id,
    old_value, new_value, criterion, provider, evidence, actor)
  SELECT p_ws, v_batch, 'project_time_entries', upd.id, 'person_id', upd.user_id, NULL, upd.candidate_id,
         'confirmed_suggestion', NULL, jsonb_build_object('suggestion_id', upd.sid, 'note', nullif(btrim(p_note), '')),
         auth.uid() FROM upd;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_applied := v_applied + v_n;

  UPDATE public.project_link_suggestions SET status = 'confirmed', note = nullif(btrim(p_note), ''),
         decided_by = auth.uid(), decided_at = now(), updated_at = now()
   WHERE workspace_id = p_ws AND id = ANY (p_ids) AND status = 'suggested';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.project_link_batches SET counts = jsonb_build_object('confirmed', v_n, 'rows_linked', v_applied)
   WHERE id = v_batch;
  RETURN jsonb_build_object('confirmed', v_n, 'rows_linked', v_applied, 'batch_id', v_batch);
END $$;
REVOKE ALL ON FUNCTION public.project_link_suggestions_decide(uuid, uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_link_suggestions_decide(uuid, uuid[], text, text) TO authenticated, service_role;
