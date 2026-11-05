-- Additive hardening: no automatic reversal without persisted source version.
CREATE OR REPLACE FUNCTION public.project_links_revert(p_ws uuid,p_kind text,p_subject_ids uuid[],p_batch uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM public.project_link_review_access(p_ws,true);
  IF p_kind='batch' AND EXISTS(SELECT 1 FROM public.project_link_batches WHERE workspace_id=p_ws AND id=p_batch AND counts->>'mode'='reviewed') THEN RETURN public.project_link_review_revert(p_ws,p_batch); END IF;
  IF EXISTS(SELECT 1 FROM public.project_link_changes c JOIN public.project_link_review_rows r ON r.workspace_id=c.workspace_id AND r.target_id=c.target_id AND r.reverted_at IS NULL WHERE c.workspace_id=p_ws AND c.reverted_at IS NULL AND ((p_kind='batch' AND c.batch_id=p_batch) OR (p_kind='person' AND c.field IN ('person_id','allocation_id') AND c.subject_id=ANY(p_subject_ids)) OR (p_kind='company' AND c.field='company_id' AND c.subject_id=ANY(p_subject_ids)))) THEN RAISE EXCEPTION 'Reverta os lotes assistidos individualmente para preservar edições posteriores.'; END IF;
  IF EXISTS(SELECT 1 FROM public.project_link_changes c WHERE c.workspace_id=p_ws AND c.reverted_at IS NULL AND ((p_kind='batch' AND c.batch_id=p_batch) OR (p_kind='person' AND c.field IN ('person_id','allocation_id') AND c.subject_id=ANY(p_subject_ids)) OR (p_kind='company' AND c.field='company_id' AND c.subject_id=ANY(p_subject_ids)))) THEN RAISE EXCEPTION 'Lote histórico sem versão da origem: exige revisão manual. Nenhum vínculo foi removido.';END IF;
  RETURN public.project_links_revert_before_review(p_ws,p_kind,p_subject_ids,p_batch);
END $$;
REVOKE ALL ON FUNCTION public.project_links_revert(uuid,text,uuid[],uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_links_revert(uuid,text,uuid[],uuid) TO authenticated;
-- The former unbounded endpoint cannot create new unversioned batches.
CREATE OR REPLACE FUNCTION public.project_links_apply_exact(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.project_link_review_access(p_ws,true);
 RAISE EXCEPTION 'Use Lotes assistidos: consulte a prévia e selecione até 100 registros.';
END $$;
REVOKE ALL ON FUNCTION public.project_links_apply_exact(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_links_apply_exact(uuid) TO authenticated;
