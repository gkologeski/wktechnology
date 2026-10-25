-- Ordem 5: field protections are enforced before values leave PostgreSQL.
-- The view owner has no LOGIN/BYPASSRLS, inherits the same authenticated policies,
-- and cannot be assumed by browser/API clients. No job-role grants are changed.
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='techerp_shared_fields') THEN CREATE ROLE techerp_shared_fields NOLOGIN NOBYPASSRLS;ELSIF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='techerp_shared_fields' AND (rolcanlogin OR rolbypassrls OR rolsuper)) THEN RAISE EXCEPTION 'Unsafe field-view owner';END IF;END$$;
GRANT authenticated TO techerp_shared_fields;
GRANT techerp_shared_fields TO postgres;
GRANT USAGE,CREATE ON SCHEMA public TO techerp_shared_fields;
CREATE TABLE public.shared_field_catalog(resource text NOT NULL,table_name name NOT NULL,field name NOT NULL,configurable boolean NOT NULL DEFAULT true,guard_fields text[],PRIMARY KEY(resource,field));
ALTER TABLE public.shared_field_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_field_catalog FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_field_catalog TO techerp_shared_fields,authenticated;
CREATE POLICY shared_field_catalog_read ON public.shared_field_catalog FOR SELECT TO authenticated USING(true);
INSERT INTO public.shared_field_catalog VALUES('techsales.contacts','contacts','email',true,ARRAY['email']);
INSERT INTO public.shared_field_catalog VALUES('techsales.contacts','contacts','phone',true,ARRAY['phone']);
INSERT INTO public.shared_field_catalog VALUES('techsales.contacts','contacts','mobile_phone',true,ARRAY['mobile_phone']);
INSERT INTO public.shared_field_catalog VALUES('techsales.contacts','contacts','hs_raw',false,NULL);
INSERT INTO public.shared_field_catalog VALUES('techsales.contacts','contacts','phone_digits',false,ARRAY['phone']);
INSERT INTO public.shared_field_catalog VALUES('techsales.contacts','contacts','mobile_phone_digits',false,ARRAY['mobile_phone']);
INSERT INTO public.shared_field_catalog VALUES('techsales.contacts','contacts','whatsapp_e164',false,ARRAY['phone','mobile_phone']);
INSERT INTO public.shared_field_catalog VALUES('techsales.contacts','contacts','whatsapp_digits',false,ARRAY['phone','mobile_phone']);
INSERT INTO public.shared_field_catalog VALUES('techsales.leads','leads','score',true,ARRAY['score']);
INSERT INTO public.shared_field_catalog VALUES('techsales.leads','leads','hs_raw',false,ARRAY['score']);
INSERT INTO public.shared_field_catalog VALUES('techsales.deals','deals','value',true,ARRAY['value']);
INSERT INTO public.shared_field_catalog VALUES('techsales.deals','deals','hs_raw',false,ARRAY['value']);
INSERT INTO public.shared_field_catalog VALUES('techhire.candidates','ats_candidates','email',true,ARRAY['email']);
INSERT INTO public.shared_field_catalog VALUES('techhire.candidates','ats_candidates','phone',true,ARRAY['phone']);
INSERT INTO public.shared_field_catalog VALUES('techhire.candidates','ats_candidates','cv_parsed',false,ARRAY['email','phone']);
INSERT INTO public.shared_field_catalog VALUES('techhire.offers','ats_offers','salary_amount',true,ARRAY['salary_amount']);
INSERT INTO public.shared_field_catalog VALUES('techhire.offers','ats_offers','body',false,ARRAY['salary_amount']);
INSERT INTO public.shared_field_catalog VALUES('techhire.interviews','ats_interviews','notes',true,ARRAY['notes']);
INSERT INTO public.shared_field_catalog VALUES('techsales.deals','deal_line_items','unit_price',false,ARRAY['value']);
INSERT INTO public.shared_field_catalog VALUES('techsales.deals','deal_line_items','discount_pct',false,ARRAY['value']);
INSERT INTO public.shared_field_catalog VALUES('techsales.deals','deal_line_items','tax_rate',false,ARRAY['value']);
INSERT INTO public.shared_field_catalog VALUES('techsales.deals','deal_line_items','discount_amount',false,ARRAY['value']);
INSERT INTO public.shared_field_catalog VALUES('techsales.deals','deal_line_items','percent',false,ARRAY['value']);
INSERT INTO public.shared_field_catalog VALUES('techsales.deals','deal_line_items','percent_base_amount',false,ARRAY['value']);
CREATE OR REPLACE FUNCTION public.shared_field_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;rules jsonb;invalid jsonb;BEGIN
 IF w IS NULL OR u IS NULL THEN RETURN jsonb_build_object('workspace_id',NULL,'is_privileged',false,'rules','{}'::jsonb,'invalid_rules','[]'::jsonb);END IF;
 IF EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=u AND status='active' AND role IN('owner','admin')) THEN RETURN jsonb_build_object('workspace_id',w,'is_privileged',true,'rules','{}'::jsonb,'invalid_rules','[]'::jsonb);END IF;
 WITH roles AS (SELECT uj.role_id FROM user_job_roles uj JOIN job_roles jr ON jr.id=uj.role_id WHERE uj.user_id=u AND uj.workspace_id=w AND (jr.workspace_id IS NULL OR jr.workspace_id=w)),sets AS (
 SELECT ps.id FROM user_permission_sets us JOIN permission_sets ps ON ps.id=us.set_id WHERE us.user_id=u AND us.workspace_id=w AND (ps.workspace_id=w OR (ps.workspace_id IS NULL AND ps.module<>'__bundle__'))
 UNION SELECT ps.id FROM roles r JOIN job_role_sets jrs ON jrs.role_id=r.role_id LEFT JOIN job_role_set_replacements rep ON rep.workspace_id=w AND rep.role_id=r.role_id AND rep.set_id=jrs.set_id JOIN permission_sets ps ON ps.id=coalesce(rep.replacement_set_id,jrs.set_id) WHERE (ps.workspace_id=w OR (ps.workspace_id IS NULL AND ps.module<>'__bundle__')) AND (rep.replacement_set_id IS NULL OR ps.workspace_id=w)
 ), applicable AS (
 SELECT f.resource,CASE WHEN f.resource='techhire.offers' AND f.field='amount' THEN 'salary_amount' WHEN f.resource='techhire.interviews' AND f.field='private_notes' THEN 'notes' ELSE f.field END field,f.mode FROM field_permission_rules f WHERE (f.workspace_id IS NULL OR f.workspace_id=w) AND (f.role_id IN(SELECT role_id FROM roles) OR f.set_id IN(SELECT id FROM sets))
 ), ranked AS (SELECT a.resource,a.field,max(CASE mode WHEN 'hidden' THEN 3 WHEN 'masked' THEN 2 ELSE 1 END) rank FROM applicable a JOIN shared_field_catalog c ON c.resource=a.resource AND c.field::text=a.field AND c.configurable GROUP BY a.resource,a.field), grouped AS (SELECT resource,jsonb_object_agg(field,CASE rank WHEN 3 THEN 'hidden' WHEN 2 THEN 'masked' ELSE 'readonly' END) values FROM ranked GROUP BY resource)
 SELECT coalesce((SELECT jsonb_object_agg(resource,values) FROM grouped),'{}'),coalesce((SELECT jsonb_agg(jsonb_build_object('resource',a.resource,'field',a.field,'reason','Campo sem contrato de proteção no schema atual')) FROM applicable a WHERE NOT EXISTS(SELECT 1 FROM shared_field_catalog c WHERE c.resource=a.resource AND c.field::text=a.field AND c.configurable)),'[]') INTO rules,invalid;
 RETURN jsonb_build_object('workspace_id',w,'is_privileged',false,'rules',rules,'invalid_rules',invalid);
END $$;
REVOKE ALL ON FUNCTION public.shared_field_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_field_context() TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_field_mode_for(rules jsonb,t text,f text)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT m.value FROM public.shared_field_catalog c CROSS JOIN LATERAL jsonb_each_text(coalesce(rules->c.resource,'{}'))m WHERE c.table_name=t AND c.field::text=f AND (c.guard_fields IS NULL OR m.key=ANY(c.guard_fields)) ORDER BY CASE m.value WHEN 'hidden' THEN 3 WHEN 'masked' THEN 2 ELSE 1 END DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.shared_field_mode_for(jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_field_mode_for(jsonb,text,text) TO authenticated,techerp_shared_fields,techerp_api_subject;
CREATE OR REPLACE FUNCTION public.shared_field_mask_row(t text,j jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=shared_field_context()->'rules';r text;k text;v text;BEGIN
 SELECT resource INTO r FROM shared_field_catalog WHERE table_name=t LIMIT 1;
 IF r IS NULL OR j IS NULL THEN RETURN j;END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each_text(coalesce(c->r,'{}')) LOOP
  IF j?k AND v IN('hidden','masked') THEN j:=jsonb_set(j,ARRAY[k],'null'::jsonb);END IF;
 END LOOP;
 FOR k IN SELECT field::text FROM shared_field_catalog WHERE table_name=t AND NOT configurable LOOP IF j?k AND public.shared_field_mode_for(c,t,k) IN('hidden','masked') THEN j:=jsonb_set(j,ARRAY[k],'null'::jsonb);END IF;END LOOP;RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.shared_field_mask_row(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_field_mask_row(text,jsonb) TO authenticated,techerp_shared_fields,techerp_api_subject;
GRANT SELECT ON public.shared_field_catalog TO techerp_api_subject;
-- Finite allowlist for creating new field rules. Unsupported legacy rules are reported,
-- never silently presented as effective protection.
CREATE OR REPLACE FUNCTION public.shared_field_rule_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f text:=CASE WHEN NEW.resource='techhire.offers' AND NEW.field='amount' THEN 'salary_amount' WHEN NEW.resource='techhire.interviews' AND NEW.field='private_notes' THEN 'notes' ELSE NEW.field END;BEGIN
 IF NOT EXISTS(SELECT 1 FROM shared_field_catalog WHERE resource=NEW.resource AND field::text=f AND configurable) THEN RAISE EXCEPTION 'Campo sem contrato de proteção. Escolha um campo disponível no catálogo.' USING ERRCODE='22023';END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shared_field_rule_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.shared_field_write_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;res text;field text;mode text;j jsonb:=to_jsonb(NEW);oldj jsonb;default_expr text;default_value jsonb;BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW;END IF;
 c:=shared_field_context()->'rules';SELECT resource INTO res FROM shared_field_catalog WHERE table_name=TG_TABLE_NAME LIMIT 1;
 IF res IS NULL OR coalesce(c->res,'{}')='{}' THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' THEN oldj:=to_jsonb(OLD);END IF;
 FOR field,mode IN SELECT f.field::text,public.shared_field_mode_for(c,TG_TABLE_NAME,f.field::text) FROM shared_field_catalog f WHERE f.table_name=TG_TABLE_NAME LOOP
  IF mode NOT IN('hidden','masked','readonly') OR NOT j?field THEN CONTINUE;END IF;
  -- Generated indices are computed after BEFORE triggers and cannot be assigned by callers.
  IF EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=TG_RELID AND a.attname=field AND a.attgenerated<>'') THEN CONTINUE;END IF;
  IF TG_OP='UPDATE' AND j->field IS DISTINCT FROM oldj->field THEN RAISE EXCEPTION 'Campo protegido por política: %',field USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' AND j->field<>'null'::jsonb THEN
   SELECT pg_get_expr(a.adbin,a.adrelid) INTO default_expr FROM pg_attrdef a JOIN pg_attribute c ON c.attrelid=a.adrelid AND c.attnum=a.adnum WHERE c.attrelid=TG_RELID AND c.attname=field;
   default_value:=NULL;IF default_expr IS NOT NULL THEN EXECUTE 'SELECT to_jsonb('||default_expr||')' INTO default_value;END IF;
   IF j->field IS DISTINCT FROM default_value THEN RAISE EXCEPTION 'Campo protegido por política: %',field USING ERRCODE='42501';END IF;
  END IF;
 END LOOP;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shared_field_write_guard() FROM PUBLIC,anon,authenticated;
GRANT SELECT("id","owner_id","company_id","first_name","last_name","email","phone","job_title","notes","created_at","updated_at","score","label","marketing_status","legal_basis","consent_date","external_ids","hs_raw","mobile_phone","country","address","cep","city","state","website","company_name","lifecyclestage","hs_lead_status","hubspot_owner_id","hs_object_id","hs_createdate","hs_lastmodifieddate","linkedin_url","twitter_handle","custom_fields","portal_enabled","workspace_id","deleted_at","assigned_user_id","assigned_to","whatsapp_e164","cargo_resumido","area_atuacao","nivel_hierarquico","cargo_catalog_version","photo_url","photo_source","photo_updated_at","phone_ext","phone_digits","mobile_phone_digits","whatsapp_digits") ON public.contacts TO techerp_shared_fields;
CREATE VIEW public.shared_fields_contacts WITH(security_barrier=true) AS SELECT b."id" AS "id",
b."owner_id" AS "owner_id",
b."company_id" AS "company_id",
b."first_name" AS "first_name",
b."last_name" AS "last_name",
CASE WHEN (m.rules->'techsales.contacts'->>'email' IN('hidden','masked')) THEN NULL ELSE b."email" END AS "email",
CASE WHEN (m.rules->'techsales.contacts'->>'phone' IN('hidden','masked')) THEN NULL ELSE b."phone" END AS "phone",
b."job_title" AS "job_title",
b."notes" AS "notes",
b."created_at" AS "created_at",
b."updated_at" AS "updated_at",
b."score" AS "score",
b."label" AS "label",
b."marketing_status" AS "marketing_status",
b."legal_basis" AS "legal_basis",
b."consent_date" AS "consent_date",
b."external_ids" AS "external_ids",
CASE WHEN jsonb_path_exists(coalesce(m.rules->'techsales.contacts','{}'),'$.* ? (@ == "hidden" || @ == "masked")') THEN NULL ELSE b."hs_raw" END AS "hs_raw",
CASE WHEN (m.rules->'techsales.contacts'->>'mobile_phone' IN('hidden','masked')) THEN NULL ELSE b."mobile_phone" END AS "mobile_phone",
b."country" AS "country",
b."address" AS "address",
b."cep" AS "cep",
b."city" AS "city",
b."state" AS "state",
b."website" AS "website",
b."company_name" AS "company_name",
b."lifecyclestage" AS "lifecyclestage",
b."hs_lead_status" AS "hs_lead_status",
b."hubspot_owner_id" AS "hubspot_owner_id",
b."hs_object_id" AS "hs_object_id",
b."hs_createdate" AS "hs_createdate",
b."hs_lastmodifieddate" AS "hs_lastmodifieddate",
b."linkedin_url" AS "linkedin_url",
b."twitter_handle" AS "twitter_handle",
b."custom_fields" AS "custom_fields",
b."portal_enabled" AS "portal_enabled",
b."workspace_id" AS "workspace_id",
b."deleted_at" AS "deleted_at",
b."assigned_user_id" AS "assigned_user_id",
b."assigned_to" AS "assigned_to",
CASE WHEN (m.rules->'techsales.contacts'->>'phone' IN('hidden','masked') OR m.rules->'techsales.contacts'->>'mobile_phone' IN('hidden','masked')) THEN NULL ELSE b."whatsapp_e164" END AS "whatsapp_e164",
b."cargo_resumido" AS "cargo_resumido",
b."area_atuacao" AS "area_atuacao",
b."nivel_hierarquico" AS "nivel_hierarquico",
b."cargo_catalog_version" AS "cargo_catalog_version",
b."photo_url" AS "photo_url",
b."photo_source" AS "photo_source",
b."photo_updated_at" AS "photo_updated_at",
b."phone_ext" AS "phone_ext",
CASE WHEN (m.rules->'techsales.contacts'->>'phone' IN('hidden','masked')) THEN NULL ELSE b."phone_digits" END AS "phone_digits",
CASE WHEN (m.rules->'techsales.contacts'->>'mobile_phone' IN('hidden','masked')) THEN NULL ELSE b."mobile_phone_digits" END AS "mobile_phone_digits",
CASE WHEN (m.rules->'techsales.contacts'->>'phone' IN('hidden','masked') OR m.rules->'techsales.contacts'->>'mobile_phone' IN('hidden','masked')) THEN NULL ELSE b."whatsapp_digits" END AS "whatsapp_digits" FROM public.contacts b CROSS JOIN LATERAL (SELECT public.shared_field_context()->'rules' rules OFFSET 0)m;
ALTER VIEW public.shared_fields_contacts OWNER TO techerp_shared_fields;
REVOKE ALL ON public.shared_fields_contacts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_fields_contacts TO authenticated;
GRANT SELECT("id","owner_id","first_name","last_name","email","phone","company_name","source","status","notes","converted_at","converted_contact_id","converted_deal_id","created_at","updated_at","pipeline_id","score","label","external_ids","stage_id","hs_raw","hubspot_owner_id","hs_object_id","hs_createdate","hs_lastmodifieddate","hs_lead_source_detail","custom_fields","workspace_id","deleted_at","assigned_user_id","company_id","nurture_started_at","assigned_to","mobile_phone","stage_substatus_id","linkedin_url","last_form_submission_at","whatsapp_e164","job_title","job_title_source","cargo_resumido","area_atuacao","nivel_hierarquico","cargo_catalog_version","photo_url","photo_source","photo_updated_at","phone_ext","phone_digits","mobile_phone_digits","whatsapp_digits") ON public.leads TO techerp_shared_fields;
CREATE VIEW public.shared_fields_leads WITH(security_barrier=true) AS SELECT b."id" AS "id",
b."owner_id" AS "owner_id",
b."first_name" AS "first_name",
b."last_name" AS "last_name",
b."email" AS "email",
b."phone" AS "phone",
b."company_name" AS "company_name",
b."source" AS "source",
b."status" AS "status",
b."notes" AS "notes",
b."converted_at" AS "converted_at",
b."converted_contact_id" AS "converted_contact_id",
b."converted_deal_id" AS "converted_deal_id",
b."created_at" AS "created_at",
b."updated_at" AS "updated_at",
b."pipeline_id" AS "pipeline_id",
CASE WHEN (m.rules->'techsales.leads'->>'score' IN('hidden','masked')) THEN NULL ELSE b."score" END AS "score",
b."label" AS "label",
b."external_ids" AS "external_ids",
b."stage_id" AS "stage_id",
CASE WHEN (m.rules->'techsales.leads'->>'score' IN('hidden','masked')) THEN NULL ELSE b."hs_raw" END AS "hs_raw",
b."hubspot_owner_id" AS "hubspot_owner_id",
b."hs_object_id" AS "hs_object_id",
b."hs_createdate" AS "hs_createdate",
b."hs_lastmodifieddate" AS "hs_lastmodifieddate",
b."hs_lead_source_detail" AS "hs_lead_source_detail",
b."custom_fields" AS "custom_fields",
b."workspace_id" AS "workspace_id",
b."deleted_at" AS "deleted_at",
b."assigned_user_id" AS "assigned_user_id",
b."company_id" AS "company_id",
b."nurture_started_at" AS "nurture_started_at",
b."assigned_to" AS "assigned_to",
b."mobile_phone" AS "mobile_phone",
b."stage_substatus_id" AS "stage_substatus_id",
b."linkedin_url" AS "linkedin_url",
b."last_form_submission_at" AS "last_form_submission_at",
b."whatsapp_e164" AS "whatsapp_e164",
b."job_title" AS "job_title",
b."job_title_source" AS "job_title_source",
b."cargo_resumido" AS "cargo_resumido",
b."area_atuacao" AS "area_atuacao",
b."nivel_hierarquico" AS "nivel_hierarquico",
b."cargo_catalog_version" AS "cargo_catalog_version",
b."photo_url" AS "photo_url",
b."photo_source" AS "photo_source",
b."photo_updated_at" AS "photo_updated_at",
b."phone_ext" AS "phone_ext",
b."phone_digits" AS "phone_digits",
b."mobile_phone_digits" AS "mobile_phone_digits",
b."whatsapp_digits" AS "whatsapp_digits" FROM public.leads b CROSS JOIN LATERAL (SELECT public.shared_field_context()->'rules' rules OFFSET 0)m;
ALTER VIEW public.shared_fields_leads OWNER TO techerp_shared_fields;
REVOKE ALL ON public.shared_fields_leads FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_fields_leads TO authenticated;
GRANT SELECT("id","owner_id","name","value","currency","stage","company_id","primary_contact_id","expected_close_date","notes","created_at","updated_at","pipeline_id","external_ids","stage_id","hs_raw","description","dealtype","hs_priority","hs_deal_stage_probability","hubspot_owner_id","hs_object_id","hs_createdate","hs_lastmodifieddate","closed_lost_reason","closed_won_reason","num_associated_contacts","custom_fields","workspace_id","deleted_at","assigned_user_id","assigned_to","closed_at","lost_at","stage_substatus_id","lead_id","source","service_line") ON public.deals TO techerp_shared_fields;
CREATE VIEW public.shared_fields_deals WITH(security_barrier=true) AS SELECT b."id" AS "id",
b."owner_id" AS "owner_id",
b."name" AS "name",
CASE WHEN (m.rules->'techsales.deals'->>'value' IN('hidden','masked')) THEN NULL ELSE b."value" END AS "value",
b."currency" AS "currency",
b."stage" AS "stage",
b."company_id" AS "company_id",
b."primary_contact_id" AS "primary_contact_id",
b."expected_close_date" AS "expected_close_date",
b."notes" AS "notes",
b."created_at" AS "created_at",
b."updated_at" AS "updated_at",
b."pipeline_id" AS "pipeline_id",
b."external_ids" AS "external_ids",
b."stage_id" AS "stage_id",
CASE WHEN (m.rules->'techsales.deals'->>'value' IN('hidden','masked')) THEN NULL ELSE b."hs_raw" END AS "hs_raw",
b."description" AS "description",
b."dealtype" AS "dealtype",
b."hs_priority" AS "hs_priority",
b."hs_deal_stage_probability" AS "hs_deal_stage_probability",
b."hubspot_owner_id" AS "hubspot_owner_id",
b."hs_object_id" AS "hs_object_id",
b."hs_createdate" AS "hs_createdate",
b."hs_lastmodifieddate" AS "hs_lastmodifieddate",
b."closed_lost_reason" AS "closed_lost_reason",
b."closed_won_reason" AS "closed_won_reason",
b."num_associated_contacts" AS "num_associated_contacts",
b."custom_fields" AS "custom_fields",
b."workspace_id" AS "workspace_id",
b."deleted_at" AS "deleted_at",
b."assigned_user_id" AS "assigned_user_id",
b."assigned_to" AS "assigned_to",
b."closed_at" AS "closed_at",
b."lost_at" AS "lost_at",
b."stage_substatus_id" AS "stage_substatus_id",
b."lead_id" AS "lead_id",
b."source" AS "source",
b."service_line" AS "service_line" FROM public.deals b CROSS JOIN LATERAL (SELECT public.shared_field_context()->'rules' rules OFFSET 0)m;
ALTER VIEW public.shared_fields_deals OWNER TO techerp_shared_fields;
REVOKE ALL ON public.shared_fields_deals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_fields_deals TO authenticated;
GRANT SELECT("id","owner_id","full_name","email","phone","linkedin_url","location","current_position","current_company","cv_url","cv_parsed","skills","tags","source","score","notes","created_by","created_at","updated_at","dei_gender","dei_race","dei_disability","dei_lgbtqia","relationship_status","last_touch_at","next_action_at","relationship_owner_id","retention_until","lgpd_redacted_at","archived","headline","about","photo_url","experiences","education","certifications","languages","skills_detailed","projects","publications","volunteering","open_to_work","connection_degree","available_actions","external_links","current_company_data","recent_activity","recommendations","captured_at","capture_version","assigned_to","workspace_id") ON public.ats_candidates TO techerp_shared_fields;
CREATE VIEW public.shared_fields_ats_candidates WITH(security_barrier=true) AS SELECT b."id" AS "id",
b."owner_id" AS "owner_id",
b."full_name" AS "full_name",
CASE WHEN (m.rules->'techhire.candidates'->>'email' IN('hidden','masked')) THEN NULL ELSE b."email" END AS "email",
CASE WHEN (m.rules->'techhire.candidates'->>'phone' IN('hidden','masked')) THEN NULL ELSE b."phone" END AS "phone",
b."linkedin_url" AS "linkedin_url",
b."location" AS "location",
b."current_position" AS "current_position",
b."current_company" AS "current_company",
b."cv_url" AS "cv_url",
CASE WHEN (m.rules->'techhire.candidates'->>'email' IN('hidden','masked') OR m.rules->'techhire.candidates'->>'phone' IN('hidden','masked')) THEN NULL ELSE b."cv_parsed" END AS "cv_parsed",
b."skills" AS "skills",
b."tags" AS "tags",
b."source" AS "source",
b."score" AS "score",
b."notes" AS "notes",
b."created_by" AS "created_by",
b."created_at" AS "created_at",
b."updated_at" AS "updated_at",
b."dei_gender" AS "dei_gender",
b."dei_race" AS "dei_race",
b."dei_disability" AS "dei_disability",
b."dei_lgbtqia" AS "dei_lgbtqia",
b."relationship_status" AS "relationship_status",
b."last_touch_at" AS "last_touch_at",
b."next_action_at" AS "next_action_at",
b."relationship_owner_id" AS "relationship_owner_id",
b."retention_until" AS "retention_until",
b."lgpd_redacted_at" AS "lgpd_redacted_at",
b."archived" AS "archived",
b."headline" AS "headline",
b."about" AS "about",
b."photo_url" AS "photo_url",
b."experiences" AS "experiences",
b."education" AS "education",
b."certifications" AS "certifications",
b."languages" AS "languages",
b."skills_detailed" AS "skills_detailed",
b."projects" AS "projects",
b."publications" AS "publications",
b."volunteering" AS "volunteering",
b."open_to_work" AS "open_to_work",
b."connection_degree" AS "connection_degree",
b."available_actions" AS "available_actions",
b."external_links" AS "external_links",
b."current_company_data" AS "current_company_data",
b."recent_activity" AS "recent_activity",
b."recommendations" AS "recommendations",
b."captured_at" AS "captured_at",
b."capture_version" AS "capture_version",
b."assigned_to" AS "assigned_to",
b."workspace_id" AS "workspace_id" FROM public.ats_candidates b CROSS JOIN LATERAL (SELECT public.shared_field_context()->'rules' rules OFFSET 0)m;
ALTER VIEW public.shared_fields_ats_candidates OWNER TO techerp_shared_fields;
REVOKE ALL ON public.shared_fields_ats_candidates FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_fields_ats_candidates TO authenticated;
GRANT SELECT("id","owner_id","application_id","candidate_id","job_id","title","start_date","status","esign_document_id","promote_to_stage","sent_at","signed_at","declined_at","decline_reason","created_at","updated_at","viewed_at","assigned_to","workspace_id","approval_status","revision","approved_revision","approved_by","approved_at") ON public.ats_offers TO techerp_shared_fields;
CREATE VIEW public.shared_fields_ats_offers WITH(security_barrier=true) AS SELECT b."id" AS "id",
b."owner_id" AS "owner_id",
b."application_id" AS "application_id",
b."candidate_id" AS "candidate_id",
b."job_id" AS "job_id",
b."title" AS "title",
b."start_date" AS "start_date",
b."status" AS "status",
b."esign_document_id" AS "esign_document_id",
b."promote_to_stage" AS "promote_to_stage",
b."sent_at" AS "sent_at",
b."signed_at" AS "signed_at",
b."declined_at" AS "declined_at",
b."decline_reason" AS "decline_reason",
b."created_at" AS "created_at",
b."updated_at" AS "updated_at",
b."viewed_at" AS "viewed_at",
b."assigned_to" AS "assigned_to",
b."workspace_id" AS "workspace_id",
b."approval_status" AS "approval_status",
b."revision" AS "revision",
b."approved_revision" AS "approved_revision",
b."approved_by" AS "approved_by",
b."approved_at" AS "approved_at" FROM public.ats_offers b CROSS JOIN LATERAL (SELECT public.shared_field_context()->'rules' rules OFFSET 0)m;
ALTER VIEW public.shared_fields_ats_offers OWNER TO techerp_shared_fields;
REVOKE ALL ON public.shared_fields_ats_offers FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_fields_ats_offers TO authenticated;
GRANT SELECT("id","owner_id","application_id","job_id","candidate_id","interviewer_id","stage_value","kind","status","scheduled_at","duration_min","meet_url","location","notes","self_schedule_token","self_schedule_expires_at","slots","reminder_d1_sent_at","reminder_1h_sent_at","created_at","updated_at","interview_kit_id","async_questions_snapshot","offered_slots","self_scheduled_at","transcript","ai_summary","ai_strengths","ai_concerns","ai_followups","ai_recommendation","ai_score","ai_generated_at","ai_model","pool_id","panel_interviewer_ids","auto_rescheduled_from","meeting_id","assigned_to","workspace_id") ON public.ats_interviews TO techerp_shared_fields;
CREATE VIEW public.shared_fields_ats_interviews WITH(security_barrier=true) AS SELECT b."id" AS "id",
b."owner_id" AS "owner_id",
b."application_id" AS "application_id",
b."job_id" AS "job_id",
b."candidate_id" AS "candidate_id",
b."interviewer_id" AS "interviewer_id",
b."stage_value" AS "stage_value",
b."kind" AS "kind",
b."status" AS "status",
b."scheduled_at" AS "scheduled_at",
b."duration_min" AS "duration_min",
b."meet_url" AS "meet_url",
b."location" AS "location",
CASE WHEN (m.rules->'techhire.interviews'->>'notes' IN('hidden','masked')) THEN NULL ELSE b."notes" END AS "notes",
b."self_schedule_token" AS "self_schedule_token",
b."self_schedule_expires_at" AS "self_schedule_expires_at",
b."slots" AS "slots",
b."reminder_d1_sent_at" AS "reminder_d1_sent_at",
b."reminder_1h_sent_at" AS "reminder_1h_sent_at",
b."created_at" AS "created_at",
b."updated_at" AS "updated_at",
b."interview_kit_id" AS "interview_kit_id",
b."async_questions_snapshot" AS "async_questions_snapshot",
b."offered_slots" AS "offered_slots",
b."self_scheduled_at" AS "self_scheduled_at",
b."transcript" AS "transcript",
b."ai_summary" AS "ai_summary",
b."ai_strengths" AS "ai_strengths",
b."ai_concerns" AS "ai_concerns",
b."ai_followups" AS "ai_followups",
b."ai_recommendation" AS "ai_recommendation",
b."ai_score" AS "ai_score",
b."ai_generated_at" AS "ai_generated_at",
b."ai_model" AS "ai_model",
b."pool_id" AS "pool_id",
b."panel_interviewer_ids" AS "panel_interviewer_ids",
b."auto_rescheduled_from" AS "auto_rescheduled_from",
b."meeting_id" AS "meeting_id",
b."assigned_to" AS "assigned_to",
b."workspace_id" AS "workspace_id" FROM public.ats_interviews b CROSS JOIN LATERAL (SELECT public.shared_field_context()->'rules' rules OFFSET 0)m;
ALTER VIEW public.shared_fields_ats_interviews OWNER TO techerp_shared_fields;
REVOKE ALL ON public.shared_fields_ats_interviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_fields_ats_interviews TO authenticated;
GRANT SELECT("id","owner_id","deal_id","name","description","quantity","unit_price","discount_pct","tax_rate","position","created_at","updated_at","workspace_id","discount_amount","discount_type","service_catalog_id","contracting_preset_id","job_profile_id","seniority","unit","billing_model","percent","percent_base_amount","cadence") ON public.deal_line_items TO techerp_shared_fields;
CREATE VIEW public.shared_fields_deal_line_items WITH(security_barrier=true) AS SELECT b."id" AS "id",
b."owner_id" AS "owner_id",
b."deal_id" AS "deal_id",
b."name" AS "name",
b."description" AS "description",
b."quantity" AS "quantity",
CASE WHEN (m.rules->'techsales.deals'->>'value' IN('hidden','masked')) THEN NULL ELSE b."unit_price" END AS "unit_price",
CASE WHEN (m.rules->'techsales.deals'->>'value' IN('hidden','masked')) THEN NULL ELSE b."discount_pct" END AS "discount_pct",
CASE WHEN (m.rules->'techsales.deals'->>'value' IN('hidden','masked')) THEN NULL ELSE b."tax_rate" END AS "tax_rate",
b."position" AS "position",
b."created_at" AS "created_at",
b."updated_at" AS "updated_at",
b."workspace_id" AS "workspace_id",
CASE WHEN (m.rules->'techsales.deals'->>'value' IN('hidden','masked')) THEN NULL ELSE b."discount_amount" END AS "discount_amount",
b."discount_type" AS "discount_type",
b."service_catalog_id" AS "service_catalog_id",
b."contracting_preset_id" AS "contracting_preset_id",
b."job_profile_id" AS "job_profile_id",
b."seniority" AS "seniority",
b."unit" AS "unit",
b."billing_model" AS "billing_model",
CASE WHEN (m.rules->'techsales.deals'->>'value' IN('hidden','masked')) THEN NULL ELSE b."percent" END AS "percent",
CASE WHEN (m.rules->'techsales.deals'->>'value' IN('hidden','masked')) THEN NULL ELSE b."percent_base_amount" END AS "percent_base_amount",
b."cadence" AS "cadence" FROM public.deal_line_items b CROSS JOIN LATERAL (SELECT public.shared_field_context()->'rules' rules OFFSET 0)m;
ALTER VIEW public.shared_fields_deal_line_items OWNER TO techerp_shared_fields;
REVOKE ALL ON public.shared_fields_deal_line_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_fields_deal_line_items TO authenticated;
REVOKE CREATE ON SCHEMA public FROM techerp_shared_fields;
CREATE OR REPLACE FUNCTION public.shared_field_mask_rows(t text,rows jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT CASE WHEN jsonb_typeof(rows)='array' THEN coalesce((SELECT jsonb_agg(public.shared_field_mask_row(t,x)) FROM jsonb_array_elements(rows)x),'[]') ELSE public.shared_field_mask_row(t,rows) END $$;
REVOKE ALL ON FUNCTION public.shared_field_mask_rows(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_field_mask_rows(text,jsonb) TO authenticated,techerp_api_subject;

-- Configuration writes are administrative even when legacy owner policies allow
-- the row. Service migrations retain an explicit technical exception.
CREATE OR REPLACE FUNCTION public.shared_field_rule_admin_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;v jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;w uuid;BEGIN
 IF auth.uid() IS NULL THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 c:=work_access_context();w:=(c->>'workspace')::uuid;
 IF w IS NULL OR coalesce((c->>'read_only')::boolean,true) OR NOT(c->'keys'?'system.roles.manage.workspace') OR NOT EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=w AND m.user_id=auth.uid() AND m.status='active' AND m.role IN('owner','admin')) OR v->>'workspace_id' IS DISTINCT FROM w::text OR coalesce((v->>'is_system')::boolean,false) THEN RAISE EXCEPTION 'Sem permissão para alterar regras de campo.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 IF TG_OP='UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.id IS DISTINCT FROM OLD.id OR OLD.is_system) THEN RAISE EXCEPTION 'Identidade da regra é imutável.' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' AND NEW.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Autor inválido.' USING ERRCODE='42501';END IF;
 IF (NEW.role_id IS NULL)=(NEW.set_id IS NULL) OR (NEW.role_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM job_roles r WHERE r.id=NEW.role_id AND (r.workspace_id IS NULL OR r.workspace_id=w))) OR (NEW.set_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM permission_sets s WHERE s.id=NEW.set_id AND (s.workspace_id IS NULL OR s.workspace_id=w))) THEN RAISE EXCEPTION 'Cargo ou pacote indisponível neste workspace.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shared_field_rule_admin_guard() FROM PUBLIC,anon,authenticated;
