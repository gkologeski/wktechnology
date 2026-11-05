-- Stage 6B: bounded, explicitly reviewed links. No import, approval or billing mutation.
CREATE TABLE public.project_link_review_rows (
  batch_id uuid NOT NULL REFERENCES public.project_link_batches(id),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  target_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('company','time')),
  before_values jsonb NOT NULL,
  after_values jsonb NOT NULL,
  after_xmin text NOT NULL,
  reverted_at timestamptz,
  PRIMARY KEY(batch_id,target_id)
);
ALTER TABLE public.project_link_review_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_link_review_rows FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.project_link_review_access(w uuid,writing boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(w,auth.uid())
    OR NOT public.user_has_permission(auth.uid(),w,'techprojects.reconciliation.'||CASE WHEN writing THEN 'manage' ELSE 'view' END||'.workspace')
  THEN RAISE EXCEPTION 'Sem permissão para conciliar.' USING ERRCODE='42501'; END IF;
  PERFORM public.project_recon_assert_admin(w,writing);
END $$;

-- Internal, exact evidence for ONE locked row. Never match approximate names.
CREATE OR REPLACE FUNCTION public.project_link_review_candidate(w uuid,k text,target uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.projects; e public.project_time_entries; person uuid; allocation uuid;
  companies uuid[]; v_email text; label text; token text; n int; before_values jsonb; after_values jsonb;
BEGIN
  IF k='company' THEN
    SELECT x.* INTO p FROM public.projects x WHERE x.workspace_id=w AND x.id=target;
    SELECT x.xmin::text INTO token FROM public.projects x WHERE x.workspace_id=w AND x.id=target;
    IF p.id IS NULL OR p.company_id IS NOT NULL THEN RETURN NULL; END IF;
    SELECT array_agg(DISTINCT c.id) INTO companies
    FROM (VALUES ('clockify',p.metadata->'clockify'),('jibble',p.metadata->'jibble')) src(provider,m)
    JOIN public.companies c ON c.id::text=src.m->>'company_id' AND c.workspace_id=w AND c.deleted_at IS NULL
    WHERE NOT EXISTS(SELECT 1 FROM public.clockify_mappings m WHERE src.provider='clockify' AND m.workspace_id=w AND m.entity_type='client' AND m.external_id=src.m->>'client_id' AND m.target_id IS NOT NULL AND m.target_id<>c.id)
      AND NOT EXISTS(SELECT 1 FROM public.time_import_mappings m WHERE src.provider='jibble' AND m.workspace_id=w AND m.entity_type='client' AND m.external_id=src.m->>'client_id' AND m.target_id IS NOT NULL AND m.target_id<>c.id);
    IF cardinality(companies)<>1 OR companies IS NULL OR
      (p.metadata?'clockify' AND p.metadata?'jibble' AND p.metadata->'clockify'->>'company_id' IS DISTINCT FROM p.metadata->'jibble'->>'company_id') THEN RETURN NULL; END IF;
    before_values:=jsonb_build_object('company_id',NULL); after_values:=jsonb_build_object('company_id',companies[1]); label:=p.name||' → '||(SELECT c.name FROM public.companies c WHERE c.id=companies[1] AND c.workspace_id=w);
  ELSIF k='time' THEN
    SELECT x.* INTO e FROM public.project_time_entries x WHERE x.workspace_id=w AND x.id=target;
    SELECT x.xmin::text INTO token FROM public.project_time_entries x WHERE x.workspace_id=w AND x.id=target;
    IF e.id IS NULL THEN RETURN NULL; END IF;
    person:=e.person_id; allocation:=e.allocation_id;
    IF person IS NULL THEN
      SELECT lower(btrim(u.email)) INTO v_email FROM auth.users u JOIN public.workspace_members m ON m.user_id=u.id AND m.workspace_id=w WHERE u.id=e.user_id;
      IF v_email IS NOT NULL AND v_email<>'' THEN
        SELECT count(*) INTO n FROM public.workspace_members m JOIN auth.users u ON u.id=m.user_id WHERE m.workspace_id=w AND lower(btrim(u.email))=v_email;
        IF n=1 THEN
          SELECT count(*),min(x.id::text)::uuid INTO n,person FROM public.people x WHERE x.workspace_id=w AND NOT coalesce(x.archived,false) AND lower(btrim(x.email))=v_email;
          IF n<>1 OR EXISTS(SELECT 1 FROM public.people x WHERE x.id=person AND x.profile_id IS NOT NULL AND x.profile_id<>e.user_id)
            OR EXISTS(SELECT 1 FROM public.project_time_entries x WHERE x.workspace_id=w AND ((x.person_id=person AND x.user_id<>e.user_id) OR (x.user_id=e.user_id AND x.person_id IS NOT NULL AND x.person_id<>person))) THEN person:=NULL; END IF;
        END IF;
      END IF;
    END IF;
    IF person IS NOT NULL AND allocation IS NULL THEN
      SELECT count(*),min(a.id::text)::uuid INTO n,allocation FROM public.people_allocations a
      WHERE a.workspace_id=w AND a.person_id=person AND a.project_id=e.project_id AND a.starts_at<=e.entry_date AND (a.ends_at IS NULL OR a.ends_at>=e.entry_date);
      IF n<>1 THEN allocation:=NULL; END IF;
    END IF;
    IF person IS NOT DISTINCT FROM e.person_id AND allocation IS NOT DISTINCT FROM e.allocation_id THEN RETURN NULL; END IF;
    before_values:=jsonb_build_object('person_id',e.person_id,'allocation_id',e.allocation_id);
    after_values:=jsonb_build_object('person_id',person,'allocation_id',allocation); label:=e.entry_date::text||' · '||coalesce((SELECT x.name FROM public.projects x WHERE x.id=e.project_id AND x.workspace_id=w),'Projeto')||' → '||coalesce((SELECT x.full_name FROM public.people x WHERE x.id=person AND x.workspace_id=w),'Pessoa');
  ELSE RAISE EXCEPTION 'Tipo inválido.' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('id',target,'kind',k,'label',label,'token',token,'before',before_values,'after',after_values);
END $$;

CREATE OR REPLACE FUNCTION public.project_link_review_preview(w uuid,k text,d1 date,d2 date,cursor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET statement_timeout='15s' AS $$
DECLARE result jsonb; last_id uuid;
BEGIN
  PERFORM public.project_link_review_access(w,false);
  IF k IS NULL OR k NOT IN ('company','time') OR d1 IS NULL OR d2 IS NULL OR d2<d1 OR d2-d1>93 THEN RAISE EXCEPTION 'Informe período de até 94 dias.' USING ERRCODE='22023'; END IF;
  -- Page source rows, not only candidates, to keep work bounded even in ambiguous history.
  WITH page AS (
    SELECT id FROM public.projects WHERE k='company' AND workspace_id=w AND company_id IS NULL AND (cursor_id IS NULL OR id>cursor_id)
    UNION ALL SELECT id FROM public.project_time_entries WHERE k='time' AND workspace_id=w AND entry_date BETWEEN d1 AND d2 AND (person_id IS NULL OR allocation_id IS NULL) AND (cursor_id IS NULL OR id>cursor_id)
    ORDER BY id LIMIT 100
  ), candidates AS (SELECT id,public.project_link_review_candidate(w,k,id) value FROM page)
  SELECT coalesce(jsonb_agg(value ORDER BY id) FILTER(WHERE value IS NOT NULL),'[]'::jsonb),max(id::text)::uuid INTO result,last_id FROM candidates;
  RETURN jsonb_build_object('rows',result,'cursor',last_id,'review_note','Sem evidência única: use Pendências/Vínculos. Vínculo comercial: aba Negócios.');
END $$;

CREATE OR REPLACE FUNCTION public.project_link_review_apply(w uuid,batch uuid,reviewed jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET statement_timeout='15s' AS $$
DECLARE item jsonb; actual jsonb; token text; changed int:=0; field text; target uuid; kind text; prior jsonb;
BEGIN
  PERFORM public.project_link_review_access(w,true);
  IF batch IS NULL OR reviewed IS NULL OR jsonb_typeof(reviewed)<>'array' OR jsonb_array_length(reviewed) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Selecione 1 a 100 registros.' USING ERRCODE='22023'; END IF;
  IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(reviewed) x)<>jsonb_array_length(reviewed) THEN RAISE EXCEPTION 'Registros repetidos.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_links:'||w::text));
  SELECT counts INTO prior FROM public.project_link_batches WHERE id=batch AND workspace_id=w;
  IF FOUND THEN
    IF prior->'reviewed' IS DISTINCT FROM reviewed THEN RAISE EXCEPTION 'Lote já utilizado com outra seleção.'; END IF;
    RETURN prior;
  END IF;
  LOCK TABLE public.project_time_entries IN SHARE ROW EXCLUSIVE MODE;
  INSERT INTO public.project_link_batches(id,workspace_id,kind,actor,counts) VALUES(batch,w,'apply_exact',auth.uid(),jsonb_build_object('mode','reviewed','reviewed',reviewed));
  PERFORM set_config('app.project_link_backfill','on',true);
  FOR item IN SELECT value FROM jsonb_array_elements(reviewed) ORDER BY value->>'id' LOOP
    target:=(item->>'id')::uuid; kind:=item->>'kind';
    IF kind='company' THEN PERFORM 1 FROM public.projects WHERE id=target AND workspace_id=w FOR UPDATE;
    ELSIF kind='time' THEN PERFORM 1 FROM public.project_time_entries WHERE id=target AND workspace_id=w FOR UPDATE;
    ELSE RAISE EXCEPTION 'Tipo inválido.'; END IF;
    LOCK TABLE public.people,public.people_allocations,public.workspace_members,public.companies,public.clockify_mappings,public.time_import_mappings,auth.users IN SHARE MODE;
    actual:=public.project_link_review_candidate(w,kind,target);
    IF actual IS NULL OR actual IS DISTINCT FROM item THEN RAISE EXCEPTION 'Prévia desatualizada. Consulte novamente antes de aplicar.' USING ERRCODE='40001'; END IF;
    IF kind='company' THEN UPDATE public.projects SET company_id=(actual->'after'->>'company_id')::uuid WHERE id=target AND workspace_id=w RETURNING xmin::text INTO token;
    ELSE UPDATE public.project_time_entries SET person_id=(actual->'after'->>'person_id')::uuid,allocation_id=(actual->'after'->>'allocation_id')::uuid WHERE id=target AND workspace_id=w RETURNING xmin::text INTO token; END IF;
    INSERT INTO public.project_link_review_rows VALUES(batch,w,target,kind,actual->'before',actual->'after',token,NULL);
    FOR field IN SELECT jsonb_object_keys(actual->'after') LOOP
      IF actual->'before'->field IS DISTINCT FROM actual->'after'->field THEN
        INSERT INTO public.project_link_changes(workspace_id,batch_id,target_table,target_id,field,subject_id,old_value,new_value,criterion,evidence,actor)
        VALUES(w,batch,CASE WHEN kind='company' THEN 'projects' ELSE 'project_time_entries' END,target,field,CASE WHEN kind='company' THEN target ELSE (SELECT user_id FROM public.project_time_entries WHERE id=target AND workspace_id=w) END,(actual->'before'->>field)::uuid,(actual->'after'->>field)::uuid,'reviewed_exact',jsonb_build_object('after_xmin',token),auth.uid());
      END IF;
    END LOOP;
    changed:=changed+1;
  END LOOP;
  prior:=jsonb_build_object('mode','reviewed','reviewed',reviewed,'changed',changed,'batch_id',batch);
  UPDATE public.project_link_batches SET counts=prior WHERE id=batch;
  RETURN prior;
END $$;

CREATE OR REPLACE FUNCTION public.project_link_review_revert(w uuid,batch uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.project_link_review_rows; token text; values_now jsonb; undone int:=0; skipped int:=0; rb uuid;
BEGIN
  PERFORM public.project_link_review_access(w,true);
  PERFORM pg_advisory_xact_lock(hashtext('project_links:'||w::text));
  IF NOT EXISTS(SELECT 1 FROM public.project_link_batches WHERE id=batch AND workspace_id=w AND counts->>'mode'='reviewed') THEN RAISE EXCEPTION 'Lote não encontrado.'; END IF;
  INSERT INTO public.project_link_batches(workspace_id,kind,actor) VALUES(w,'revert',auth.uid()) RETURNING id INTO rb;
  PERFORM set_config('app.project_link_backfill','on',true);
  FOR r IN SELECT * FROM public.project_link_review_rows WHERE workspace_id=w AND batch_id=batch AND reverted_at IS NULL ORDER BY target_id FOR UPDATE LOOP
    token:=NULL; values_now:=NULL;
    IF r.kind='company' THEN
      SELECT xmin::text,jsonb_build_object('company_id',company_id) INTO token,values_now FROM public.projects WHERE id=r.target_id AND workspace_id=w FOR UPDATE;
    ELSE
      SELECT xmin::text,jsonb_build_object('person_id',person_id,'allocation_id',allocation_id) INTO token,values_now FROM public.project_time_entries WHERE id=r.target_id AND workspace_id=w FOR UPDATE;
    END IF;
    IF token IS DISTINCT FROM r.after_xmin OR values_now IS DISTINCT FROM r.after_values THEN skipped:=skipped+1; CONTINUE; END IF;
    IF r.kind='company' THEN UPDATE public.projects SET company_id=(r.before_values->>'company_id')::uuid WHERE id=r.target_id AND workspace_id=w;
    ELSE UPDATE public.project_time_entries SET person_id=(r.before_values->>'person_id')::uuid,allocation_id=(r.before_values->>'allocation_id')::uuid WHERE id=r.target_id AND workspace_id=w; END IF;
    UPDATE public.project_link_review_rows SET reverted_at=now() WHERE batch_id=batch AND target_id=r.target_id;
    UPDATE public.project_link_changes SET reverted_at=now(),reverted_by=auth.uid(),revert_batch_id=rb WHERE batch_id=batch AND target_id=r.target_id AND workspace_id=w AND reverted_at IS NULL;
    undone:=undone+1;
  END LOOP;
  UPDATE public.project_link_batches SET counts=jsonb_build_object('reverted',undone,'skipped_changed_since',skipped,'source_batch',batch) WHERE id=rb;
  RETURN jsonb_build_object('reverted',undone,'skipped_changed_since',skipped);
END $$;

CREATE OR REPLACE FUNCTION public.project_link_review_history(w uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.project_link_review_access(w,false);
  SELECT coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) INTO result FROM (
    SELECT x.id,x.created_at,(x.counts->>'changed')::int AS changed,
      EXISTS(SELECT 1 FROM public.project_link_review_rows r WHERE r.batch_id=x.id AND r.workspace_id=w AND r.reverted_at IS NULL) AS reversible
    FROM public.project_link_batches x WHERE x.workspace_id=w AND x.counts->>'mode'='reviewed'
    ORDER BY x.created_at DESC LIMIT 20
  ) b;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.project_link_review_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_link_review_history(uuid) TO authenticated;

-- Keep the canonical legacy entry point, but never let it bypass reviewed-row CAS.
ALTER FUNCTION public.project_links_revert(uuid,text,uuid[],uuid) RENAME TO project_links_revert_before_review;
REVOKE ALL ON FUNCTION public.project_links_revert_before_review(uuid,text,uuid[],uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.project_links_revert(p_ws uuid,p_kind text,p_subject_ids uuid[],p_batch uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.project_link_review_access(p_ws,true);
  IF p_kind='batch' AND EXISTS(SELECT 1 FROM public.project_link_batches WHERE workspace_id=p_ws AND id=p_batch AND counts->>'mode'='reviewed') THEN RETURN public.project_link_review_revert(p_ws,p_batch); END IF;
  IF EXISTS(SELECT 1 FROM public.project_link_changes c JOIN public.project_link_review_rows r ON r.workspace_id=c.workspace_id AND r.target_id=c.target_id AND r.reverted_at IS NULL WHERE c.workspace_id=p_ws AND c.reverted_at IS NULL AND ((p_kind='batch' AND c.batch_id=p_batch) OR (p_kind='person' AND c.field IN ('person_id','allocation_id') AND c.subject_id=ANY(p_subject_ids)) OR (p_kind='company' AND c.field='company_id' AND c.subject_id=ANY(p_subject_ids)))) THEN RAISE EXCEPTION 'Reverta os lotes assistidos individualmente para preservar edições posteriores.'; END IF;
  RETURN public.project_links_revert_before_review(p_ws,p_kind,p_subject_ids,p_batch);
END $$;
REVOKE ALL ON FUNCTION public.project_link_review_access(uuid,boolean),public.project_link_review_candidate(uuid,text,uuid),public.project_link_review_preview(uuid,text,date,date,uuid),public.project_link_review_apply(uuid,uuid,jsonb),public.project_link_review_revert(uuid,uuid),public.project_links_revert(uuid,text,uuid[],uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.project_link_review_candidate(uuid,text,uuid) FROM authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.project_link_review_access(uuid,boolean),public.project_link_review_preview(uuid,text,date,date,uuid),public.project_link_review_apply(uuid,uuid,jsonb),public.project_link_review_revert(uuid,uuid),public.project_links_revert(uuid,text,uuid[],uuid) TO authenticated;
