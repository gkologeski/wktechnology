-- Reemissão de convite revogado preserva pacote e histórico anteriores; respeita a chave única real do catálogo.
CREATE OR REPLACE FUNCTION public.hiring_employment_context(w uuid,p_person uuid,p_candidate uuid DEFAULT NULL,p_search text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.hiring_employment_access(w,'techpeople.employment.view.workspace') OR (p_person IS NOT NULL AND NOT public.hr_record_access('people','view',p_person)) OR(p_candidate IS NOT NULL AND NOT public.hr_record_access('candidates','view',p_candidate)) OR(p_person IS NULL AND p_candidate IS NULL) THEN RAISE EXCEPTION 'Sem permissão para vínculos.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('engagements',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('person_name',pe.full_name,'model_name',v.name,'allocation_only',v.allocation_only,'access_active',EXISTS(SELECT 1 FROM hiring_access_grants g JOIN user_permission_sets us ON us.id=g.assignment_id AND us.set_id=g.set_id AND us.user_id=g.user_id WHERE g.engagement_id=e.id AND g.revoked_at IS NULL),'invite_pending',EXISTS(SELECT 1 FROM workspace_invites i WHERE i.hiring_engagement_id=e.id AND i.accepted_at IS NULL AND i.expires_at>now()))) FROM hiring_engagements e JOIN people pe ON pe.id=e.person_id JOIN hiring_access_model_versions v ON v.id=e.model_version_id WHERE e.workspace_id=w AND(e.person_id=p_person OR (p_candidate IS NOT NULL AND EXISTS(SELECT 1 FROM ats_applications a WHERE a.id=e.application_id AND a.candidate_id=p_candidate))) AND public.hr_record_access('people','view',e.person_id)),'[]'),
 'models',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM hiring_access_models WHERE workspace_id=w AND active),'[]'),
 'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM legal_entities WHERE workspace_id=w AND active),'[]'),
 'applications',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'job_id',j.id,'title',j.title,'status',a.status,'purpose',j.hiring_purpose,'employment',j.employment_type,'hire_date',a.hiring_details->>'start_date','entity_id',c.contracting_legal_entity_id,'starts_at',c.starts_at,'ends_at',c.ends_at,'reason',public.hiring_recruitment_reason(w,j.id))) FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id LEFT JOIN contracts c ON c.id=j.hiring_contract_id AND c.workspace_id=w WHERE a.workspace_id=w AND a.candidate_id=p_candidate AND public.hr_record_access('applications','view',a.id)),'[]'),
 'contracts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title)) FROM (SELECT id,title FROM contracts WHERE workspace_id=w AND role='client' AND document_kind='main' AND title ILIKE '%'||left(coalesce(p_search,''),100)||'%' AND public.work_record_access('techcontracts.contracts',id,'view') ORDER BY title,id LIMIT 50)x),'[]'),
 'projects',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name)) FROM (SELECT id,name FROM projects WHERE workspace_id=w AND name ILIKE '%'||left(coalesce(p_search,''),100)||'%' AND public.work_record_access('techprojects.projects',id,'view') ORDER BY name,id LIMIT 50)x),'[]'),
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name)) FROM (SELECT id,full_name FROM people WHERE p_candidate IS NOT NULL AND workspace_id=w AND NOT archived AND full_name ILIKE '%'||left(coalesce(p_search,''),100)||'%' AND public.hr_record_access('people','update',id) ORDER BY full_name,id LIMIT 50)x),'[]'));
END $$;

CREATE OR REPLACE FUNCTION public.hiring_employment_invite(w uuid,p_engagement uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e hiring_engagements;pe people;i workspace_invites;token_value text;BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR e.status<>'active' OR NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('people','update',e.person_id) OR NOT public.is_workspace_admin_v2(w,auth.uid()) OR NOT public.user_has_permission(auth.uid(),w,'system.roles.manage.workspace') THEN RAISE EXCEPTION 'Somente administrador autorizado pode preparar acesso.' USING ERRCODE='42501';END IF;
 IF public.hiring_recruitment_reason(w,e.job_id) IS NOT NULL OR (e.ends_at IS NOT NULL AND e.ends_at<current_date) THEN RAISE EXCEPTION 'Vínculo sem autorização atual ou expirado.';END IF;
 IF EXISTS(SELECT 1 FROM hiring_access_grants g JOIN user_permission_sets us ON us.id=g.assignment_id AND us.set_id=g.set_id AND us.user_id=g.user_id WHERE g.engagement_id=e.id AND g.revoked_at IS NULL) THEN RAISE EXCEPTION 'O acesso deste vínculo já foi aplicado. Use a revisão do modelo para alterar a concessão.';END IF;
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
 INSERT INTO permission_sets(owner_id,workspace_id,module,name,description,is_system) VALUES(e.workspace_id,e.workspace_id,'__hiring__','Vínculo '||e.id::text||' · '||gen_random_uuid()::text,v.name||' · revisão '||v.revision,false) RETURNING id INTO s;
 INSERT INTO permission_set_items(set_id,permission_key) SELECT s,k FROM unnest(v.permission_keys)k;
 INSERT INTO user_permission_sets(user_id,owner_id,workspace_id,set_id) VALUES(auth.uid(),e.workspace_id,e.workspace_id,s) RETURNING id INTO assignment;
 INSERT INTO hiring_access_grants(workspace_id,engagement_id,user_id,set_id,assignment_id) VALUES(e.workspace_id,e.id,auth.uid(),s,assignment);
 PERFORM set_config('app.hiring_grant','off',true);PERFORM set_config('app.hiring_invite','on',true);
 UPDATE workspace_invites SET accepted_at=now() WHERE id=i.id;PERFORM set_config('app.hiring_invite','off',true);
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(e.workspace_id,e.id,auth.uid(),'access_accepted',jsonb_build_object('model_version',v.id,'assignment',assignment));
 -- Sem user_job_roles: cargo comercial genérico não é concedido.
 RETURN e.id;
END $$;
NOTIFY pgrst,'reload schema';
