-- Preserve field ACLs while repairing existing authorized consumers. No grants change.
CREATE OR REPLACE FUNCTION public.link_contacts_by_email_domain(p_workspace uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_free text[] := ARRAY[
    'gmail.com','hotmail.com','outlook.com','outlook.com.br','live.com','msn.com',
    'yahoo.com','yahoo.com.br','ymail.com','icloud.com','me.com','mac.com',
    'aol.com','proton.me','protonmail.com','pm.me','zoho.com','gmx.com','mail.com',
    'uol.com.br','bol.com.br','terra.com.br','ig.com.br','globo.com','globomail.com',
    'r7.com','oi.com.br','superig.com.br'
  ];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_workspace IS DISTINCT FROM (sales_access_context()->>'workspace')::uuid THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE='42501';END IF;
  PERFORM sales_area_authorize('techsales.contacts','update');
  PERFORM sales_area_authorize('techsales.companies','view');

  WITH cand AS (
    SELECT c.id,
           lower(btrim(split_part(c.email, '@', 2))) AS dom
      FROM public.shared_fields_contacts c
     WHERE c.workspace_id = p_workspace
       AND c.deleted_at IS NULL
       AND c.company_id IS NULL
       AND c.email IS NOT NULL
       AND position('@' in c.email) > 0
  ),
  matched AS (
    SELECT cand.id,
           (SELECT CASE WHEN count(*)=1 THEN min(matches.id::text)::uuid END FROM (
             SELECT co.id FROM public.companies co WHERE co.workspace_id=p_workspace AND co.deleted_at IS NULL
               AND (lower(trim(coalesce(co.domain,'')))=cand.dom OR lower(split_part(regexp_replace(coalesce(co.website,''),'^https?://',''), '/',1)) IN(cand.dom,'www.'||cand.dom))
           ) matches) AS company_id
      FROM cand
     WHERE cand.dom <> '' AND NOT (cand.dom = ANY (v_free))
  ),
  upd AS (
    UPDATE public.contacts c
       SET company_id = m.company_id
      FROM matched m
     WHERE c.id = m.id AND m.company_id IS NOT NULL
    RETURNING c.id
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$function$;
CREATE OR REPLACE FUNCTION techerp_api.sales_scoring_apply(p_rule uuid, p_user uuid, p_ws uuid, p_table text, p_record uuid, p_expected jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r scoring_rules;v integer;changed uuid;locked uuid;source_table text;BEGIN
 IF p_table NOT IN('leads','contacts','companies') OR current_setting('app.api_subject',true)='on' THEN RAISE EXCEPTION 'Pontuação indisponível.' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_user,p_ws,p_rule,current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 SELECT * INTO r FROM scoring_rules WHERE id=p_rule AND workspace_id=p_ws AND enabled;
 IF r.id IS NULL OR NOT sales_record_access('scoring_rules',p_rule,'manage') OR NOT sales_record_access(p_table,p_record,'update') OR (CASE r.entity WHEN 'lead' THEN 'leads' WHEN 'contact' THEN 'contacts' WHEN 'company' THEN 'companies' END) IS DISTINCT FROM p_table OR r.points IS DISTINCT FROM (p_expected->>'points')::integer OR coalesce(r.condition,'{}'::jsonb) IS DISTINCT FROM coalesce(nullif(p_expected->'condition','null'::jsonb),'{}'::jsonb) OR r.updated_at IS DISTINCT FROM (p_expected->>'updated_at')::timestamptz THEN RAISE EXCEPTION 'Regra/registro alterado ou sem permissão atual de pontuação.' USING ERRCODE='42501';END IF;
 IF public.shared_field_mode_for(public.shared_field_context()->'rules',p_table,'score') IN('hidden','masked','readonly') THEN RAISE EXCEPTION 'Campo de pontuação protegido.' USING ERRCODE='42501';END IF;
 EXECUTE format('SELECT id FROM public.%I WHERE id=$1 AND workspace_id=$2 FOR UPDATE',p_table) INTO locked USING p_record,p_ws;
 IF locked IS NULL THEN RAISE EXCEPTION 'Registro de pontuação indisponível.' USING ERRCODE='42501';END IF;
 source_table:=CASE p_table WHEN 'leads' THEN 'shared_fields_leads' WHEN 'contacts' THEN 'shared_fields_contacts' ELSE 'companies' END;
 EXECUTE format('SELECT score FROM public.%I WHERE id=$1 AND workspace_id=$2',source_table) INTO v USING p_record,p_ws;
 INSERT INTO score_events(workspace_id,owner_id,rule_id,entity,entity_id,points,reason) VALUES(p_ws,p_user,r.id,p_table,p_record,r.points,r.name) ON CONFLICT DO NOTHING RETURNING id INTO changed;
 IF changed IS NOT NULL THEN EXECUTE format('UPDATE public.%I SET score=$1 WHERE id=$2 AND workspace_id=$3',p_table) USING coalesce(v,0)+r.points,p_record,p_ws;END IF;
 PERFORM techerp_api.leave();RETURN changed IS NOT NULL;
END$function$;
