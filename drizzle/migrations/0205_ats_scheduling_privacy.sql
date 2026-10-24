-- Busy-time metadata is deliberately independent of candidate/interview contents.
CREATE OR REPLACE FUNCTION public.ats_schedule_metadata_access(_workspace uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(auth.uid() IS NOT NULL AND _workspace=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND is_workspace_member(_workspace,auth.uid()) AND _workspace IN(SELECT current_user_workspaces()) AND user_has_permission(auth.uid(),_workspace,'techhire.interviews.view.workspace') AND user_has_permission(auth.uid(),_workspace,'techhire.interviews.schedule.workspace'),false)
$$;
CREATE OR REPLACE FUNCTION public.ats_busy_intervals(_interviewers uuid[],_from timestamptz,_to timestamptz)
RETURNS TABLE(interviewer_id uuid,starts_at timestamptz,ends_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE w uuid:=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid());
BEGIN
 IF NOT public.ats_schedule_metadata_access(w) OR _interviewers IS NULL OR cardinality(_interviewers) NOT BETWEEN 1 AND 8 OR EXISTS(SELECT 1 FROM unnest(_interviewers)x WHERE x IS NULL OR NOT public.is_workspace_member(w,x)) THEN RAISE EXCEPTION 'Consulta de agenda não permitida.' USING ERRCODE='42501';END IF;
 IF _from IS NULL OR _to IS NULL OR _to<=_from OR _to-_from>interval '31 days' THEN RAISE EXCEPTION 'Intervalo de agenda inválido (máximo 31 dias).' USING ERRCODE='22023';END IF;
 RETURN QUERY SELECT DISTINCT target.u,greatest(i.scheduled_at,_from),least(i.scheduled_at+make_interval(mins=>i.duration_min),_to)
 FROM ats_interviews i CROSS JOIN LATERAL unnest(ARRAY[i.interviewer_id]||COALESCE(i.panel_interviewer_ids,ARRAY[]::uuid[]))target(u)
 WHERE i.workspace_id=w AND target.u=ANY(_interviewers) AND i.status IN('scheduled','pending_candidate') AND i.scheduled_at<_to AND i.scheduled_at+make_interval(mins=>i.duration_min)>_from;
END $$;
CREATE SCHEMA IF NOT EXISTS techerp_scheduling;
REVOKE ALL ON SCHEMA techerp_scheduling FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS techerp_scheduling.rotation_sessions(txid bigint PRIMARY KEY,user_id uuid NOT NULL,pool_id uuid NOT NULL);
REVOKE ALL ON techerp_scheduling.rotation_sessions FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ats_assign_interviewer_pool(_pool uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w uuid:=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid());p public.ats_interviewer_pools;chosen uuid;ids uuid[];n integer;
BEGIN
 IF NOT public.ats_schedule_metadata_access(w) OR public.is_read_only_view() THEN RAISE EXCEPTION 'Distribuição não permitida.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM ats_interviewer_pools WHERE id=_pool AND workspace_id=w FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pool indisponível.' USING ERRCODE='42501';END IF;
 SELECT array_agg(m.interviewer_id ORDER BY m.id) INTO ids FROM ats_interviewer_pool_members m WHERE m.pool_id=p.id AND m.workspace_id=w AND m.weight>0 AND public.is_workspace_member(w,m.interviewer_id);
 n:=cardinality(ids);IF n IS NULL OR n=0 THEN RAISE EXCEPTION 'Pool sem membros ativos.' USING ERRCODE='22023';END IF;
 IF p.rotation_strategy='round_robin' THEN
  chosen:=ids[(p.rotation_cursor%n)+1];
  INSERT INTO techerp_scheduling.rotation_sessions VALUES(txid_current(),auth.uid(),p.id) ON CONFLICT(txid) DO UPDATE SET user_id=excluded.user_id,pool_id=excluded.pool_id;
  UPDATE ats_interviewer_pools SET rotation_cursor=(p.rotation_cursor+1)%n WHERE id=p.id;
  DELETE FROM techerp_scheduling.rotation_sessions WHERE txid=txid_current();
 ELSE
  SELECT m.interviewer_id INTO chosen FROM ats_interviewer_pool_members m
  LEFT JOIN LATERAL (SELECT count(*) AS total FROM ats_interviews i WHERE i.workspace_id=w AND i.status IN('scheduled','pending_candidate','done') AND i.scheduled_at>=now()-make_interval(days=>p.load_window_days) AND (i.interviewer_id=m.interviewer_id OR m.interviewer_id=ANY(i.panel_interviewer_ids))) load ON true
  WHERE m.pool_id=p.id AND m.workspace_id=w AND m.interviewer_id=ANY(ids) ORDER BY load.total::numeric/greatest(m.weight,1),m.id LIMIT 1;
 END IF;
 RETURN chosen;
END $$;
-- The definer can update ONLY the rotation counter on behalf of a scheduler.
-- The configuration guard still protects every other field and all user DML.
CREATE OR REPLACE FUNCTION public.ats_pool_rotation_only(_old jsonb,_new jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT (_old-'rotation_cursor'-'updated_at')=(_new-'rotation_cursor'-'updated_at') $$;
-- Do not permit the caller to forge a custom setting as a service identity.
-- The RPC temporarily sets an attestation in a protected transaction-bound table.

CREATE OR REPLACE FUNCTION public.ats_configuration_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE resource text;subject uuid;actor uuid:=auth.uid();r jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; item jsonb;seen text[]:=ARRAY[]::text[];key text;
BEGIN
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='ats_interviewer_pools' AND public.ats_pool_rotation_only(to_jsonb(OLD),to_jsonb(NEW)) AND EXISTS(SELECT 1 FROM techerp_scheduling.rotation_sessions a WHERE a.txid=txid_current_if_assigned() AND a.user_id=actor AND a.pool_id=NEW.id) AND public.ats_schedule_metadata_access(NEW.workspace_id) AND NOT public.is_read_only_view() THEN RETURN NEW;END IF;
 resource:=CASE TG_TABLE_NAME WHEN 'ats_scorecards' THEN 'scorecards' WHEN 'ats_interview_kits' THEN 'interview_kits' WHEN 'ats_interviewer_availability' THEN 'interviewer_availability' ELSE 'interviewer_pools' END;
 subject:=(r->>CASE WHEN resource='interviewer_availability' THEN 'interviewer_id' ELSE 'owner_id' END)::uuid;
 IF TG_OP='UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.id IS DISTINCT FROM OLD.id) THEN RAISE EXCEPTION 'Autoria e workspace são imutáveis.' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='ats_interviewer_pool_members' AND (r->>'pool_id' IS DISTINCT FROM to_jsonb(OLD)->>'pool_id' OR r->>'interviewer_id' IS DISTINCT FROM to_jsonb(OLD)->>'interviewer_id') THEN RAISE EXCEPTION 'Vínculos do membro são imutáveis.' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' AND resource='interviewer_availability' AND r->>'interviewer_id' IS DISTINCT FROM to_jsonb(OLD)->>'interviewer_id' THEN RAISE EXCEPTION 'Entrevistador da janela é imutável.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='ats_interviewer_pool_members' THEN
  IF TG_OP='DELETE' AND pg_trigger_depth()>1 AND NOT EXISTS(SELECT 1 FROM ats_interviewer_pools WHERE id=OLD.pool_id) THEN RETURN OLD;END IF;
  IF NOT EXISTS(SELECT 1 FROM ats_interviewer_pools p WHERE p.id=(r->>'pool_id')::uuid AND p.workspace_id=(r->>'workspace_id')::uuid AND (actor IS NULL OR public.ats_config_action_access(p.workspace_id,'interviewer_pools','update',p.owner_id))) THEN RAISE EXCEPTION 'Alteração do pool não permitida.' USING ERRCODE='42501';END IF;
 ELSIF actor IS NOT NULL AND NOT public.ats_config_action_access((r->>'workspace_id')::uuid,resource,CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END,subject) THEN RAISE EXCEPTION 'Ação não permitida para esta configuração.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN
  IF resource='scorecards' AND EXISTS(SELECT 1 FROM ats_scorecard_responses WHERE scorecard_id=OLD.id) THEN RAISE EXCEPTION 'Modelo possui avaliações; desative-o para preservar o histórico.' USING ERRCODE='23514';END IF;
  IF resource='interview_kits' AND EXISTS(SELECT 1 FROM ats_interviews WHERE interview_kit_id=OLD.id) THEN RAISE EXCEPTION 'Kit possui entrevistas; desative-o para preservar o histórico.' USING ERRCODE='23514';END IF;
  IF resource='interviewer_pools' AND TG_TABLE_NAME='ats_interviewer_pools' AND EXISTS(SELECT 1 FROM ats_interviews WHERE pool_id=OLD.id) THEN RAISE EXCEPTION 'Pool possui entrevistas vinculadas.' USING ERRCODE='23514';END IF;
  RETURN OLD;
 END IF;
 IF actor IS NOT NULL AND TG_OP='INSERT' AND NEW.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Autoria inválida.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME<>'ats_interviewer_pool_members' AND resource<>'interviewer_availability' AND length(trim(COALESCE(r->>'name',''))) NOT BETWEEN 1 AND (CASE WHEN resource='scorecards' THEN 100 ELSE 120 END) THEN RAISE EXCEPTION 'Nome inválido.' USING ERRCODE='22023';END IF;
 IF resource='scorecards' THEN
  IF r->>'job_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ats_jobs WHERE id=(r->>'job_id')::uuid AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Vaga fora do workspace.' USING ERRCODE='23514';END IF;
  IF TG_OP='UPDATE' AND (NEW.criteria IS DISTINCT FROM OLD.criteria OR NEW.job_id IS DISTINCT FROM OLD.job_id) AND EXISTS(SELECT 1 FROM ats_scorecard_responses WHERE scorecard_id=OLD.id) THEN RAISE EXCEPTION 'Duplique o modelo para alterar critérios já utilizados.' USING ERRCODE='23514';END IF;
  IF jsonb_typeof(NEW.criteria) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.criteria) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Critérios inválidos.' USING ERRCODE='22023';END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.criteria) LOOP
   key:=item->>'key';IF key IS NULL OR length(key) NOT BETWEEN 1 AND 40 OR key=ANY(seen) OR length(COALESCE(item->>'label','')) NOT BETWEEN 1 AND 80 OR jsonb_typeof(item->'weight') IS DISTINCT FROM 'number' OR (item->>'weight')::numeric NOT BETWEEN 0.1 AND 10 THEN RAISE EXCEPTION 'Critério inválido ou duplicado.' USING ERRCODE='22023';END IF;seen:=array_append(seen,key);
  END LOOP;
 ELSIF resource='interview_kits' THEN
  IF NEW.pipeline_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ats_pipelines WHERE id=NEW.pipeline_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Funil fora do workspace.' USING ERRCODE='23514';END IF;
  IF TG_OP='UPDATE' AND (NEW.questions IS DISTINCT FROM OLD.questions OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id OR NEW.stage_value IS DISTINCT FROM OLD.stage_value) AND EXISTS(SELECT 1 FROM ats_interviews WHERE interview_kit_id=OLD.id) THEN RAISE EXCEPTION 'Duplique o kit para alterar perguntas já utilizadas.' USING ERRCODE='23514';END IF;
  IF jsonb_typeof(NEW.questions) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.questions) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Perguntas inválidas.' USING ERRCODE='22023';END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.questions) LOOP
   key:=item->>'id';IF key IS NULL OR length(key) NOT BETWEEN 1 AND 40 OR key=ANY(seen) OR length(COALESCE(item->>'text','')) NOT BETWEEN 1 AND 2000 OR COALESCE(item->>'kind','text') NOT IN('text','video') OR (item ? 'time_limit_sec' AND (jsonb_typeof(item->'time_limit_sec')<>'number' OR (item->>'time_limit_sec')::numeric NOT BETWEEN 15 AND 600)) OR (item ? 'max_takes' AND (jsonb_typeof(item->'max_takes')<>'number' OR (item->>'max_takes')::numeric NOT BETWEEN 1 AND 5)) THEN RAISE EXCEPTION 'Pergunta inválida ou duplicada.' USING ERRCODE='22023';END IF;seen:=array_append(seen,key);
  END LOOP;
  IF actor IS NOT NULL AND (NEW.is_default OR (TG_OP='UPDATE' AND OLD.is_default)) AND (TG_OP='INSERT' OR NEW.is_default IS DISTINCT FROM OLD.is_default OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id OR NEW.stage_value IS DISTINCT FROM OLD.stage_value) AND NOT (public.user_has_permission(actor,NEW.workspace_id,'techhire.interview_kits.view.workspace') AND public.user_has_permission(actor,NEW.workspace_id,'techhire.interview_kits.update.workspace')) THEN RAISE EXCEPTION 'Alterar padrão exige edição do workspace.' USING ERRCODE='42501';END IF;
  IF NEW.is_default THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text||COALESCE(NEW.pipeline_id::text,'')||COALESCE(NEW.stage_value,''),0));
   IF EXISTS(SELECT 1 FROM ats_interview_kits k WHERE k.workspace_id=NEW.workspace_id AND k.pipeline_id IS NOT DISTINCT FROM NEW.pipeline_id AND k.stage_value IS NOT DISTINCT FROM NEW.stage_value AND k.is_default AND k.id<>NEW.id) THEN RAISE EXCEPTION 'Já existe um kit padrão neste contexto.' USING ERRCODE='23505';END IF;
  END IF;
  IF NOT NEW.is_active AND NEW.is_default THEN RAISE EXCEPTION 'Kit inativo não pode ser padrão.' USING ERRCODE='23514';END IF;
 ELSIF resource='interviewer_availability' OR TG_TABLE_NAME='ats_interviewer_pool_members' THEN
  IF NOT public.is_workspace_member(NEW.workspace_id,NEW.interviewer_id) THEN RAISE EXCEPTION 'Entrevistador deve ser membro ativo do workspace.' USING ERRCODE='23514';END IF;
  IF resource='interviewer_availability' THEN
   IF (NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) OR NEW.weekday NOT BETWEEN 0 AND 6 OR NEW.start_minute<0 OR NEW.end_minute>1440 OR NEW.end_minute<=NEW.start_minute) THEN RAISE EXCEPTION 'Janela ou fuso inválido.' USING ERRCODE='22023';END IF;
  ELSE
   IF NEW.weight NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Peso inválido.' USING ERRCODE='22023';END IF;
  END IF;
 ELSE
  IF NEW.rotation_strategy NOT IN('round_robin','load_balanced') OR NEW.load_window_days NOT BETWEEN 1 AND 90 OR NEW.rotation_cursor<0 THEN RAISE EXCEPTION 'Rotação inválida.' USING ERRCODE='22023';END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ats_busy_intervals(uuid[],timestamptz,timestamptz),public.ats_assign_interviewer_pool(uuid),public.ats_schedule_metadata_access(uuid),public.ats_pool_rotation_only(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_busy_intervals(uuid[],timestamptz,timestamptz),public.ats_assign_interviewer_pool(uuid),public.ats_schedule_metadata_access(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
CREATE OR REPLACE FUNCTION public.ats_availability_create_targets()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.user_id FROM workspace_members m WHERE m.workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) AND m.status='active' AND public.ats_config_action_access(m.workspace_id,'interviewer_availability','create',m.user_id)
$$;
REVOKE ALL ON FUNCTION public.ats_availability_create_targets() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_availability_create_targets() TO authenticated;

CREATE OR REPLACE FUNCTION public.ats_active_interview_model_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='ats_interviews' THEN
  IF NEW.interview_kit_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.interview_kit_id IS DISTINCT FROM OLD.interview_kit_id) THEN PERFORM id FROM ats_interview_kits WHERE id=NEW.interview_kit_id AND workspace_id=NEW.workspace_id FOR SHARE;END IF;
  IF NEW.interview_kit_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.interview_kit_id IS DISTINCT FROM OLD.interview_kit_id) AND NOT EXISTS(SELECT 1 FROM ats_interview_kits WHERE id=NEW.interview_kit_id AND workspace_id=NEW.workspace_id AND is_active) THEN RAISE EXCEPTION 'Kit inativo ou indisponível.' USING ERRCODE='23514';END IF;
 ELSE
  IF TG_OP='INSERT' THEN PERFORM id FROM ats_scorecards WHERE id=NEW.scorecard_id AND workspace_id=NEW.workspace_id FOR SHARE;END IF;
  IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM ats_scorecards WHERE id=NEW.scorecard_id AND workspace_id=NEW.workspace_id AND is_active) THEN RAISE EXCEPTION 'Modelo inativo ou indisponível.' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER zzz_ats_active_kit BEFORE INSERT OR UPDATE ON ats_interviews FOR EACH ROW EXECUTE FUNCTION public.ats_active_interview_model_guard();
CREATE TRIGGER zzz_ats_active_scorecard BEFORE INSERT ON ats_scorecard_responses FOR EACH ROW EXECUTE FUNCTION public.ats_active_interview_model_guard();
-- All booking entrances (including public token confirmation) serialize on the
-- actual panel members, then inspect busy rows without revealing candidate PII.
CREATE OR REPLACE FUNCTION public.ats_interview_conflict_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE staff uuid[];u uuid;
BEGIN
 IF NEW.status NOT IN('scheduled','pending_candidate') OR NEW.scheduled_at IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at AND NEW.duration_min IS NOT DISTINCT FROM OLD.duration_min AND NEW.interviewer_id IS NOT DISTINCT FROM OLD.interviewer_id AND NEW.panel_interviewer_ids IS NOT DISTINCT FROM OLD.panel_interviewer_ids THEN RETURN NEW;END IF;
 SELECT array_agg(DISTINCT x ORDER BY x) INTO staff FROM unnest(ARRAY[NEW.interviewer_id]||COALESCE(NEW.panel_interviewer_ids,ARRAY[]::uuid[]))x WHERE x IS NOT NULL;
 FOR u IN SELECT x FROM unnest(staff)x ORDER BY x LOOP PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text||u::text,0));END LOOP;
 IF EXISTS(SELECT 1 FROM ats_interviews i WHERE i.workspace_id=NEW.workspace_id AND i.id<>NEW.id AND i.status IN('scheduled','pending_candidate') AND i.scheduled_at<NEW.scheduled_at+make_interval(mins=>NEW.duration_min) AND i.scheduled_at+make_interval(mins=>i.duration_min)>NEW.scheduled_at AND (i.interviewer_id=ANY(staff) OR COALESCE(i.panel_interviewer_ids,ARRAY[]::uuid[])&&staff)) THEN RAISE EXCEPTION 'Agenda ocupada para um dos entrevistadores. Consulte novos horários.' USING ERRCODE='23P01';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzzz_ats_interview_conflict BEFORE INSERT OR UPDATE ON ats_interviews FOR EACH ROW EXECUTE FUNCTION public.ats_interview_conflict_guard();
REVOKE ALL ON FUNCTION public.ats_interview_conflict_guard(),public.ats_active_interview_model_guard(),public.ats_configuration_guard() FROM PUBLIC,anon,authenticated;
