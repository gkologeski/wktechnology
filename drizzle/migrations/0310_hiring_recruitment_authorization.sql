-- Etapa 3B: uma fonte comercial explícita, sem escolher contratos arbitrariamente.
ALTER TABLE public.ats_jobs ADD COLUMN hiring_contract_id uuid REFERENCES public.contracts(id);
ALTER TABLE public.projects ADD COLUMN signature_gate_governed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.hiring_deal_signature_contract(p_ws uuid,p_deal uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT x.contract_id FROM public.hiring_commercial_contracts x WHERE x.workspace_id=p_ws AND x.deal_id=p_deal AND public.hiring_contract_signature_reason(x.contract_id,p_ws,p_deal) IS NULL
$$;
REVOKE ALL ON FUNCTION public.hiring_deal_signature_contract(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_recruitment_reason(p_ws uuid,p_job uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.ats_jobs;d public.deals;
BEGIN
 SELECT * INTO j FROM public.ats_jobs WHERE id=p_job AND workspace_id=p_ws;
 IF j.id IS NULL THEN RETURN 'Vaga indisponível neste workspace.';END IF;
 IF NOT j.hiring_governed OR NOT EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=p_ws AND signature_gate_enabled) THEN RETURN NULL;END IF;
 IF j.hiring_purpose IS NULL THEN RETURN 'Configure a finalidade da demanda.';END IF;
 IF j.hiring_approval_status<>'approved' THEN RETURN 'A demanda precisa da aprovação vigente do gestor e CEO.';END IF;
 IF j.hiring_purpose IN('internal','shared_management') THEN
  IF j.deal_id IS NOT NULL THEN RETURN 'Demanda interna ou compartilhada não usa negócio.';END IF;RETURN NULL;
 END IF;
 SELECT * INTO d FROM public.deals WHERE id=j.deal_id AND workspace_id=p_ws AND deleted_at IS NULL;
 IF d.id IS NULL THEN RETURN 'Vincule o negócio do cliente.';END IF;
 IF public.deal_stage_type(d.pipeline_id,d.stage_id,d.stage::text) IS DISTINCT FROM 'won' THEN RETURN 'Negócio ainda não está ganho na etapa canônica do funil.';END IF;
 IF j.hiring_contract_id IS NULL THEN RETURN 'Vincule o contrato comercial da demanda.';END IF;
 RETURN public.hiring_contract_signature_reason(j.hiring_contract_id,p_ws,j.deal_id);
END $$;
REVOKE ALL ON FUNCTION public.hiring_recruitment_reason(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_contract_select_commercial(p_ws uuid,p_contract uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;old_contract uuid;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'manage') THEN RAISE EXCEPTION 'Sem permissão para definir origem comercial.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 IF c.role::text<>'provider' OR c.document_kind='amendment' OR c.deal_id IS NULL OR NOT public.work_commercial_reference_allowed('deals',c.deal_id)
 OR NOT EXISTS(SELECT 1 FROM public.deals d WHERE d.id=c.deal_id AND d.workspace_id=p_ws AND d.company_id=c.counterparty_company_id AND d.deleted_at IS NULL) THEN RAISE EXCEPTION 'Use contrato principal de prestação vinculado ao negócio e ao mesmo cliente.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hiring-commercial:'||c.deal_id::text,0));
 SELECT contract_id INTO old_contract FROM public.hiring_commercial_contracts WHERE deal_id=c.deal_id AND workspace_id=p_ws;
 IF old_contract=c.id THEN RETURN;END IF;
 PERFORM id FROM public.ats_jobs WHERE workspace_id=p_ws AND deal_id=c.deal_id AND hiring_governed ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.contracts WHERE id=c.id FOR SHARE;
 INSERT INTO public.hiring_commercial_contracts(deal_id,workspace_id,contract_id,selected_by) VALUES(c.deal_id,p_ws,c.id,auth.uid())
 ON CONFLICT(deal_id) DO UPDATE SET contract_id=excluded.contract_id,selected_by=auth.uid(),selected_at=now();
 PERFORM set_config('app.hiring_contract_link','on',true);
 UPDATE public.ats_jobs SET hiring_contract_id=c.id WHERE workspace_id=p_ws AND deal_id=c.deal_id AND hiring_governed AND (hiring_contract_id IS NULL OR hiring_contract_id=old_contract);
 PERFORM set_config('app.hiring_contract_link','off',true);
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details) VALUES(p_ws,c.id,auth.uid(),'commercial_source_selected',jsonb_build_object('deal_id',c.deal_id,'previous_contract_id',old_contract));
END $$;

CREATE OR REPLACE FUNCTION public.hiring_job_contract_link(p_ws uuid,p_job uuid,p_revision integer,p_contract uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.ats_jobs;
BEGIN
 IF NOT public.hiring_stage2_access(p_ws,'update',p_job) OR NOT public.hiring_stage2_access(p_ws,'view',p_job) THEN RAISE EXCEPTION 'Sem permissão para vincular contrato à demanda.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.ats_jobs WHERE id=p_job AND workspace_id=p_ws FOR UPDATE;
 IF j.hiring_revision<>p_revision THEN RAISE EXCEPTION 'Demanda alterada. Recarregue.';END IF;
 IF j.hiring_purpose IS DISTINCT FROM 'client' OR NOT EXISTS(SELECT 1 FROM public.contracts c JOIN public.deals d ON d.id=c.deal_id AND d.workspace_id=c.workspace_id WHERE c.id=p_contract AND c.workspace_id=p_ws AND c.deal_id=j.deal_id AND c.role::text='provider' AND c.document_kind<>'amendment' AND c.counterparty_company_id=d.company_id AND d.deleted_at IS NULL) THEN RAISE EXCEPTION 'Contrato não corresponde ao cliente e negócio da demanda.';END IF;
 PERFORM set_config('app.hiring_contract_link','on',true);UPDATE public.ats_jobs SET hiring_contract_id=p_contract WHERE id=j.id;PERFORM set_config('app.hiring_contract_link','off',true);
 INSERT INTO public.hiring_demand_events(workspace_id,job_id,actor_id,kind,detail) VALUES(p_ws,j.id,auth.uid(),'contract_linked',jsonb_build_object('contract_id',p_contract));
END $$;

CREATE OR REPLACE FUNCTION public.hiring_job_source_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  -- Todas as novas vagas de negócio recebem apenas a origem explicitamente escolhida.
  IF NEW.deal_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=NEW.workspace_id AND signature_gate_enabled) THEN
   IF NEW.hiring_contract_id IS NOT NULL THEN RAISE EXCEPTION 'Defina o contrato da demanda pela ação específica.';END IF;
   SELECT contract_id INTO NEW.hiring_contract_id FROM public.hiring_commercial_contracts WHERE deal_id=NEW.deal_id AND workspace_id=NEW.workspace_id;
   NEW.hiring_purpose:='client';
  END IF;
 ELSIF OLD.hiring_governed AND EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=OLD.workspace_id AND signature_gate_enabled)
   AND EXISTS(SELECT 1 FROM public.deal_role_profiles p WHERE p.ats_job_id=OLD.id AND p.workspace_id=OLD.workspace_id AND (p.deal_id IS DISTINCT FROM NEW.deal_id OR NEW.hiring_purpose IS DISTINCT FROM 'client')) THEN
   RAISE EXCEPTION 'Vaga originada de perfil comercial deve preservar o negócio e a finalidade de atendimento ao cliente.';
 ELSIF NEW.hiring_contract_id IS DISTINCT FROM OLD.hiring_contract_id AND coalesce(current_setting('app.hiring_contract_link',true),'')<>'on' THEN RAISE EXCEPTION 'Use a ação de vínculo do contrato da demanda.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_hiring_job_source BEFORE INSERT OR UPDATE ON public.ats_jobs FOR EACH ROW EXECUTE FUNCTION public.hiring_job_source_guard();
REVOKE ALL ON FUNCTION public.hiring_job_source_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_recruitment_check(p_ws uuid,p_job uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.ats_jobs;reason text;kind text;
BEGIN
 IF NOT public.hiring_stage2_access(p_ws,'view',p_job) THEN RAISE EXCEPTION 'Sem acesso à autorização da vaga.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM public.ats_jobs WHERE id=p_job AND workspace_id=p_ws;
 reason:=public.hiring_recruitment_reason(p_ws,j.id);
 SELECT CASE WHEN p.modality='hunting' THEN 'hunting' WHEN p.modality='outsourcing' THEN 'outsourcing' ELSE 'mixed' END INTO kind FROM public.deal_role_profiles p WHERE p.ats_job_id=j.id AND p.workspace_id=p_ws;
 IF kind IS NULL AND j.deal_id IS NOT NULL THEN
  SELECT CASE WHEN bool_and(c.staffing_kind='hunting' OR (c.staffing_kind IS NULL AND lower(c.name) LIKE '%hunting%')) THEN 'hunting' ELSE 'other' END INTO kind FROM public.services s JOIN public.deal_line_items li ON li.id=s.source_deal_line_item_id AND li.workspace_id=s.workspace_id JOIN public.service_catalog c ON c.id=li.service_catalog_id AND c.workspace_id=s.workspace_id WHERE s.contract_id=j.hiring_contract_id AND s.workspace_id=p_ws;
 END IF;
 RETURN jsonb_build_object('ready',reason IS NULL,'reason',reason,'governed',j.hiring_governed,'kind',coalesce(kind,'other'),'contract_id',j.hiring_contract_id,'revision',j.hiring_revision,
 'contracts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'number',c.number,'reason',public.hiring_contract_signature_reason(c.id,p_ws,j.deal_id)) ORDER BY c.created_at DESC) FROM public.contracts c JOIN public.deals d ON d.id=j.deal_id AND d.workspace_id=p_ws WHERE c.workspace_id=p_ws AND c.deal_id=j.deal_id AND c.counterparty_company_id=d.company_id AND c.role::text='provider' AND c.document_kind<>'amendment'),'[]'));
END $$;

-- Revalidação em qualquer gravação, incluindo API, aplicação pública, importação e worker.
CREATE OR REPLACE FUNCTION public.hiring_recruitment_execution_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j uuid;w uuid;reason text;
BEGIN
 w:=NEW.workspace_id;
 IF TG_TABLE_NAME='ats_jobs' THEN
  IF NEW.status<>'published' THEN RETURN NEW;END IF;j:=NEW.id;
  IF TG_OP='INSERT' AND NEW.hiring_governed THEN RAISE EXCEPTION 'Prepare e aprove a demanda antes de publicar.';END IF;
 ELSE
  j:=NEW.job_id;
  IF TG_OP='UPDATE' AND NEW.job_id IS NOT DISTINCT FROM OLD.job_id THEN
   IF TG_TABLE_NAME='ats_applications' AND NEW.status IN('rejected','withdrawn','canceled','cancelled') THEN RETURN NEW;END IF;
   IF TG_TABLE_NAME IN('ats_interviews','ats_job_postings') AND NEW.status IN('canceled','cancelled','closed','unpublished') THEN RETURN NEW;END IF;
   IF TG_TABLE_NAME='ats_offers' AND NEW.status IN('canceled','cancelled') THEN RETURN NEW;END IF;
  END IF;
 END IF;
 reason:=public.hiring_recruitment_reason(w,j);
 IF reason IS NOT NULL THEN RAISE EXCEPTION 'RECRUITMENT_BLOCKED: %',reason USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzzzzz_hiring_execution BEFORE INSERT OR UPDATE ON public.ats_jobs FOR EACH ROW EXECUTE FUNCTION public.hiring_recruitment_execution_guard();
CREATE TRIGGER zzzzzz_hiring_execution BEFORE INSERT OR UPDATE ON public.ats_applications FOR EACH ROW EXECUTE FUNCTION public.hiring_recruitment_execution_guard();
CREATE TRIGGER zzzzzz_hiring_execution BEFORE INSERT OR UPDATE ON public.ats_interviews FOR EACH ROW EXECUTE FUNCTION public.hiring_recruitment_execution_guard();
CREATE TRIGGER zzzzzz_hiring_execution BEFORE INSERT OR UPDATE ON public.ats_job_postings FOR EACH ROW EXECUTE FUNCTION public.hiring_recruitment_execution_guard();
CREATE TRIGGER zzzzzz_hiring_execution BEFORE INSERT OR UPDATE ON public.ats_offers FOR EACH ROW EXECUTE FUNCTION public.hiring_recruitment_execution_guard();
REVOKE ALL ON FUNCTION public.hiring_recruitment_execution_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_project_signature_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reason text;
BEGIN
 IF TG_OP='INSERT' THEN NEW.signature_gate_governed:=NEW.deal_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=NEW.workspace_id AND signature_gate_enabled);
 ELSIF NEW.signature_gate_governed IS DISTINCT FROM OLD.signature_gate_governed THEN RAISE EXCEPTION 'Governança comercial do projeto é protegida.';END IF;
 IF NEW.signature_gate_governed AND NEW.status::text NOT IN('planning','cancelled','canceled','archived','completed','paused','on_hold') THEN
  reason:=public.hiring_contract_signature_reason(NEW.contract_id,NEW.workspace_id,NEW.deal_id);
  IF reason IS NOT NULL THEN RAISE EXCEPTION 'Projeto permanece em planejamento: %',reason;END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER zzzzzz_hiring_project_signature BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.hiring_project_signature_guard();
REVOKE ALL ON FUNCTION public.hiring_project_signature_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hiring_contract_select_commercial(uuid,uuid),public.hiring_job_contract_link(uuid,uuid,integer,uuid),public.hiring_recruitment_check(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_contract_select_commercial(uuid,uuid),public.hiring_job_contract_link(uuid,uuid,integer,uuid),public.hiring_recruitment_check(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.role_profile_forward(_profile uuid, _job jsonb, _early boolean, _early_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.deal_role_profiles; h public.deal_role_profile_handoffs; d public.deals;
        v public.deal_role_profile_versions; pipe uuid; job uuid; won boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('role_profile_forward:' || _profile::text));
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = _profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF NOT public.role_profile_can(p.workspace_id, 'techsales.role_profiles.manage.workspace') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles.manage.workspace' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO h FROM public.deal_role_profile_handoffs WHERE profile_id = p.id;
  IF FOUND THEN
    RETURN jsonb_build_object('ats_job_id', h.ats_job_id, 'already', true);
  END IF;
  IF p.approved_version_id IS NULL OR p.status <> 'approved' THEN
    RAISE EXCEPTION 'Aprove a versão atual antes de encaminhar ao recrutamento';
  END IF;
  SELECT * INTO d FROM public.deals WHERE id = p.deal_id AND workspace_id = p.workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negócio não encontrado'; END IF;
  SELECT * INTO v FROM public.deal_role_profile_versions WHERE id = p.approved_version_id;
  won := public.deal_stage_type(d.pipeline_id,d.stage_id,d.stage::text)='won';
  IF EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=p.workspace_id AND signature_gate_enabled) THEN
    IF coalesce(_early,false) THEN RAISE EXCEPTION 'Antecipação não libera recrutamento: contrato assinado é obrigatório.';END IF;
    IF NOT won OR public.hiring_deal_signature_contract(p.workspace_id,p.deal_id) IS NULL THEN RAISE EXCEPTION 'Defina a origem comercial com contrato assinado e válido antes de encaminhar ao recrutamento.';END IF;
  END IF;
  IF NOT won THEN
    IF NOT coalesce(_early, false) THEN
      RAISE EXCEPTION 'EARLY_REQUIRED: o negócio ainda não foi ganho; é preciso autorização comercial antecipada';
    END IF;
    IF NOT public.role_profile_can(p.workspace_id, 'techsales.role_profiles_early.approve.workspace') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles_early.approve.workspace' USING ERRCODE = '42501';
    END IF;
    IF char_length(coalesce(trim(_early_reason), '')) < 10 THEN
      RAISE EXCEPTION 'Informe o motivo da autorização antecipada (mínimo 10 caracteres)';
    END IF;
  END IF;
  SELECT id INTO pipe FROM public.ats_pipelines WHERE workspace_id = p.workspace_id
    ORDER BY is_default DESC, created_at ASC LIMIT 1;
  IF pipe IS NULL THEN RAISE EXCEPTION 'Configure um pipeline no TechHire antes de encaminhar'; END IF;
  INSERT INTO public.ats_jobs(owner_id, workspace_id, pipeline_id, title, slug, description, requirements,
                              seniority, employment_type, location, remote_mode, salary_min, salary_max,
                              salary_currency, status, deal_id, company_id, assigned_to, metadata)
  VALUES (auth.uid(), p.workspace_id, pipe, left(_job->>'title', 200),
          trim(both '-' from left(regexp_replace(lower(_job->>'title'), '[^a-z0-9]+', '-', 'g'), 60)) || '-' || substr(md5(p.id::text || clock_timestamp()::text), 1, 8),
          _job->>'description', _job->>'requirements', _job->>'seniority', _job->>'employment_type',
          _job->>'location', _job->>'remote_mode', nullif(_job->>'salary_min','')::numeric, nullif(_job->>'salary_max','')::numeric,
          _job->>'salary_currency', 'draft', p.deal_id, p.company_id, auth.uid(),
          jsonb_build_object('source','deal_role_profile','role_profile_id',p.id,'role_profile_version',v.version,
                             'quantity',p.quantity,'modality',p.modality,'contact_id',p.contact_id))
  RETURNING id INTO job;
  INSERT INTO public.deal_role_profile_handoffs(profile_id, workspace_id, version_id, ats_job_id, early, early_reason, authorized_by, created_by, last_synced_version)
    VALUES (p.id, p.workspace_id, v.id, job, NOT won, CASE WHEN won THEN NULL ELSE _early_reason END,
            CASE WHEN won THEN NULL ELSE auth.uid() END, auth.uid(), v.version);
  UPDATE public.deal_role_profiles SET status = 'forwarded', ats_job_id = job, ats_synced_version = v.version,
         revision = revision + 1, updated_at = now() WHERE id = p.id;
  INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, version, reason, details, actor_id)
    VALUES (p.id, p.workspace_id, CASE WHEN won THEN 'forwarded' ELSE 'forwarded_early' END, p.status, 'forwarded', v.version,
            CASE WHEN won THEN NULL ELSE _early_reason END, jsonb_build_object('ats_job_id', job), auth.uid());
  RETURN jsonb_build_object('ats_job_id', job, 'already', false);
END $$;
REVOKE ALL ON FUNCTION public.role_profile_forward(uuid, jsonb, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_forward(uuid, jsonb, boolean, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.deal_delivery_ensure_internal(p_deal uuid, p_origin text, p_creator uuid, p_audit_actor uuid, p_job uuid, p_operational_owner uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d record; pol record; g record;
  v_creator uuid; v_owner uuid; v_explicit boolean; v_company uuid; v_contact uuid;
  v_contracts uuid[]; v_contract uuid; v_role public.contract_role := 'provider';
  v_services uuid[]; v_service uuid; v_line uuid; v_hours numeric; v_recurring boolean; v_lines jsonb;
  v_proj uuid; v_name text; v_results jsonb := '[]'::jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('deal_delivery'), hashtext(p_deal::text));
  SELECT x.id, x.workspace_id, x.name, x.description, x.company_id, x.primary_contact_id, x.deleted_at
    INTO d FROM public.deals x WHERE x.id = p_deal;
  IF NOT FOUND OR d.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Negócio não encontrado ou excluído.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO pol FROM public.deal_delivery_policies WHERE workspace_id = d.workspace_id;
  v_creator := coalesce(p_creator, pol.project_creator_id);
  IF NOT public.deal_delivery_is_active_member(d.workspace_id, v_creator) THEN
    RAISE EXCEPTION 'O criador dos projetos não é membro ativo do workspace. Revise a política de entrega.' USING ERRCODE = '22023';
  END IF;
  v_owner := coalesce(p_operational_owner, pol.default_operational_owner_id);
  IF v_owner IS NOT NULL AND NOT public.deal_delivery_is_active_member(d.workspace_id, v_owner) THEN v_owner := NULL; END IF;

  IF NOT work_project_delivery_delegate(d.workspace_id,v_creator,v_owner,p_deal) THEN RAISE EXCEPTION 'O criador configurado não possui permissão para o negócio, criação ou atribuição do projeto.' USING ERRCODE='42501';END IF;
  v_explicit := coalesce(pol.allow_groups, true) AND EXISTS (
    SELECT 1 FROM public.deal_delivery_items i JOIN public.deal_line_items li ON li.id = i.line_item_id AND li.deal_id = p_deal
     WHERE i.deal_id = p_deal AND i.group_key <> 'none');
  SELECT c.id INTO v_company FROM public.companies c
   WHERE c.id = d.company_id AND c.workspace_id = d.workspace_id AND c.deleted_at IS NULL;
  SELECT c.id INTO v_contact FROM public.contacts c
   WHERE c.id = d.primary_contact_id AND c.workspace_id = d.workspace_id AND c.deleted_at IS NULL;
  -- Contrato só quando há exatamente um contrato principal coerente (mesmo workspace e mesma empresa); nunca "o primeiro".
  SELECT array_agg(c.id ORDER BY c.id) INTO v_contracts FROM public.contracts c
   WHERE c.deal_id = p_deal AND c.workspace_id = d.workspace_id AND c.document_kind <> 'amendment'
     AND (c.counterparty_company_id IS NULL OR v_company IS NULL OR c.counterparty_company_id = v_company)
     AND (c.role::text='provider' OR NOT EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=d.workspace_id AND signature_gate_enabled));
  IF coalesce(cardinality(v_contracts), 0) = 1 THEN
    v_contract := v_contracts[1];
    SELECT c.role INTO v_role FROM public.contracts c WHERE c.id = v_contract;
  END IF;

  IF EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=d.workspace_id AND signature_gate_enabled) THEN
    SELECT c.id INTO v_proj FROM public.hiring_commercial_contracts x JOIN public.contracts c ON c.id=x.contract_id AND c.workspace_id=x.workspace_id WHERE x.deal_id=p_deal AND x.workspace_id=d.workspace_id AND c.deal_id=p_deal AND c.role::text='provider' AND c.counterparty_company_id=v_company;
    IF v_proj IS NOT NULL THEN v_contract:=v_proj;v_role:='provider';END IF;
  END IF;

  FOR g IN
    SELECT s.key, s.label, s.items FROM (
      SELECT i.group_key AS key, max(i.group_label) AS label,
             array_agg(li.id ORDER BY li.position, li.created_at) AS items
        FROM public.deal_delivery_items i JOIN public.deal_line_items li ON li.id = i.line_item_id AND li.deal_id = p_deal
       WHERE v_explicit AND i.deal_id = p_deal AND i.group_key <> 'none'
       GROUP BY i.group_key
      UNION ALL
      SELECT 'default', NULL::text,
             coalesce((SELECT array_agg(li.id ORDER BY li.position, li.created_at) FROM public.deal_line_items li
                        WHERE li.deal_id = p_deal
                          AND NOT EXISTS (SELECT 1 FROM public.deal_delivery_items i
                                           WHERE i.line_item_id = li.id AND i.group_key = 'none')), '{}'::uuid[])
       WHERE NOT v_explicit) s
    ORDER BY s.key
  LOOP
    IF coalesce(cardinality(g.items),0)>0 AND EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=d.workspace_id AND signature_gate_enabled) THEN
      g.items:=ARRAY(SELECT li.id FROM public.deal_line_items li LEFT JOIN public.service_catalog sc ON sc.id=li.service_catalog_id AND sc.workspace_id=li.workspace_id WHERE li.id=ANY(g.items) AND li.workspace_id=d.workspace_id AND NOT coalesce(sc.staffing_kind='hunting' OR (sc.staffing_kind IS NULL AND lower(sc.name) LIKE '%hunting%'),false));
      IF cardinality(g.items)=0 THEN
        v_results:=v_results||jsonb_build_array(jsonb_build_object('group',g.key,'action','skipped','reason','Hunting não provisiona projeto de horas automaticamente'));CONTINUE;
      END IF;
    END IF;

    v_proj := NULL;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.deal_id = p_deal AND p.delivery_group_key = g.key;
    IF v_proj IS NULL THEN
      SELECT l.project_id INTO v_proj FROM public.project_deal_links l WHERE l.deal_id = p_deal AND l.delivery_group_key = g.key;
    END IF;
    IF v_proj IS NOT NULL THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object('group', g.key, 'project_id', v_proj, 'action', 'existing'));
      CONTINUE;
    END IF;
    v_services := ARRAY(SELECT s.id FROM public.services s
                         WHERE v_contract IS NOT NULL AND s.contract_id = v_contract AND s.workspace_id = d.workspace_id
                           AND s.source_deal_line_item_id = ANY (g.items));
    v_service := CASE WHEN cardinality(v_services) = 1 THEN v_services[1] END;
    v_line := CASE WHEN cardinality(g.items) = 1 THEN g.items[1] END;
    SELECT sum(li.quantity) FILTER (WHERE li.unit = 'hour' AND li.cadence IS NULL),
           coalesce(bool_or(li.unit = 'hour' AND li.cadence IS NOT NULL), false),
           coalesce(jsonb_agg(jsonb_build_object('id', li.id, 'name', li.name, 'quantity', li.quantity, 'unit', li.unit,
                    'cadence', li.cadence, 'service_catalog_id', li.service_catalog_id) ORDER BY li.position, li.created_at), '[]'::jsonb)
      INTO v_hours, v_recurring, v_lines
      FROM public.deal_line_items li WHERE li.id = ANY (g.items);
    IF v_recurring THEN v_hours := NULL; END IF;
    v_name := left(d.name || CASE WHEN g.key <> 'default' THEN ' · ' || coalesce(nullif(btrim(g.label), ''), g.key) ELSE '' END, 200);

    INSERT INTO public.projects (workspace_id, owner_id, name, description, status, role, company_id, client_contact_id,
      contract_id, service_id, deal_id, delivery_group_key, source_line_item_id, origin, planned_hours, assigned_to, metadata)
    VALUES (d.workspace_id, v_creator, v_name, d.description, 'planning', v_role, v_company, v_contact,
      v_contract, v_service, p_deal, g.key, v_line,
      CASE p_origin WHEN 'manual' THEN 'deal_manual' WHEN 'history' THEN 'deal_history' ELSE 'deal_auto' END,
      v_hours, coalesce(v_owner, v_creator),
      jsonb_build_object('delivery', jsonb_build_object(
        'deal_id', p_deal, 'group_key', g.key, 'group_label', g.label, 'origin', p_origin, 'job_id', p_job,
        'line_items', v_lines, 'contracts_found', coalesce(cardinality(v_contracts), 0),
        'operational_owner_defined', v_owner IS NOT NULL, 'created_at', now())))
    RETURNING id INTO v_proj;
    -- Responsável operacional indefinido fica vazio (pendência visível); nunca herda o vendedor.
    IF v_owner IS NULL THEN
      UPDATE public.projects SET assigned_to = NULL WHERE id = v_proj;
    END IF;
    INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, origin, actor, job_id, after)
    VALUES (d.workspace_id, p_deal, v_proj, 'project_created', p_origin, p_audit_actor, p_job,
            jsonb_build_object('deal_id', p_deal, 'group_key', g.key, 'company_id', v_company, 'contract_id', v_contract,
                               'service_id', v_service, 'source_line_item_id', v_line));
    v_results := v_results || jsonb_build_array(jsonb_build_object('group', g.key, 'project_id', v_proj, 'action', 'created'));
  END LOOP;
  RETURN jsonb_build_object('deal_id', p_deal, 'results', v_results);
END $function$
;

CREATE OR REPLACE FUNCTION public.hiring_recruitment_preflight(p_ws uuid,p_job uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reason text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_ws,auth.uid()) OR public.is_read_only_view()
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active_workspace_id=p_ws)
 OR NOT EXISTS(SELECT 1 FROM public.ats_jobs WHERE id=p_job AND workspace_id=p_ws)
 OR NOT public.hr_record_access('jobs','view',p_job) THEN RAISE EXCEPTION 'Vaga indisponível no seu acesso.' USING ERRCODE='42501';END IF;
 reason:=public.hiring_recruitment_reason(p_ws,p_job);
 RETURN jsonb_build_object('ready',reason IS NULL,'reason',reason);
END $$;
REVOKE ALL ON FUNCTION public.hiring_recruitment_preflight(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_recruitment_preflight(uuid,uuid) TO authenticated;

-- Serviço interno: chamado depois de sales_worker_authorize, usando a candidatura canônica.
CREATE OR REPLACE FUNCTION public.hiring_workflow_recruitment_check(p_ws uuid,p_application uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.ats_jobs;reason text;hunting boolean;
BEGIN
 SELECT x.* INTO j FROM public.ats_applications a JOIN public.ats_jobs x ON x.id=a.job_id AND x.workspace_id=a.workspace_id WHERE a.id=p_application AND a.workspace_id=p_ws;
 IF j.id IS NULL THEN RAISE EXCEPTION 'Candidatura indisponível no workspace.';END IF;
 reason:=public.hiring_recruitment_reason(p_ws,j.id);
 hunting:=j.hiring_governed AND EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=p_ws AND signature_gate_enabled) AND (
 EXISTS(SELECT 1 FROM public.deal_role_profiles WHERE ats_job_id=j.id AND workspace_id=p_ws AND modality='hunting') OR
 EXISTS(SELECT 1 FROM public.services s JOIN public.deal_line_items l ON l.id=s.source_deal_line_item_id AND l.workspace_id=s.workspace_id JOIN public.service_catalog c ON c.id=l.service_catalog_id AND c.workspace_id=l.workspace_id WHERE s.contract_id=j.hiring_contract_id AND s.workspace_id=p_ws GROUP BY s.contract_id HAVING bool_and(c.staffing_kind='hunting' OR (c.staffing_kind IS NULL AND lower(c.name) LIKE '%hunting%'))));
 RETURN jsonb_build_object('ready',reason IS NULL,'reason',reason,'hunting',hunting);
END $$;
REVOKE ALL ON FUNCTION public.hiring_workflow_recruitment_check(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_workflow_recruitment_check(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.hiring_profile_recruitment_status(p_ws uuid,p_deal uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.deals;required boolean;reason text;c uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_ws,auth.uid()) OR NOT public.role_profile_can(p_ws,'techsales.role_profiles.view.workspace') OR NOT public.work_commercial_reference_allowed('deals',p_deal) THEN RAISE EXCEPTION 'Sem acesso à origem comercial do perfil.' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM public.deals WHERE id=p_deal AND workspace_id=p_ws AND deleted_at IS NULL;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Negócio indisponível no workspace.';END IF;
 required:=EXISTS(SELECT 1 FROM public.hiring_workspace_settings WHERE workspace_id=p_ws AND signature_gate_enabled);
 IF required THEN
  IF public.deal_stage_type(d.pipeline_id,d.stage_id,d.stage::text) IS DISTINCT FROM 'won' THEN reason:='Negócio ainda não está ganho na etapa canônica do funil.';
  ELSE
   SELECT contract_id INTO c FROM public.hiring_commercial_contracts WHERE deal_id=d.id AND workspace_id=p_ws;
   reason:=public.hiring_contract_signature_reason(c,p_ws,d.id);
  END IF;
 END IF;
 RETURN jsonb_build_object('required',required,'ready',reason IS NULL,'reason',reason);
END $$;
REVOKE ALL ON FUNCTION public.hiring_profile_recruitment_status(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_profile_recruitment_status(uuid,uuid) TO authenticated;
