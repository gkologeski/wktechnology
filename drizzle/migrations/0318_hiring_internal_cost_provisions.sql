-- Internal/shared employment has no fictional client deal or sales billing config.
ALTER TABLE public.hiring_monthly_provisions ALTER COLUMN config_id DROP NOT NULL;
ALTER TABLE public.hiring_monthly_provisions ADD COLUMN kind text NOT NULL DEFAULT 'revenue' CHECK(kind IN('revenue','cost'));
ALTER TABLE public.hiring_monthly_provisions ADD CONSTRAINT hiring_provision_scope CHECK((kind='revenue' AND config_id IS NOT NULL) OR (kind='cost' AND config_id IS NULL));
CREATE UNIQUE INDEX hiring_cost_provision_revision ON public.hiring_monthly_provisions(contract_id,period_from,revision) WHERE kind='cost';

CREATE OR REPLACE FUNCTION public.hiring_cost_provision_access(w uuid,k uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.hiring_provision_access(w,k,'techfinance.provisions.view.workspace')
 AND public.user_has_permission(auth.uid(),w,'techpeople.employment.view.workspace')
 AND EXISTS(SELECT 1 FROM contracts c WHERE c.id=k AND c.workspace_id=w AND c.role::text='client' AND c.hiring_person_id IS NOT NULL AND public.hr_record_access('people','view',c.hiring_person_id))
$$;
REVOKE ALL ON FUNCTION public.hiring_cost_provision_access(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_cost_provision_access(uuid,uuid) TO authenticated;
DROP POLICY hiring_provision_read ON public.hiring_monthly_provisions;
CREATE POLICY hiring_provision_read ON public.hiring_monthly_provisions FOR SELECT TO authenticated
 USING(public.hiring_provision_access(workspace_id,contract_id,'techfinance.provisions.view.workspace') AND (kind='revenue' OR public.hiring_cost_provision_access(workspace_id,contract_id)));

CREATE OR REPLACE FUNCTION public.hiring_purchase_provision_compute(w uuid,k uuid,p_month date,p_tz text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.contracts;e public.hiring_engagements;pe public.people;lo date;hi date;costs jsonb;v jsonb;
BEGIN
 lo:=date_trunc('month',p_month)::date;hi:=(lo+interval '1 month - 1 day')::date;
 SELECT * INTO c FROM contracts WHERE id=k AND workspace_id=w AND role::text='client';
 IF c.id IS NULL OR c.hiring_person_id IS NULL OR c.status::text NOT IN('active','renewing','ended') THEN RAISE EXCEPTION 'Revise e ative o contrato de compra do profissional.';END IF;
 IF (SELECT count(*) FROM hiring_engagements WHERE workspace_id=w AND purchase_contract_id=k AND person_id=c.hiring_person_id AND starts_at<=hi AND (ends_at IS NULL OR ends_at>=lo))<>1 THEN RAISE EXCEPTION 'Selecione e revise o vínculo único deste contrato na competência.';END IF;
 SELECT * INTO e FROM hiring_engagements WHERE workspace_id=w AND purchase_contract_id=k AND person_id=c.hiring_person_id AND starts_at<=hi AND (ends_at IS NULL OR ends_at>=lo);
 IF e.id IS NULL OR e.legal_entity_id IS DISTINCT FROM c.contracting_legal_entity_id OR NOT EXISTS(SELECT 1 FROM legal_entities WHERE id=e.legal_entity_id AND workspace_id=w AND active) THEN RAISE EXCEPTION 'Vínculo, pessoa e CNPJ WK precisam ser coerentes.';END IF;
 SELECT * INTO pe FROM people WHERE id=e.person_id AND workspace_id=w;
 IF pe.hire_date IS NULL OR pe.hire_date>hi THEN RAISE EXCEPTION 'Informe a admissão efetiva na vigência da competência.';END IF;
 lo:=date_trunc('month',p_month)::date;hi:=(lo+interval '1 month - 1 day')::date;
 IF lo IS NULL OR lo>date_trunc('month',current_date)::date OR c.starts_at IS NULL OR e.starts_at>hi OR c.starts_at>hi OR e.ends_at<lo OR c.ends_at<lo THEN RAISE EXCEPTION 'Competência fora da vigência do vínculo/contrato.';END IF;
 IF NOT public.project_time_tz_valid(p_tz) THEN RAISE EXCEPTION 'Fuso horário inválido.';END IF;
 IF c.currency IS NULL OR c.currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Contrato sem moeda.';END IF;
 -- A person monthly cost is recorded once, not once per client/project. Ambiguous simultaneous employment is unknown.
 WITH person_days AS (
 SELECT d::date work_date,r.id rate_id,r.amount,r.proration,
 count(r.id) OVER(PARTITION BY d) choices,
 (SELECT count(*) FROM hiring_engagements other WHERE other.workspace_id=w AND other.person_id=e.person_id AND other.purchase_contract_id IS DISTINCT FROM k AND other.starts_at<=hi AND (other.ends_at IS NULL OR other.ends_at>=lo)) other_employments
 FROM generate_series(greatest(lo,c.starts_at,e.starts_at,pe.hire_date),least(hi,coalesce(c.ends_at,hi),coalesce(e.ends_at,hi)),interval '1 day') d
 LEFT JOIN project_rates r ON r.workspace_id=w AND r.kind='cost' AND r.scope='person' AND r.person_id=e.person_id AND r.unit='month' AND r.currency=c.currency AND r.status='active' AND r.valid_from<=d::date AND (r.valid_to IS NULL OR r.valid_to>d::date)
 ), monthly AS (
 SELECT jsonb_build_object('kind','monthly','person_id',e.person_id,'engagement_id',e.id,'purchase_contract_id',k,'rate_id',rate_id,'from',min(work_date),'to',max(work_date),
 'amount',CASE WHEN max(choices)=1 AND max(other_employments)=0 AND NOT(max(proration)='full_month' AND (SELECT count(DISTINCT rate_id) FROM person_days)>1) THEN round(max(amount)*CASE WHEN max(proration)='full_month' THEN 1 ELSE count(*)::numeric/(hi-lo+1) END,2) END,
 'issue',CASE WHEN rate_id IS NULL THEN 'missing_monthly' WHEN max(choices)>1 OR max(other_employments)>0 THEN 'ambiguous' WHEN max(proration)='full_month' AND (SELECT count(DISTINCT rate_id) FROM person_days)>1 THEN 'monthly_rate_change_review' END) item
 FROM person_days GROUP BY rate_id
 ), hourly AS (
 SELECT jsonb_build_object('kind','hourly','source_id',t.id,'revision',t.revision,'project_id',t.project_id,'allocation_id',t.allocation_id,'purchase_contract_id',k,'person_id',e.person_id,'status',t.status,'rate_id',r.rate_id,
 'amount',CASE WHEN r.status='found' THEN round(coalesce(t.duration_seconds,public.project_entry_seconds(t.started_at,t.stopped_at,t.duration_minutes,t.hours))*r.amount/3600,2) END,'issue',CASE WHEN r.status<>'found' THEN r.status END) item
 FROM project_time_entries t LEFT JOIN people_allocations a ON a.id=t.allocation_id AND a.workspace_id=w
 LEFT JOIN LATERAL public.project_rate_pick(w,'cost',c.currency,t.entry_date,t.project_id,t.user_id) r ON true
 WHERE t.workspace_id=w AND t.person_id=e.person_id AND t.entry_date BETWEEN greatest(lo,c.starts_at,e.starts_at,pe.hire_date) AND least(hi,coalesce(c.ends_at,hi),coalesce(e.ends_at,hi))
 AND (a.id IS NULL OR a.purchase_contract_id=k) AND t.status::text IN('draft','submitted','approved') AND t.source::text IS DISTINCT FROM 'import'
 AND NOT EXISTS(SELECT 1 FROM person_days WHERE rate_id IS NOT NULL)
 ) SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]') INTO costs FROM(
 SELECT item FROM monthly WHERE item->>'rate_id' IS NOT NULL OR EXISTS(SELECT 1 FROM person_days WHERE rate_id IS NOT NULL)
 UNION ALL SELECT item FROM hourly
 UNION ALL SELECT jsonb_build_object('kind','monthly','person_id',e.person_id,'purchase_contract_id',k,'amount',NULL,'issue','missing_cost') WHERE NOT EXISTS(SELECT 1 FROM person_days WHERE rate_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM hourly)
 )x;
 v:=jsonb_build_object('policy','hiring-cost-v1','kind','cost','model','cost_monthly','contract_id',k,'engagement_id',e.id,'legal_entity_id',e.legal_entity_id,'currency',c.currency,'from',lo,'to',hi,'timezone',p_tz,
 'contract_hash',public.hiring_contract_fingerprint(k),'revenue','[]'::jsonb,'pending_estimates','[]'::jsonb,'costs',costs,
 'totals',jsonb_build_object('eligible_revenue',NULL,'estimated_pending_revenue',NULL,'known_estimated_cost',(SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(costs)x),'unknown_cost_lines',(SELECT count(*) FROM jsonb_array_elements(costs)x WHERE x->>'amount' IS NULL)),
 'notice','Provisão do custo do profissional, sem negócio fictício e sem criar obrigação. Os custos rateados nas visões de clientes são referências desta origem: não some as duas visões.');
 RETURN v||jsonb_build_object('hash',md5(v::text));
END $$;
REVOKE ALL ON FUNCTION public.hiring_purchase_provision_compute(uuid,uuid,date,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_provision_preview(w uuid,p_cfg uuid,p_month date,p_tz text DEFAULT 'UTC')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_billing_configs;k uuid;
BEGIN
 SELECT * INTO c FROM project_billing_configs WHERE id=p_cfg AND workspace_id=w;k:=coalesce(c.contract_id,p_cfg);
 IF NOT public.hiring_provision_access(w,k,'techfinance.provisions.manage.workspace') OR (c.id IS NULL AND NOT public.hiring_cost_provision_access(w,k)) THEN RAISE EXCEPTION 'Sem acesso à prévia da provisão.' USING ERRCODE='42501';END IF;
 IF c.id IS NULL THEN RETURN public.hiring_purchase_provision_compute(w,k,p_month,p_tz);END IF;
 RETURN public.hiring_provision_compute(p_cfg,p_month,p_tz);
END $$;

CREATE OR REPLACE FUNCTION public.hiring_provision_close(w uuid,p_cfg uuid,p_month date,p_hash text,p_previous uuid,p_reason text,p_tz text DEFAULT 'UTC')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_billing_configs;v jsonb;prev public.hiring_monthly_provisions;r uuid;lo date;k uuid;
BEGIN
 SELECT * INTO c FROM project_billing_configs WHERE id=p_cfg AND workspace_id=w;k:=coalesce(c.contract_id,p_cfg);
 IF NOT public.hiring_provision_access(w,k,'techfinance.provisions.approve.workspace',true) OR NOT public.user_has_permission(auth.uid(),w,'techfinance.provisions.manage.workspace') OR (c.id IS NULL AND NOT public.hiring_cost_provision_access(w,k)) THEN RAISE EXCEPTION 'Sem acesso ao fechamento financeiro.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND finance_gate_enabled) THEN RAISE EXCEPTION 'Fechamento integrado não está ativo neste workspace.';END IF;
 lo:=date_trunc('month',p_month)::date;
 IF lo IS NULL OR lo>=date_trunc('month',current_date)::date THEN RAISE EXCEPTION 'Feche apenas mês encerrado.';END IF;
 IF length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Justifique o fechamento/revisão (mínimo 10 caracteres).';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('hiring_provision:'||p_cfg||':'||lo));
 SELECT * INTO prev FROM hiring_monthly_provisions WHERE workspace_id=w AND contract_id=k AND config_id IS NOT DISTINCT FROM c.id AND period_from=lo ORDER BY revision DESC LIMIT 1;
 PERFORM 1 FROM contracts WHERE id=k AND workspace_id=w FOR SHARE;
 IF c.id IS NULL THEN v:=public.hiring_purchase_provision_compute(w,k,p_month,p_tz);ELSE v:=public.hiring_provision_compute(p_cfg,p_month,p_tz);END IF;
 IF v->>'hash' IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'PREVIEW_STALE: fontes alteradas, refaça a prévia.';END IF;
 IF prev.id IS NOT NULL AND prev.source_hash=p_hash THEN RETURN prev.id;END IF;
 IF prev.id IS DISTINCT FROM p_previous THEN RAISE EXCEPTION 'REVISION_STALE: confira a última revisão.';END IF;
 INSERT INTO hiring_monthly_provisions(workspace_id,config_id,contract_id,legal_entity_id,period_from,period_to,currency,revision,supersedes_id,snapshot,source_hash,closed_by,reason,kind)
 VALUES(w,c.id,k,(v->>'legal_entity_id')::uuid,lo,(v->>'to')::date,v->>'currency',coalesce(prev.revision,0)+1,prev.id,v,p_hash,auth.uid(),btrim(p_reason),CASE WHEN c.id IS NULL THEN 'cost' ELSE 'revenue' END) RETURNING id INTO r;
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_provision_context(w uuid,k uuid,p_month date,p_cfg uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE is_cost boolean;
BEGIN
 SELECT role::text='client' INTO is_cost FROM contracts WHERE id=k AND workspace_id=w;
 IF NOT public.hiring_provision_access(w,k,'techfinance.provisions.view.workspace') OR (is_cost AND NOT public.hiring_cost_provision_access(w,k)) THEN RAISE EXCEPTION 'Sem acesso às provisões.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('enabled',coalesce((SELECT finance_gate_enabled FROM hiring_workspace_settings WHERE workspace_id=w),false),
 'configs',CASE WHEN is_cost THEN (SELECT jsonb_build_array(jsonb_build_object('id',id,'model','cost_monthly','currency',currency,'version',1,'service_id',NULL,'valid_from',starts_at,'valid_to',ends_at)) FROM contracts WHERE id=k AND workspace_id=w)
 ELSE (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'model',model,'currency',currency,'version',version,'service_id',service_id,'valid_from',valid_from,'valid_to',valid_to) ORDER BY valid_from DESC),'[]') FROM project_billing_configs WHERE workspace_id=w AND contract_id=k AND status='active') END,
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY revision DESC),'[]') FROM(SELECT id,coalesce(config_id,contract_id) config_id,period_from,currency,revision,supersedes_id,snapshot,source_hash,closed_at,reason,kind FROM hiring_monthly_provisions WHERE workspace_id=w AND contract_id=k AND period_from=date_trunc('month',p_month)::date AND (p_cfg IS NULL OR coalesce(config_id,contract_id)=p_cfg) ORDER BY revision DESC LIMIT 50)x));
END $$;
REVOKE ALL ON FUNCTION public.hiring_provision_preview(uuid,uuid,date,text),public.hiring_provision_close(uuid,uuid,date,text,uuid,text,text),public.hiring_provision_context(uuid,uuid,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_provision_preview(uuid,uuid,date,text),public.hiring_provision_close(uuid,uuid,date,text,uuid,text,text),public.hiring_provision_context(uuid,uuid,date,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
