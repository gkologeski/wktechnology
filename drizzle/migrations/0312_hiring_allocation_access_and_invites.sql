-- Etapa 4B: concessões com proveniência, aceitação autenticada e escopo por alocação.
CREATE OR REPLACE FUNCTION public.hiring_set_live(s uuid,u uuid,w uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT NOT EXISTS(SELECT 1 FROM permission_sets WHERE id=s AND module='__hiring__') OR EXISTS(
 SELECT 1 FROM hiring_access_grants g JOIN hiring_engagements e ON e.id=g.engagement_id JOIN people pe ON pe.id=e.person_id JOIN hiring_access_model_versions v ON v.id=e.model_version_id JOIN ats_jobs j ON j.id=e.job_id
 WHERE v.role_id=j.hiring_role_id AND g.set_id=s AND g.user_id=u AND g.workspace_id=w AND e.workspace_id=w AND g.revoked_at IS NULL AND e.status='active'
 AND pe.profile_id=u AND pe.status='active' AND NOT pe.archived AND(pe.hire_date IS NULL OR pe.hire_date<=current_date) AND e.starts_at<=current_date AND(e.ends_at IS NULL OR e.ends_at>=current_date))
$$;
REVOKE ALL ON FUNCTION public.hiring_set_live(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_allocation_scope(w uuid,p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.is_workspace_member(w,auth.uid()) AND public.work_access_context()->>'workspace'=w::text AND(
 public.is_workspace_admin_v2(w,auth.uid()) OR NOT EXISTS(SELECT 1 FROM hiring_access_grants WHERE user_id=auth.uid() AND workspace_id=w AND revoked_at IS NULL)
 OR EXISTS(SELECT 1 FROM hiring_access_grants g JOIN hiring_engagements e ON e.id=g.engagement_id JOIN hiring_access_model_versions v ON v.id=e.model_version_id WHERE g.user_id=auth.uid() AND g.workspace_id=w AND g.revoked_at IS NULL AND NOT v.allocation_only AND public.hiring_set_live(g.set_id,g.user_id,w))
 OR EXISTS(SELECT 1 FROM people_allocations a JOIN people pe ON pe.id=a.person_id JOIN hiring_engagements e ON e.id=a.hiring_engagement_id JOIN hiring_access_grants g ON g.engagement_id=e.id
 WHERE a.project_id=p AND a.workspace_id=w AND pe.profile_id=auth.uid() AND a.status='active' AND a.can_track_time AND a.starts_at<=current_date AND(a.ends_at IS NULL OR a.ends_at>=current_date) AND g.revoked_at IS NULL AND public.hiring_set_live(g.set_id,auth.uid(),w)))
$$;
REVOKE ALL ON FUNCTION public.hiring_allocation_scope(uuid,uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.hiring_allocation_scope(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.hiring_scoped_workspaces() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT DISTINCT workspace_id FROM hiring_access_grants WHERE user_id=auth.uid() AND revoked_at IS NULL $$;
REVOKE ALL ON FUNCTION public.hiring_scoped_workspaces() FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.hiring_scoped_workspaces() TO authenticated;
CREATE POLICY hiring_project_scope ON public.projects AS RESTRICTIVE FOR ALL TO authenticated USING(workspace_id NOT IN(SELECT public.hiring_scoped_workspaces()) OR public.hiring_allocation_scope(workspace_id,id)) WITH CHECK(workspace_id NOT IN(SELECT public.hiring_scoped_workspaces()) OR public.hiring_allocation_scope(workspace_id,id));
CREATE POLICY hiring_task_scope ON public.project_tasks AS RESTRICTIVE FOR ALL TO authenticated USING(workspace_id NOT IN(SELECT public.hiring_scoped_workspaces()) OR public.hiring_allocation_scope(workspace_id,project_id)) WITH CHECK(workspace_id NOT IN(SELECT public.hiring_scoped_workspaces()) OR public.hiring_allocation_scope(workspace_id,project_id));
CREATE POLICY hiring_time_scope ON public.project_time_entries AS RESTRICTIVE FOR ALL TO authenticated USING(workspace_id NOT IN(SELECT public.hiring_scoped_workspaces()) OR public.hiring_allocation_scope(workspace_id,project_id)) WITH CHECK(workspace_id NOT IN(SELECT public.hiring_scoped_workspaces()) OR public.hiring_allocation_scope(workspace_id,project_id));

CREATE OR REPLACE FUNCTION public.hiring_allocation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e hiring_engagements;co contracts;pc contracts;pr projects;enabled boolean;relevant boolean;BEGIN
 IF TG_OP='UPDATE' AND NEW.hiring_engagement_id IS DISTINCT FROM OLD.hiring_engagement_id THEN RAISE EXCEPTION 'A origem da alocação é imutável; conciliação histórica usa fluxo separado.';END IF;
 SELECT employment_gate_enabled INTO enabled FROM hiring_workspace_settings WHERE workspace_id=NEW.workspace_id;
 relevant:=TG_OP='INSERT' OR (to_jsonb(NEW)-ARRAY['status','notes','updated_at','can_track_time']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['status','notes','updated_at','can_track_time']);
 IF NOT coalesce(enabled,false) AND NEW.hiring_engagement_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.hiring_engagement_id IS NULL AND NEW.hiring_engagement_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NEW.status='ended' AND NOT relevant THEN RETURN NEW;END IF;
 IF NOT relevant AND NEW.status<>'active' THEN RETURN NEW;END IF;
 SELECT * INTO e FROM hiring_engagements WHERE id=NEW.hiring_engagement_id AND workspace_id=NEW.workspace_id FOR SHARE;
 IF e.id IS NULL OR e.person_id<>NEW.person_id OR e.status<>'active' THEN RAISE EXCEPTION 'Selecione um vínculo de contratação ativo da pessoa.';END IF;
 IF e.purpose='client' AND e.commercial_contract_id IS DISTINCT FROM(SELECT hiring_contract_id FROM ats_jobs WHERE id=e.job_id AND workspace_id=e.workspace_id) THEN RAISE EXCEPTION 'A origem comercial mudou; revise o vínculo.';END IF;
 IF public.hiring_recruitment_reason(e.workspace_id,e.job_id) IS NOT NULL THEN RAISE EXCEPTION '%',public.hiring_recruitment_reason(e.workspace_id,e.job_id);END IF;
 IF EXISTS(SELECT 1 FROM people WHERE id=e.person_id AND hire_date>NEW.starts_at) THEN RAISE EXCEPTION 'Alocação não pode iniciar antes da admissão efetiva da pessoa.';END IF;
 IF NEW.starts_at<e.starts_at OR(e.ends_at IS NOT NULL AND(NEW.ends_at IS NULL OR NEW.ends_at>e.ends_at)) THEN RAISE EXCEPTION 'Alocação fora do período do vínculo.';END IF;
 IF e.purchase_contract_id IS NULL THEN RAISE EXCEPTION 'Vincule o contrato de compra/contratação antes de alocar.';END IF;
 SELECT * INTO pc FROM contracts WHERE id=e.purchase_contract_id AND workspace_id=e.workspace_id FOR SHARE;
 IF pc.role::text<>'client' OR pc.hiring_person_id IS DISTINCT FROM e.person_id OR pc.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id OR pc.status::text NOT IN('active','renewing') OR pc.starts_at IS NULL OR NEW.starts_at<pc.starts_at OR(pc.ends_at IS NOT NULL AND(NEW.ends_at IS NULL OR NEW.ends_at>pc.ends_at)) THEN RAISE EXCEPTION 'Contrato de compra deve estar ativo, vinculado à pessoa e ao mesmo CNPJ WK, com vigência suficiente.';END IF;
 NEW.purchase_contract_id:=pc.id;
 IF e.purpose='client' THEN
  SELECT * INTO co FROM contracts WHERE id=e.commercial_contract_id AND workspace_id=e.workspace_id FOR SHARE;
  IF public.hiring_contract_signature_reason(co.id,e.workspace_id,co.deal_id) IS NOT NULL THEN RAISE EXCEPTION 'Contrato comercial sem assinatura válida.';END IF;
  IF co.contracting_legal_entity_id IS DISTINCT FROM pc.contracting_legal_entity_id OR NEW.contract_id IS DISTINCT FROM co.id THEN RAISE EXCEPTION 'Cliente e prestador devem usar o mesmo CNPJ WK e contrato comercial de origem.';END IF;
  IF NEW.starts_at<co.starts_at OR(co.ends_at IS NOT NULL AND(NEW.ends_at IS NULL OR NEW.ends_at>co.ends_at)) THEN RAISE EXCEPTION 'Alocação fora da vigência do contrato comercial.';END IF;
 END IF;
 IF NEW.project_id IS NOT NULL AND EXISTS(SELECT 1 FROM projects x JOIN contracts c ON c.id=x.contract_id AND c.workspace_id=x.workspace_id WHERE x.id=NEW.project_id AND x.workspace_id=e.workspace_id AND c.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id) THEN RAISE EXCEPTION 'Entidade WK do projeto diverge do vínculo; exige análise explícita, sem trocar o empregador automaticamente.';END IF;
 IF NEW.project_id IS NOT NULL THEN SELECT * INTO pr FROM projects WHERE id=NEW.project_id AND workspace_id=e.workspace_id;IF pr.id IS NULL OR(e.purpose='client' AND(pr.contract_id IS DISTINCT FROM e.commercial_contract_id OR pr.deal_id IS DISTINCT FROM co.deal_id)) THEN RAISE EXCEPTION 'Projeto não corresponde ao contrato/negócio de origem.';END IF;END IF;
 IF relevant AND(NEW.starts_at IS DISTINCT FROM e.starts_at OR NEW.ends_at IS DISTINCT FROM e.ends_at) AND length(trim(coalesce(NEW.period_override_reason,'')))<10 THEN RAISE EXCEPTION 'Justifique o período diferente do vínculo (mínimo 10 caracteres).';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzzzzz_hiring_allocation BEFORE INSERT OR UPDATE ON public.people_allocations FOR EACH ROW EXECUTE FUNCTION public.hiring_allocation_guard();
REVOKE ALL ON FUNCTION public.hiring_allocation_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_allocate(w uuid,p_engagement uuid,p_project uuid,p_start date,p_end date,p_pct numeric,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e hiring_engagements; r uuid;d date;ed date;BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('people','update',e.person_id) OR NOT public.hr_record_access('person_allocations','create',e.person_id) OR NOT public.work_record_access('techprojects.projects',p_project,'view') THEN RAISE EXCEPTION 'Sem permissão para alocar neste projeto.' USING ERRCODE='42501';END IF;
 d:=coalesce(p_start,e.starts_at);ed:=coalesce(p_end,e.ends_at);
 IF p_pct IS NULL OR p_pct<=0 OR p_pct>100 THEN RAISE EXCEPTION 'Percentual deve estar entre 0 e 100.';END IF;
 SELECT id INTO r FROM people_allocations WHERE hiring_engagement_id=e.id AND project_id=p_project AND starts_at=d AND ends_at IS NOT DISTINCT FROM ed AND status='active';IF r IS NOT NULL THEN IF(SELECT allocation_pct FROM people_allocations WHERE id=r)<>p_pct THEN RAISE EXCEPTION 'Já existe alocação no período com dedicação diferente. Edite a alocação existente.';END IF;RETURN r;END IF;
 INSERT INTO people_allocations(workspace_id,owner_id,assigned_to,person_id,project_id,contract_id,purchase_contract_id,hiring_engagement_id,starts_at,ends_at,allocation_pct,status,can_track_time,period_override_reason)
 VALUES(w,w,auth.uid(),e.person_id,p_project,e.commercial_contract_id,e.purchase_contract_id,e.id,d,ed,p_pct,'active',true,nullif(trim(p_reason),'')) RETURNING id INTO r;
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(w,e.id,auth.uid(),'allocated',jsonb_build_object('allocation_id',r,'project_id',p_project,'starts_at',d,'ends_at',ed,'reason',p_reason));RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_employment_invite(w uuid,p_engagement uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e hiring_engagements;pe people;i workspace_invites;token_value text;BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR e.status<>'active' OR NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('people','update',e.person_id) OR NOT public.is_workspace_admin_v2(w,auth.uid()) OR NOT public.user_has_permission(auth.uid(),w,'system.roles.manage.workspace') THEN RAISE EXCEPTION 'Somente administrador autorizado pode preparar acesso.' USING ERRCODE='42501';END IF;
 IF public.hiring_recruitment_reason(w,e.job_id) IS NOT NULL OR (e.ends_at IS NOT NULL AND e.ends_at<current_date) THEN RAISE EXCEPTION 'Vínculo sem autorização atual ou expirado.';END IF;
 SELECT * INTO pe FROM people WHERE id=e.person_id AND workspace_id=w;
 IF nullif(trim(pe.email),'') IS NULL OR pe.status::text<>'active' OR pe.archived THEN RAISE EXCEPTION 'Pessoa precisa estar ativa e ter e-mail válido.';END IF;
 SELECT * INTO i FROM workspace_invites WHERE hiring_engagement_id=e.id AND accepted_at IS NULL FOR UPDATE;
 IF i.id IS NOT NULL AND i.expires_at>now() THEN RETURN i.token;END IF;
 IF i.id IS NOT NULL THEN DELETE FROM workspace_invites WHERE id=i.id;END IF;
 token_value:=encode(extensions.gen_random_bytes(32),'hex');
 PERFORM set_config('app.hiring_invite','on',true);
 INSERT INTO workspace_invites(workspace_id,email,role,token,invited_by,permission_set_id,hiring_engagement_id) VALUES(w,pe.email,'member',token_value,auth.uid(),NULL,e.id);
 PERFORM set_config('app.hiring_invite','off',true);
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind) VALUES(w,e.id,auth.uid(),'access_invite_prepared');RETURN token_value;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_accept_invite(p_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i workspace_invites;e hiring_engagements;pe people;v hiring_access_model_versions;g hiring_access_grants;s uuid;assignment uuid;email_value text;limits integer;members integer;BEGIN
 IF auth.uid() IS NULL OR public.is_read_only_view() THEN RAISE EXCEPTION 'Entre na conta do destinatário para aceitar.' USING ERRCODE='42501';END IF;
 SELECT * INTO i FROM workspace_invites WHERE token=p_token AND hiring_engagement_id IS NOT NULL FOR UPDATE;
 SELECT email INTO email_value FROM auth.users WHERE id=auth.uid();
 IF i.id IS NULL OR i.expires_at<=now() OR lower(i.email) IS DISTINCT FROM lower(email_value) THEN RAISE EXCEPTION 'Convite inválido, expirado ou de outro destinatário.' USING ERRCODE='42501';END IF;
 IF NOT public.is_workspace_member(i.workspace_id,i.invited_by) OR NOT public.is_workspace_admin_v2(i.workspace_id,i.invited_by)
 OR NOT EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(i.invited_by,i.workspace_id) k WHERE k='system.roles.manage.workspace')
 OR NOT EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(i.invited_by,i.workspace_id) k WHERE k='techpeople.employment.manage.workspace') THEN RAISE EXCEPTION 'Responsável do convite sem autorização atual.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM hiring_engagements WHERE id=i.hiring_engagement_id AND workspace_id=i.workspace_id FOR UPDATE;
 IF e.id IS NULL OR e.status<>'active' OR(e.ends_at IS NOT NULL AND e.ends_at<current_date) THEN RAISE EXCEPTION 'Vínculo encerrado ou expirado.';END IF;
 IF e.purpose='client' AND e.commercial_contract_id IS DISTINCT FROM(SELECT hiring_contract_id FROM ats_jobs WHERE id=e.job_id AND workspace_id=e.workspace_id) THEN RAISE EXCEPTION 'A origem comercial mudou; revise o vínculo.';END IF;
 IF public.hiring_recruitment_reason(e.workspace_id,e.job_id) IS NOT NULL THEN RAISE EXCEPTION 'Autorização da contratação precisa ser revista.';END IF;
 SELECT * INTO pe FROM people WHERE id=e.person_id AND workspace_id=e.workspace_id FOR UPDATE;
 IF pe.archived OR pe.status::text<>'active' OR(pe.profile_id IS NOT NULL AND pe.profile_id<>auth.uid()) OR lower(pe.email) IS DISTINCT FROM lower(email_value) THEN RAISE EXCEPTION 'Pessoa ou destinatário incompatível.';END IF;
 SELECT * INTO g FROM hiring_access_grants WHERE engagement_id=e.id AND revoked_at IS NULL;
 IF i.accepted_at IS NOT NULL THEN IF g.user_id=auth.uid() AND g.revoked_at IS NULL THEN RETURN e.id;ELSE RAISE EXCEPTION 'Convite já utilizado.';END IF;END IF;
 IF EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=e.workspace_id AND user_id=auth.uid() AND status<>'active') THEN RAISE EXCEPTION 'Membership inativo: administrador deve reativar explicitamente.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hiring-seats:'||e.workspace_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=e.workspace_id AND user_id=auth.uid()) THEN
  limits:=public.get_entitlement_limit(e.workspace_id,'users.max');SELECT count(*) INTO members FROM workspace_members WHERE workspace_id=e.workspace_id AND NOT is_test_user;
  IF limits IS NOT NULL AND members>=limits THEN RAISE EXCEPTION 'Limite de usuários atingido.';END IF;
  INSERT INTO workspace_members(workspace_id,user_id,role,status,invited_by) VALUES(e.workspace_id,auth.uid(),'member','active',i.invited_by);
 END IF;
 SELECT * INTO v FROM hiring_access_model_versions WHERE id=e.model_version_id AND workspace_id=e.workspace_id;IF v.id IS NULL OR cardinality(v.permission_keys)=0 THEN RAISE EXCEPTION 'Modelo de acesso sem versão válida.';END IF;
 PERFORM set_config('app.hiring_accept',e.id::text,true);
 UPDATE people SET profile_id=auth.uid() WHERE id=pe.id AND profile_id IS NULL;
 PERFORM set_config('app.hiring_accept','',true);
 PERFORM set_config('app.hiring_grant','on',true);
 INSERT INTO permission_sets(owner_id,workspace_id,module,name,description,is_system) VALUES(e.workspace_id,e.workspace_id,'__hiring__','Vínculo '||e.id::text,v.name||' · revisão '||v.revision,false) RETURNING id INTO s;
 INSERT INTO permission_set_items(set_id,permission_key) SELECT s,k FROM unnest(v.permission_keys)k;
 INSERT INTO user_permission_sets(user_id,owner_id,workspace_id,set_id) VALUES(auth.uid(),e.workspace_id,e.workspace_id,s) RETURNING id INTO assignment;
 INSERT INTO hiring_access_grants(workspace_id,engagement_id,user_id,set_id,assignment_id) VALUES(e.workspace_id,e.id,auth.uid(),s,assignment);
 PERFORM set_config('app.hiring_grant','off',true);PERFORM set_config('app.hiring_invite','on',true);
 UPDATE workspace_invites SET accepted_at=now() WHERE id=i.id;PERFORM set_config('app.hiring_invite','off',true);
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(e.workspace_id,e.id,auth.uid(),'access_accepted',jsonb_build_object('model_version',v.id,'assignment',assignment));
 -- Sem user_job_roles: cargo comercial genérico não é concedido.
 RETURN e.id;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_owned_catalog_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s uuid; owned boolean;BEGIN
 IF TG_TABLE_NAME='permission_sets' THEN
  IF TG_OP='INSERT' THEN owned:=NEW.module='__hiring__';ELSE owned:=OLD.module='__hiring__' OR(TG_OP='UPDATE' AND NEW.module='__hiring__');END IF;
 ELSE IF TG_OP='DELETE' THEN s:=OLD.set_id;ELSE s:=NEW.set_id;END IF;
  owned:=EXISTS(SELECT 1 FROM permission_sets WHERE id=s AND module='__hiring__');
  IF TG_OP='UPDATE' THEN owned:=owned OR EXISTS(SELECT 1 FROM permission_sets WHERE id=OLD.set_id AND module='__hiring__');END IF;
 END IF;
 IF owned AND coalesce(current_setting('app.hiring_grant',true),'')<>'on' THEN RAISE EXCEPTION 'Concessão de contratação é imutável. Crie nova versão do modelo e revise o vínculo.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_owned_set BEFORE INSERT OR UPDATE OR DELETE ON public.permission_sets FOR EACH ROW EXECUTE FUNCTION public.hiring_owned_catalog_guard();
CREATE TRIGGER hiring_owned_items BEFORE INSERT OR UPDATE OR DELETE ON public.permission_set_items FOR EACH ROW EXECUTE FUNCTION public.hiring_owned_catalog_guard();
-- UPS podem ser removidas para revogar; inserção manual de um pacote vinculado a outra pessoa não o torna efetivo (hiring_set_live).

CREATE OR REPLACE FUNCTION public.hiring_invite_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.hiring_engagement_id IS NULL AND(TG_OP='INSERT' OR OLD.hiring_engagement_id IS NULL) THEN RETURN NEW;END IF;
 IF coalesce(current_setting('app.hiring_invite',true),'')<>'on' AND(TG_OP='INSERT' OR NEW.hiring_engagement_id IS DISTINCT FROM OLD.hiring_engagement_id OR NEW.email IS DISTINCT FROM OLD.email OR NEW.token IS DISTINCT FROM OLD.token OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.invited_by IS DISTINCT FROM OLD.invited_by OR NEW.role IS DISTINCT FROM OLD.role OR NEW.permission_set_id IS DISTINCT FROM OLD.permission_set_id OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR NEW.expires_at>OLD.expires_at) THEN RAISE EXCEPTION 'Use o convite específico do vínculo de contratação.' USING ERRCODE='42501';END IF;
 IF NEW.role<>'member' OR NEW.permission_set_id IS NOT NULL THEN RAISE EXCEPTION 'Convite de contratação não pode adicionar cargo ou pacote genérico.';END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_invite_guard BEFORE INSERT OR UPDATE ON public.workspace_invites FOR EACH ROW EXECUTE FUNCTION public.hiring_invite_guard();
REVOKE ALL ON FUNCTION public.hiring_allocate(uuid,uuid,uuid,date,date,numeric,text),public.hiring_employment_invite(uuid,uuid),public.hiring_accept_invite(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_allocate(uuid,uuid,uuid,date,date,numeric,text),public.hiring_employment_invite(uuid,uuid),public.hiring_accept_invite(text) TO authenticated;
REVOKE ALL ON FUNCTION public.hiring_owned_catalog_guard(),public.hiring_invite_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION techerp_api.effective_permissions_unchecked(_user_id uuid, _workspace_id uuid)
 RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $function$
  WITH active_member AS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id AND wm.status = 'active'
  ), ws AS (
    SELECT w.id, w.created_by FROM public.workspaces w WHERE w.id = _workspace_id
  ), my_roles AS (
    SELECT ujr.role_id
      FROM public.user_job_roles ujr
      LEFT JOIN public.job_roles jr ON jr.id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.workspace_id = _workspace_id OR ujr.owner_id = _workspace_id)
       AND (jr.id IS NULL OR jr.workspace_id IS NULL OR jr.workspace_id = _workspace_id)
  ), my_sets AS (
    SELECT ps.id AS set_id
      FROM public.user_permission_sets ups
      JOIN public.permission_sets ps ON ps.id = ups.set_id
     WHERE ups.user_id = _user_id
       AND (ups.workspace_id = _workspace_id OR ups.owner_id = _workspace_id)
       AND (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
       AND public.hiring_set_live(ps.id,_user_id,_workspace_id)
    UNION
    SELECT ps.id
      FROM my_roles r
      JOIN public.job_role_sets jrs ON jrs.role_id = r.role_id
      LEFT JOIN public.job_role_set_replacements rep
        ON rep.workspace_id = _workspace_id AND rep.role_id = r.role_id AND rep.set_id = jrs.set_id
      JOIN public.permission_sets ps ON ps.id = COALESCE(rep.replacement_set_id, jrs.set_id)
     WHERE (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
       AND public.hiring_set_live(ps.id,_user_id,_workspace_id)
       AND (rep.replacement_set_id IS NULL OR ps.workspace_id = _workspace_id)
  ), base_permissions AS (
    SELECT p.key FROM public.permissions p
     WHERE EXISTS (SELECT 1 FROM ws WHERE ws.created_by = _user_id)
        OR EXISTS (SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id
                AND wm.role IN ('owner','admin') AND wm.status = 'active')
    UNION
    SELECT psi.permission_key FROM my_sets s JOIN public.permission_set_items psi ON psi.set_id = s.set_id
  ), role_grants AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (SELECT key FROM base_permissions UNION SELECT key FROM role_grants) effective
   WHERE EXISTS (SELECT 1 FROM active_member)
     AND NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$;
CREATE OR REPLACE FUNCTION public.hr_record_links_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_old jsonb; v_new jsonb:=to_jsonb(NEW); v_key text; v_plan public.people_onboarding_plans%ROWTYPE;
BEGIN
 -- SQL maintenance and internal services are explicit exceptions; user calls
 -- through SECURITY DEFINER RPCs still carry auth.uid and are checked.
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
   v_old:=to_jsonb(OLD);
   IF (v_old->'workspace_id') IS DISTINCT FROM (v_new->'workspace_id')
      OR (v_old->'owner_id') IS DISTINCT FROM (v_new->'owner_id')
      OR (v_old->'created_by') IS DISTINCT FROM (v_new->'created_by') THEN
     RAISE EXCEPTION 'A origem e o workspace do registro não podem ser alterados.' USING ERRCODE='42501';
   END IF;
 END IF;
 IF TG_TABLE_NAME='people' AND TG_OP='UPDATE' AND NEW.profile_id=auth.uid()
 AND (to_jsonb(NEW)-ARRAY['profile_id','updated_at'])=(to_jsonb(OLD)-ARRAY['profile_id','updated_at'])
 AND EXISTS(SELECT 1 FROM public.hiring_engagements e WHERE e.id::text=current_setting('app.hiring_accept',true) AND e.person_id=NEW.id AND e.workspace_id=NEW.workspace_id AND e.status='active')
 AND EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=auth.uid() AND m.status='active') THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='people' THEN
   IF TG_OP='INSERT' THEN
     IF NEW.created_by IS NOT NULL AND NEW.created_by<>auth.uid() THEN RAISE EXCEPTION 'Autor da pessoa inválido.' USING ERRCODE='42501'; END IF;
     NEW.created_by:=auth.uid();
     IF NEW.assigned_to IS NULL OR NEW.assigned_to=NEW.workspace_id THEN NEW.assigned_to:=auth.uid(); END IF;
     v_new:=to_jsonb(NEW);
   END IF;
   IF TG_OP='UPDATE' AND (EXISTS(SELECT 1 FROM unnest(ARRAY['profile_id','manager_id','candidate_id']) k
       WHERE (v_old->k) IS DISTINCT FROM (v_new->k))
       OR COALESCE(NEW.assigned_to,NEW.created_by,NEW.owner_id) IS DISTINCT FROM COALESCE(OLD.assigned_to,OLD.created_by,OLD.owner_id))
      AND NOT public.user_has_permission(auth.uid(),NEW.workspace_id,'techpeople.people.update.workspace') THEN
     RAISE EXCEPTION 'Você não tem permissão para alterar vínculos da pessoa.' USING ERRCODE='42501';
   END IF;
   IF TG_OP='INSERT' AND NEW.profile_id IS NOT NULL AND NEW.profile_id<>auth.uid()
      AND NOT public.user_has_permission(auth.uid(),NEW.workspace_id,'techpeople.people.create.workspace') THEN
     RAISE EXCEPTION 'Você não tem permissão para vincular outro perfil.' USING ERRCODE='42501';
   END IF;
   FOREACH v_key IN ARRAY ARRAY['profile_id','assigned_to'] LOOP
     IF v_new->>v_key IS NOT NULL AND (TG_OP='INSERT' OR (v_old->v_key) IS DISTINCT FROM (v_new->v_key))
       AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=(v_new->>v_key)::uuid) THEN
       RAISE EXCEPTION 'O usuário vinculado não pertence ao workspace.' USING ERRCODE='23514';
     END IF;
   END LOOP;
   IF NEW.candidate_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id)
      AND NOT EXISTS(SELECT 1 FROM public.ats_candidates c WHERE c.id=NEW.candidate_id AND c.workspace_id=NEW.workspace_id) THEN
     RAISE EXCEPTION 'Candidato de outro workspace.' USING ERRCODE='23514';
   END IF;
   IF NEW.manager_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.manager_id IS DISTINCT FROM OLD.manager_id)
      AND NOT EXISTS(SELECT 1 FROM public.people p WHERE p.id=NEW.manager_id AND p.workspace_id=NEW.workspace_id)
      AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=NEW.manager_id) THEN
     RAISE EXCEPTION 'Gestor de outro workspace.' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME='ats_candidates' THEN
   IF TG_OP='UPDATE' AND (COALESCE(NEW.assigned_to,NEW.owner_id) IS DISTINCT FROM COALESCE(OLD.assigned_to,OLD.owner_id)
       OR NEW.relationship_owner_id IS DISTINCT FROM OLD.relationship_owner_id)
      AND NOT public.user_has_permission(auth.uid(),NEW.workspace_id,'techhire.candidates.assign.workspace') THEN
     RAISE EXCEPTION 'Você não tem permissão para reatribuir o candidato.' USING ERRCODE='42501';
   END IF;
   FOREACH v_key IN ARRAY ARRAY['assigned_to','relationship_owner_id'] LOOP
     IF v_new->>v_key IS NOT NULL AND (TG_OP='INSERT' OR (v_old->v_key) IS DISTINCT FROM (v_new->v_key))
       AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=(v_new->>v_key)::uuid) THEN
       RAISE EXCEPTION 'Responsável de outro workspace.' USING ERRCODE='23514';
     END IF;
   END LOOP;
 ELSIF TG_TABLE_NAME='people_onboarding_plans' THEN
   IF TG_OP='UPDATE' AND (NEW.person_id IS DISTINCT FROM OLD.person_id OR NEW.kind IS DISTINCT FROM OLD.kind
      OR COALESCE(NEW.assigned_to,NEW.owner_id) IS DISTINCT FROM COALESCE(OLD.assigned_to,OLD.owner_id)) THEN
     RAISE EXCEPTION 'Pessoa, tipo e responsável do plano não podem ser alterados.' USING ERRCODE='42501';
   END IF;
   IF NEW.assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=NEW.assigned_to) THEN
     RAISE EXCEPTION 'Responsável de outro workspace.' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME='people_onboarding_templates' THEN
   IF TG_OP='UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind AND EXISTS(SELECT 1 FROM public.people_onboarding_plans p WHERE p.template_id=NEW.id) THEN
     RAISE EXCEPTION 'O tipo de um modelo utilizado por planos não pode ser alterado.' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME='people_onboarding_tasks' THEN
   IF TG_OP='UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
     RAISE EXCEPTION 'A tarefa não pode ser movida para outro plano.' USING ERRCODE='42501';
   END IF;
   SELECT * INTO v_plan FROM public.people_onboarding_plans WHERE id=NEW.plan_id AND workspace_id=NEW.workspace_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Plano de outro workspace ou inexistente.' USING ERRCODE='23514'; END IF;
   IF TG_OP='UPDATE' AND NOT public.hr_onboarding_access(v_plan.workspace_id,v_plan.kind,'update',COALESCE(v_plan.assigned_to,v_plan.owner_id),v_plan.person_id,v_plan.template_id)
      AND (v_old-ARRAY['status','completed_at','completed_by','updated_at']) IS DISTINCT FROM (v_new-ARRAY['status','completed_at','completed_by','updated_at']) THEN
     RAISE EXCEPTION 'O responsável pela tarefa só pode atualizar seu andamento.' USING ERRCODE='42501';
   END IF;
   IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=NEW.assignee_id) THEN
     RAISE EXCEPTION 'Responsável de outro workspace.' USING ERRCODE='23514';
   END IF;
   IF NEW.completed_by IS NOT NULL AND (TG_OP='INSERT' OR NEW.completed_by IS DISTINCT FROM OLD.completed_by) AND NEW.completed_by<>auth.uid() THEN
     RAISE EXCEPTION 'O autor da conclusão deve ser o usuário autenticado.' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.hiring_person_origin_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.candidate_id IS NOT NULL AND EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=NEW.workspace_id AND employment_gate_enabled)
 AND EXISTS(SELECT 1 FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id WHERE a.candidate_id=NEW.candidate_id AND a.workspace_id=NEW.workspace_id AND j.hiring_governed)
 AND coalesce(current_setting('app.hiring_admit',true),'')<>'on' THEN RAISE EXCEPTION 'Use a admissão integrada da candidatura governada.';END IF;
 IF (TG_OP='INSERT' AND NEW.hiring_legal_entity_id IS NOT NULL OR TG_OP='UPDATE' AND NEW.hiring_legal_entity_id IS DISTINCT FROM OLD.hiring_legal_entity_id) AND coalesce(current_setting('app.hiring_admit',true),'')<>'on' THEN RAISE EXCEPTION 'Defina a entidade WK pela admissão integrada.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzzzzz_hiring_person_origin BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.hiring_person_origin_guard();
CREATE OR REPLACE FUNCTION public.hiring_purchase_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM hiring_engagements e WHERE e.purchase_contract_id=OLD.id AND e.status='active' AND(e.legal_entity_id IS DISTINCT FROM NEW.contracting_legal_entity_id OR e.person_id IS DISTINCT FROM NEW.hiring_person_id OR NEW.role::text<>'client' OR NEW.document_kind<>'main')) THEN RAISE EXCEPTION 'Contrato vinculado deve preservar pessoa, papel de compra e entidade WK.';END IF;
 IF(TG_OP='INSERT' AND NEW.hiring_person_id IS NOT NULL OR TG_OP='UPDATE' AND NEW.hiring_person_id IS DISTINCT FROM OLD.hiring_person_id) AND coalesce(current_setting('app.hiring_purchase',true),'')<>'on' THEN RAISE EXCEPTION 'Vincule a pessoa pela ação de contrato da admissão.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzzzzz_hiring_purchase BEFORE INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.hiring_purchase_guard();
REVOKE ALL ON FUNCTION public.hiring_person_origin_guard(),public.hiring_purchase_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.project_time_can_track(p_user uuid,p_project uuid,p_day date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM hiring_access_grants g JOIN projects pr ON pr.workspace_id=g.workspace_id WHERE pr.id=p_project AND g.user_id=p_user AND g.revoked_at IS NULL) THEN
 EXISTS(SELECT 1 FROM people_allocations a JOIN people pe ON pe.id=a.person_id JOIN hiring_engagements e ON e.id=a.hiring_engagement_id JOIN hiring_access_grants g ON g.engagement_id=e.id JOIN projects pr ON pr.id=a.project_id JOIN contracts pc ON pc.id=e.purchase_contract_id AND pc.workspace_id=e.workspace_id
 WHERE pc.role::text='client' AND pc.status::text IN('active','renewing') AND pc.contracting_legal_entity_id=e.legal_entity_id AND pc.starts_at<=p_day AND(pc.ends_at IS NULL OR pc.ends_at>=p_day) AND a.project_id=p_project AND pe.profile_id=p_user AND a.status='active' AND a.can_track_time AND a.workspace_id=pr.workspace_id AND g.user_id=p_user AND g.revoked_at IS NULL AND e.status='active' AND pe.status='active' AND NOT pe.archived AND(pe.hire_date IS NULL OR pe.hire_date<=p_day)
 AND a.starts_at<=p_day AND(a.ends_at IS NULL OR a.ends_at>=p_day) AND e.starts_at<=p_day AND(e.ends_at IS NULL OR e.ends_at>=p_day)
 AND public.is_workspace_member(a.workspace_id,p_user)
 AND(e.purpose<>'client' OR public.hiring_contract_signature_reason(e.commercial_contract_id,e.workspace_id,pr.deal_id) IS NULL))
 ELSE EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p_project AND m.user_id=p_user AND m.can_track_time IS NOT FALSE)
 OR EXISTS(SELECT 1 FROM people_allocations a JOIN people pe ON pe.id=a.person_id JOIN projects pr ON pr.id=a.project_id WHERE a.project_id=p_project AND pe.profile_id=p_user AND a.status='active' AND a.can_track_time AND a.workspace_id=pr.workspace_id AND(a.starts_at IS NULL OR a.starts_at<=p_day) AND(a.ends_at IS NULL OR a.ends_at>=p_day)) END
$$;
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.hiring_workflow_employment(w uuid,p_application uuid,p_actor uuid,p_step text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a ats_applications;j ats_jobs;e hiring_engagements;r uuid;entity uuid;oldclaims text;oldsub text;oldrole text;token_value text;BEGIN
 SELECT * INTO a FROM ats_applications WHERE id=p_application AND workspace_id=w;
 SELECT * INTO j FROM ats_jobs WHERE id=a.job_id AND workspace_id=w;
 IF j.id IS NULL OR NOT j.hiring_governed OR NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND employment_gate_enabled) THEN RETURN jsonb_build_object('handled',false);END IF;
 IF p_step NOT IN('create_person_from_candidate','create_contract_document','create_allocation','provision_workspace_user') THEN RETURN jsonb_build_object('handled',false);END IF;
 IF NOT public.is_workspace_member(w,p_actor) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND active_workspace_id=w) THEN RAISE EXCEPTION 'Responsável do workflow inativo ou em outro workspace.' USING ERRCODE='42501';END IF;
 oldclaims:=current_setting('request.jwt.claims',true);oldsub:=current_setting('request.jwt.claim.sub',true);oldrole:=current_setting('request.jwt.claim.role',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);
 SELECT * INTO e FROM hiring_engagements WHERE application_id=a.id AND workspace_id=w;
 IF p_step='create_person_from_candidate' THEN
  IF e.id IS NULL THEN
   entity:=nullif(p_payload->>'entity_id','')::uuid;
   IF j.hiring_purpose='client' THEN SELECT contracting_legal_entity_id INTO entity FROM contracts WHERE id=j.hiring_contract_id AND workspace_id=w;END IF;
   r:=public.hiring_employment_admit(w,a.id,nullif(p_payload->>'person_id','')::uuid,nullif(p_payload->>'access_model_id','')::uuid,entity,nullif(p_payload->>'starts_at','')::date,nullif(p_payload->>'ends_at','')::date,coalesce(p_payload->>'reason',''),coalesce(nullif(p_payload->>'employment_type',''),nullif(a.hiring_details->>'employment_type',''),CASE j.employment_type WHEN 'clt' THEN 'clt' WHEN 'contract' THEN 'contractor' WHEN 'internship' THEN 'intern' WHEN 'temporary' THEN 'other' ELSE 'pj' END));
   SELECT * INTO e FROM hiring_engagements WHERE id=r;
  END IF;
  IF NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('people','view',e.person_id) THEN RAISE EXCEPTION 'Sem acesso ao vínculo.' USING ERRCODE='42501';END IF;r:=e.person_id;
 ELSE
  IF e.id IS NULL THEN RAISE EXCEPTION 'Conclua a admissão integrada com entidade e modelo de cargo antes de continuar.';END IF;
  IF p_step='create_contract_document' THEN r:=public.hiring_employment_contract(w,e.id,nullif(p_payload->>'contract_id','')::uuid,p_payload);
  ELSIF p_step='create_allocation' THEN r:=public.hiring_allocate(w,e.id,nullif(p_payload->>'project_id','')::uuid,nullif(p_payload->>'starts_at','')::date,nullif(p_payload->>'ends_at','')::date,coalesce(nullif(p_payload->>'allocation_pct','')::numeric,100),coalesce(p_payload->>'reason',''));
  ELSE token_value:=public.hiring_employment_invite(w,e.id);r:=e.id;END IF;
 END IF;
 PERFORM set_config('request.jwt.claims',coalesce(oldclaims,''),true);PERFORM set_config('request.jwt.claim.sub',coalesce(oldsub,''),true);PERFORM set_config('request.jwt.claim.role',coalesce(oldrole,''),true);
 RETURN jsonb_build_object('handled',true,'id',r,'person_id',e.person_id,'engagement_id',e.id);
END $$;
REVOKE ALL ON FUNCTION public.hiring_workflow_employment(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_workflow_employment(uuid,uuid,uuid,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.hiring_allocation_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e hiring_engagements;BEGIN
 IF NEW.hiring_engagement_id IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND(to_jsonb(NEW)-ARRAY['updated_at'])=(to_jsonb(OLD)-ARRAY['updated_at']) THEN RETURN NEW;END IF;
 SELECT * INTO e FROM hiring_engagements WHERE id=NEW.hiring_engagement_id;
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(e.workspace_id,e.id,coalesce(auth.uid(),e.created_by),'allocation_'||lower(TG_OP),jsonb_build_object('allocation_id',NEW.id,'status',NEW.status,'starts_at',NEW.starts_at,'ends_at',NEW.ends_at,'reason',NEW.period_override_reason,'service',auth.uid() IS NULL));RETURN NEW;
END $$;
CREATE TRIGGER hiring_allocation_audit AFTER INSERT OR UPDATE ON public.people_allocations FOR EACH ROW EXECUTE FUNCTION public.hiring_allocation_audit();
REVOKE ALL ON FUNCTION public.hiring_allocation_audit() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_allocation_keep_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF OLD.hiring_engagement_id IS NOT NULL THEN RAISE EXCEPTION 'Encerre a alocação integrada em vez de apagar seu histórico.';END IF;RETURN OLD;END $$;
CREATE TRIGGER hiring_allocation_keep_history BEFORE DELETE ON public.people_allocations FOR EACH ROW EXECUTE FUNCTION public.hiring_allocation_keep_history();
REVOKE ALL ON FUNCTION public.hiring_allocation_keep_history() FROM PUBLIC,anon,authenticated;

CREATE UNIQUE INDEX hiring_allocation_identity ON public.people_allocations(hiring_engagement_id,project_id,starts_at,coalesce(ends_at,'infinity'::date)) WHERE hiring_engagement_id IS NOT NULL AND project_id IS NOT NULL AND status='active';
CREATE OR REPLACE FUNCTION public.hiring_job_role_context(w uuid,p_job uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j ats_jobs;BEGIN
 IF NOT public.hiring_stage2_access(w,'view',p_job) THEN RAISE EXCEPTION 'Sem permissão para o cargo da demanda.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM ats_jobs WHERE id=p_job AND workspace_id=w;
 RETURN jsonb_build_object('role_id',j.hiring_role_id,'revision',j.hiring_revision,'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name) FROM job_roles WHERE workspace_id=w OR workspace_id IS NULL),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.hiring_job_role_set(w uuid,p_job uuid,p_revision integer,p_role uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j ats_jobs;BEGIN
 IF NOT public.hiring_stage2_access(w,'update',p_job) THEN RAISE EXCEPTION 'Sem permissão para alterar cargo da demanda.' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM ats_jobs WHERE id=p_job AND workspace_id=w FOR UPDATE;
 IF j.id IS NULL OR j.hiring_revision<>p_revision THEN RAISE EXCEPTION 'Demanda alterada. Recarregue.';END IF;
 IF NOT EXISTS(SELECT 1 FROM job_roles WHERE id=p_role AND(workspace_id=w OR workspace_id IS NULL)) THEN RAISE EXCEPTION 'Cargo indisponível.';END IF;
 UPDATE ats_jobs SET hiring_role_id=p_role WHERE id=j.id;
 INSERT INTO hiring_demand_events(workspace_id,job_id,actor_id,kind,detail) VALUES(w,j.id,auth.uid(),'access_role_changed',jsonb_build_object('role_id',p_role));
END $$;
CREATE OR REPLACE FUNCTION public.hiring_employment_model_change(w uuid,p_engagement uuid,p_revision integer,p_model uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e hiring_engagements;m hiring_access_models;v hiring_access_model_versions;g hiring_access_grants;s uuid;assignment uuid;BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR e.status<>'active' OR NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('people','update',e.person_id) OR NOT public.is_workspace_admin_v2(w,auth.uid()) OR NOT public.user_has_permission(auth.uid(),w,'system.roles.manage.workspace') THEN RAISE EXCEPTION 'Sem permissão para revisar acesso do vínculo.' USING ERRCODE='42501';END IF;
 IF e.revision<>p_revision OR length(trim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Recarregue o vínculo e informe motivo da revisão.';END IF;
 IF public.hiring_recruitment_reason(w,e.job_id) IS NOT NULL THEN RAISE EXCEPTION 'A demanda precisa de aprovação vigente antes de mudar o acesso.';END IF;
 SELECT * INTO m FROM hiring_access_models WHERE id=p_model AND workspace_id=w AND active FOR SHARE;
 IF m.id IS NULL OR m.role_id IS DISTINCT FROM(SELECT hiring_role_id FROM ats_jobs WHERE id=e.job_id AND workspace_id=w) THEN RAISE EXCEPTION 'Modelo incompatível com cargo da demanda aprovada.';END IF;
 SELECT * INTO v FROM hiring_access_model_versions WHERE model_id=m.id AND revision=m.revision AND workspace_id=w;
 IF v.id=e.model_version_id THEN RETURN;END IF;
 SELECT * INTO g FROM hiring_access_grants WHERE engagement_id=e.id AND revoked_at IS NULL FOR UPDATE;
 UPDATE hiring_engagements SET model_version_id=v.id,revision=revision+1 WHERE id=e.id;
 IF g.id IS NOT NULL THEN
  DELETE FROM user_permission_sets WHERE id=g.assignment_id AND user_id=g.user_id AND set_id=g.set_id AND workspace_id=w;
  UPDATE hiring_access_grants SET revoked_at=now() WHERE id=g.id;
  PERFORM set_config('app.hiring_grant','on',true);
  INSERT INTO permission_sets(owner_id,workspace_id,module,name,description,is_system) VALUES(w,w,'__hiring__','Vínculo '||e.id::text||' revisão '||(e.revision+1),v.name||' · revisão '||v.revision,false) RETURNING id INTO s;
  INSERT INTO permission_set_items(set_id,permission_key) SELECT s,k FROM unnest(v.permission_keys)k;
  INSERT INTO user_permission_sets(user_id,owner_id,workspace_id,set_id) VALUES(g.user_id,w,w,s) RETURNING id INTO assignment;
  INSERT INTO hiring_access_grants(workspace_id,engagement_id,user_id,set_id,assignment_id) VALUES(w,e.id,g.user_id,s,assignment);
  PERFORM set_config('app.hiring_grant','off',true);
 END IF;
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(w,e.id,auth.uid(),'access_model_changed',jsonb_build_object('previous_version',e.model_version_id,'new_version',v.id,'reason',trim(p_reason)));
END $$;
REVOKE ALL ON FUNCTION public.hiring_job_role_context(uuid,uuid),public.hiring_job_role_set(uuid,uuid,integer,uuid),public.hiring_employment_model_change(uuid,uuid,integer,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_job_role_context(uuid,uuid),public.hiring_job_role_set(uuid,uuid,integer,uuid),public.hiring_employment_model_change(uuid,uuid,integer,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.hiring_assignment_revoked() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE g hiring_access_grants;BEGIN
 FOR g IN SELECT * FROM hiring_access_grants WHERE set_id=OLD.set_id AND user_id=OLD.user_id AND workspace_id=OLD.workspace_id AND revoked_at IS NULL LOOP
  UPDATE hiring_access_grants SET revoked_at=now() WHERE id=g.id;
  INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) SELECT g.workspace_id,g.engagement_id,coalesce(auth.uid(),e.created_by),'access_assignment_revoked',jsonb_build_object('assignment_id',OLD.id,'service',auth.uid() IS NULL) FROM hiring_engagements e WHERE e.id=g.engagement_id;
 END LOOP;RETURN OLD;
END $$;
CREATE TRIGGER hiring_assignment_revoked AFTER DELETE ON public.user_permission_sets FOR EACH ROW EXECUTE FUNCTION public.hiring_assignment_revoked();
REVOKE ALL ON FUNCTION public.hiring_assignment_revoked() FROM PUBLIC,anon,authenticated;
