-- Monthly management provisions are immutable estimates, never financial obligations.
ALTER TABLE public.hiring_workspace_settings ADD COLUMN finance_gate_enabled boolean NOT NULL DEFAULT false;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
 ('techfinance.provisions.view.workspace','techfinance','provisions','view','workspace','Ver provisões mensais','Prévia e histórico de provisões; exige também acesso a tarifas e ao contrato.',true),
 ('techfinance.provisions.manage.workspace','techfinance','provisions','manage','workspace','Preparar provisões mensais','Recalcula a prévia sem gerar título, cobrança ou pagamento.',true),
 ('techfinance.provisions.approve.workspace','techfinance','provisions','approve','workspace','Fechar e revisar provisões mensais','Congela competência encerrada ou cria revisão justificada, preservando o histórico.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.hiring_monthly_provisions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 config_id uuid NOT NULL REFERENCES public.project_billing_configs(id),contract_id uuid NOT NULL REFERENCES public.contracts(id),
 legal_entity_id uuid NOT NULL REFERENCES public.legal_entities(id),period_from date NOT NULL,period_to date NOT NULL,
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), revision integer NOT NULL CHECK(revision>0),
 supersedes_id uuid REFERENCES public.hiring_monthly_provisions(id), snapshot jsonb NOT NULL,source_hash text NOT NULL,
 closed_by uuid NOT NULL,closed_at timestamptz NOT NULL DEFAULT now(),reason text NOT NULL CHECK(length(btrim(reason))>=10),
 UNIQUE(config_id,period_from,revision)
);
CREATE INDEX hiring_provision_contract_month ON public.hiring_monthly_provisions(workspace_id,contract_id,period_from DESC,revision DESC);
ALTER TABLE public.hiring_monthly_provisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hiring_monthly_provisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hiring_monthly_provisions TO authenticated;
GRANT ALL ON public.hiring_monthly_provisions TO service_role;

CREATE OR REPLACE FUNCTION public.hiring_provision_access(w uuid,k uuid,p_key text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_workspace_member(w,auth.uid())
 AND EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w)
 AND (NOT p_write OR NOT public.is_read_only_view())
 AND public.user_has_permission(auth.uid(),w,p_key)
 AND public.user_has_permission(auth.uid(),w,'techfinance.provisions.view.workspace')
 AND public.user_has_permission(auth.uid(),w,'techprojects.rates.view.workspace')
 AND NOT EXISTS(SELECT 1 FROM (VALUES('project_rates','amount'),('contracts','monthly_value'),('services','unit_price'),('financial_entries','amount')) f(t,c) WHERE public.shared_field_mode_for(public.shared_field_context()->'rules',f.t,f.c) IN('hidden','masked'))
 AND public.work_record_access('techcontracts.contracts',k,'view')
 AND EXISTS(SELECT 1 FROM contracts WHERE id=k AND workspace_id=w)
$$;
REVOKE ALL ON FUNCTION public.hiring_provision_access(uuid,uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_provision_access(uuid,uuid,text,boolean) TO authenticated;
CREATE POLICY hiring_provision_read ON public.hiring_monthly_provisions FOR SELECT TO authenticated
 USING(public.hiring_provision_access(workspace_id,contract_id,'techfinance.provisions.view.workspace'));
CREATE OR REPLACE FUNCTION public.hiring_provision_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Provisão imutável: crie uma revisão justificada.' USING ERRCODE='42501';END $$;
CREATE TRIGGER hiring_provision_immutable BEFORE UPDATE OR DELETE ON public.hiring_monthly_provisions FOR EACH ROW EXECUTE FUNCTION public.hiring_provision_immutable();

CREATE OR REPLACE FUNCTION public.hiring_finance_signature_reason(p_contract uuid,p_ws uuid,p_deal uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;e public.hiring_contract_evidence;d public.esign_documents;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 IF c.id IS NULL THEN RETURN 'Selecione um contrato comercial do mesmo workspace.';END IF;
 IF c.role::text<>'provider' OR c.document_kind='amendment' THEN RETURN 'Use o contrato principal de prestação ao cliente.';END IF;
 IF p_deal IS NOT NULL AND (c.deal_id IS DISTINCT FROM p_deal OR NOT EXISTS(SELECT 1 FROM public.deals x WHERE x.id=p_deal AND x.workspace_id=p_ws AND x.deleted_at IS NULL AND x.company_id IS NOT NULL AND x.company_id=c.counterparty_company_id)) THEN RETURN 'Contrato e negócio precisam ter o mesmo cliente e vínculo explícito.';END IF;
 IF c.counterparty_company_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=p_ws AND x.deleted_at IS NULL) THEN RETURN 'Defina a contraparte do contrato.';END IF;
 IF c.contracting_legal_entity_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.legal_entities l WHERE l.id=c.contracting_legal_entity_id AND l.workspace_id=p_ws AND l.active AND nullif(trim(l.cnpj),'') IS NOT NULL) THEN RETURN 'Defina uma entidade WK ativa com CNPJ.';END IF;
 IF c.status::text NOT IN('active','renewing','ended') THEN RETURN 'Ative o contrato pelo fluxo de aprovação contratual.';END IF;
 IF c.starts_at IS NULL OR (c.ends_at IS NOT NULL AND c.ends_at<c.starts_at) THEN RETURN 'Contrato sem início definido, com vigência inválida ou expirada.';END IF;
 FOR e IN SELECT * FROM public.hiring_contract_evidence WHERE contract_id=c.id AND workspace_id=p_ws AND revoked_at IS NULL AND contract_hash=public.hiring_contract_fingerprint(c.id) ORDER BY recorded_at DESC LOOP
  IF e.kind='external' AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-signature-evidence' AND o.name=e.file_path AND o.user_metadata->>'sha256'=e.file_hash) THEN RETURN NULL;END IF;
  IF e.kind='native' THEN
   SELECT * INTO d FROM public.esign_documents WHERE id=e.document_id AND workspace_id=p_ws;
   IF d.status::text='completed' AND d.sealed_at IS NOT NULL AND d.completed_at IS NOT NULL AND d.content_hash=e.document_hash
   AND encode(extensions.digest(convert_to(d.body,'UTF8'),'sha256'),'hex')=e.document_hash
   AND (d.expires_at IS NULL OR d.completed_at<=d.expires_at)
   AND NOT EXISTS(SELECT 1 FROM public.ats_offers WHERE esign_document_id=d.id)
   AND NOT EXISTS(SELECT 1 FROM public.esign_signers WHERE document_id=d.id AND (workspace_id<>p_ws OR status::text<>'signed' OR signed_at IS NULL))
   AND EXISTS(SELECT 1 FROM public.esign_signers WHERE id=e.customer_signer_id AND document_id=d.id AND workspace_id=p_ws AND status::text='signed')
   AND EXISTS(SELECT 1 FROM public.esign_signers WHERE id=e.issuer_signer_id AND document_id=d.id AND workspace_id=p_ws AND status::text='signed') THEN RETURN NULL;END IF;
  END IF;
 END LOOP;
 RETURN 'Assinatura verificável da versão atual ausente, incompleta, alterada ou revogada.';
END $$;
REVOKE ALL ON FUNCTION public.hiring_finance_signature_reason(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_finance_contract_check(w uuid,k uuid,p_from date DEFAULT NULL,p_to date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.contracts;r text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND finance_gate_enabled) THEN RETURN;END IF;
 SELECT * INTO c FROM contracts WHERE id=k AND workspace_id=w;
 IF c.id IS NULL OR c.role::text<>'provider' OR c.contracting_legal_entity_id IS NULL
 OR NOT EXISTS(SELECT 1 FROM legal_entities WHERE id=c.contracting_legal_entity_id AND workspace_id=w AND active) THEN
 RAISE EXCEPTION 'FINANCE_SOURCE: contrato de prestação e entidade WK ativa são obrigatórios.';END IF;
 IF p_from IS NOT NULL AND (c.starts_at>coalesce(p_to,p_from) OR c.ends_at<p_from) THEN RAISE EXCEPTION 'FINANCE_SOURCE: competência fora da vigência contratual.';END IF;
 r:=public.hiring_finance_signature_reason(k,w,c.deal_id);
 IF r IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_SOURCE: %',r;END IF;
END $$;
REVOKE ALL ON FUNCTION public.hiring_finance_contract_check(uuid,uuid,date,date) FROM PUBLIC,anon,authenticated;

-- Private calculator; caller-facing RPCs recheck active workspace, deny, fields and record scope.
CREATE OR REPLACE FUNCTION public.hiring_provision_compute(p_cfg uuid,p_month date,p_tz text DEFAULT 'UTC')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_billing_configs;k public.contracts;lo date;hi date;rev jsonb;costs jsonb;pending jsonb;v jsonb;self_id uuid;
BEGIN
 SELECT * INTO c FROM project_billing_configs WHERE id=p_cfg;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Modelo de cobrança não encontrado.';END IF;
 IF p_tz IS NULL OR NOT public.project_time_tz_valid(p_tz) THEN RAISE EXCEPTION 'Fuso horário inválido.';END IF;
 SELECT * INTO k FROM contracts WHERE id=c.contract_id AND workspace_id=c.workspace_id;
 lo:=date_trunc('month',p_month)::date;hi:=(lo+interval '1 month - 1 day')::date;
 IF lo IS NULL OR lo<c.valid_from OR (c.valid_to IS NOT NULL AND lo>=c.valid_to) OR c.status<>'active' THEN RAISE EXCEPTION 'Competência fora da vigência do modelo.';END IF;
 IF lo>date_trunc('month',current_date)::date THEN RAISE EXCEPTION 'Competência futura não é provisão de fechamento.';END IF;
 IF k.contracting_legal_entity_id IS NULL THEN RAISE EXCEPTION 'Defina a entidade WK no contrato.';END IF;
 PERFORM public.hiring_finance_contract_check(c.workspace_id,k.id,lo,hi);
 SELECT id INTO self_id FROM project_measurements WHERE config_id=c.id AND period_from=lo AND kind='regular' AND status NOT IN('cancelled','reversed') ORDER BY created_at DESC LIMIT 1;
 -- Existing canonical calculator: no reservations or measurement/financial writes.
 SELECT coalesce(jsonb_agg(x.item ORDER BY x.source_type,x.source_id),'[]') INTO rev
 FROM (SELECT to_jsonb(z) item,z.source_type,z.source_id FROM public.project_measurement_compute(c.id,lo,hi,self_id,'regular',p_tz) z UNION ALL SELECT to_jsonb(l),l.source_type,l.source_id FROM project_measurement_lines l WHERE l.measurement_id=self_id AND l.active AND l.source_type IN('adjustment','success_event')) x;
 -- Pending time is an identified estimate, never an eligible billing line. Imported history excluded.
 SELECT coalesce(jsonb_agg(jsonb_build_object('entry_id',t.id,'revision',t.revision,'project_id',t.project_id,'allocation_id',t.allocation_id,
 'contract_id',k.id,'work_date',t.entry_date,'status',t.status,'seconds',coalesce(t.duration_seconds,round(public.project_entry_seconds(t.started_at,t.stopped_at,t.duration_minutes,t.hours))),
 'amount',CASE WHEN r.status='found' THEN round(coalesce(t.duration_seconds,public.project_entry_seconds(t.started_at,t.stopped_at,t.duration_minutes,t.hours))*r.amount/3600,2) END,
 'rate_id',r.rate_id,'issue',CASE WHEN r.status<>'found' THEN r.status END) ORDER BY t.id),'[]') INTO pending
 FROM project_time_entries t JOIN projects p ON p.id=t.project_id AND p.workspace_id=c.workspace_id
 LEFT JOIN LATERAL public.project_rate_pick(c.workspace_id,'price',c.currency,t.entry_date,t.project_id,t.user_id) r ON true
 WHERE t.workspace_id=c.workspace_id AND t.entry_date BETWEEN lo AND hi AND t.status::text IN('draft','submitted') AND t.source::text IS DISTINCT FROM 'import'
 AND t.billable AND (CASE WHEN c.service_id IS NULL THEN p.contract_id=k.id ELSE p.service_id=c.service_id END) AND c.model IN('per_hour','package');
 -- Hourly costs retain allocation/source references and unknown tariffs. Monthly rates are computed below, once per allocation.
 WITH hourly AS (
 SELECT jsonb_build_object('kind','hourly','source_id',t.id,'revision',t.revision,'project_id',p.id,'allocation_id',t.allocation_id,'person_id',t.person_id,
 'purchase_contract_id',a.purchase_contract_id,'work_date',t.entry_date,'status',t.status,'rate_id',r.rate_id,
 'amount',CASE WHEN r.status='found' THEN round(coalesce(t.duration_seconds,public.project_entry_seconds(t.started_at,t.stopped_at,t.duration_minutes,t.hours))*r.amount/3600,2) END,
 'issue',CASE WHEN r.status<>'found' THEN r.status END) AS item
 FROM project_time_entries t JOIN projects p ON p.id=t.project_id AND p.workspace_id=c.workspace_id
 LEFT JOIN people_allocations a ON a.id=t.allocation_id AND a.workspace_id=c.workspace_id
 LEFT JOIN LATERAL public.project_rate_pick(c.workspace_id,'cost',c.currency,t.entry_date,t.project_id,t.user_id) r ON true
 WHERE t.workspace_id=c.workspace_id AND t.entry_date BETWEEN lo AND hi AND t.source::text IS DISTINCT FROM 'import'
 AND t.status::text IN('approved','draft','submitted') AND (r.status IS DISTINCT FROM 'monthly' OR a.id IS NULL) AND NOT EXISTS(SELECT 1 FROM project_rates mr WHERE a.id IS NOT NULL AND mr.workspace_id=c.workspace_id AND mr.kind='cost' AND mr.unit='month' AND mr.currency=c.currency AND mr.status='active' AND mr.valid_from<=t.entry_date AND (mr.valid_to IS NULL OR mr.valid_to>t.entry_date) AND ((mr.scope='allocation' AND mr.allocation_id=a.id) OR (mr.scope='person' AND mr.person_id=a.person_id)))
 AND (CASE WHEN c.service_id IS NULL THEN p.contract_id=k.id ELSE p.service_id=c.service_id END)
 ), days AS (
 SELECT a.id allocation_id,a.person_id,a.project_id,a.purchase_contract_id,a.allocation_pct,d::date work_day,
 rr.id rate_id,rr.amount,rr.scope,rr.proration,rr.valid_from,rr.valid_to,
 count(rr.id) OVER(PARTITION BY a.id,d) choices
 FROM people_allocations a JOIN projects p ON p.id=a.project_id AND p.workspace_id=c.workspace_id
 CROSS JOIN LATERAL generate_series(greatest(lo,a.starts_at),least(hi,coalesce(a.ends_at,hi)),interval '1 day') d
 LEFT JOIN LATERAL(
 SELECT r.* FROM project_rates r WHERE r.workspace_id=c.workspace_id AND r.kind='cost' AND r.unit='month' AND r.currency=c.currency AND r.status='active'
 AND r.valid_from<=d::date AND (r.valid_to IS NULL OR r.valid_to>d::date)
 AND ((r.scope='allocation' AND r.allocation_id=a.id) OR (r.scope='person' AND r.person_id=a.person_id AND NOT EXISTS(
 SELECT 1 FROM project_rates ar WHERE ar.workspace_id=c.workspace_id AND ar.kind='cost' AND ar.unit='month' AND ar.currency=c.currency AND ar.status='active' AND ar.scope='allocation' AND ar.allocation_id=a.id AND ar.valid_from<=d::date AND (ar.valid_to IS NULL OR ar.valid_to>d::date))))
 )rr ON true
 WHERE a.workspace_id=c.workspace_id AND a.status::text IN('active','ended')
 AND (CASE WHEN c.service_id IS NULL THEN p.contract_id=k.id ELSE p.service_id=c.service_id END)
 ), monthly AS (
 SELECT jsonb_build_object('kind','monthly','allocation_id',allocation_id,'person_id',person_id,'project_id',project_id,'purchase_contract_id',purchase_contract_id,
 'rate_id',rate_id,'from',min(work_day),'to',max(work_day),'days',count(*),
 'amount',CASE WHEN max(choices)=1 AND NOT(max(proration)='full_month' AND (SELECT count(DISTINCT dd.rate_id) FROM days dd WHERE dd.allocation_id=days.allocation_id)>1) THEN round(max(amount)*CASE WHEN max(scope)='person' THEN max(allocation_pct)/100 ELSE 1 END
 *CASE WHEN max(proration)='full_month' THEN 1 ELSE count(*)::numeric/(hi-lo+1) END,2) END,
 'issue',CASE WHEN max(choices)>1 THEN 'ambiguous' WHEN max(proration)='full_month' AND (SELECT count(DISTINCT dd.rate_id) FROM days dd WHERE dd.allocation_id=days.allocation_id)>1 THEN 'monthly_rate_change_review' WHEN rate_id IS NULL THEN 'missing_monthly' END) item
 FROM days WHERE rate_id IS NOT NULL OR EXISTS(SELECT 1 FROM days covered WHERE covered.allocation_id=days.allocation_id AND covered.rate_id IS NOT NULL) GROUP BY allocation_id,person_id,project_id,purchase_contract_id,rate_id
 ) SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]') INTO costs FROM(SELECT item FROM hourly UNION ALL SELECT item FROM monthly)x;
 v:=jsonb_build_object('policy','hiring-finance-v1','config_id',c.id,'config_version',c.version,'contract_id',k.id,'legal_entity_id',k.contracting_legal_entity_id,
 'currency',c.currency,'model',c.model,'params',c.params,'timezone',p_tz,'from',lo,'to',hi,'contract_hash',public.hiring_contract_fingerprint(k.id),
 'revenue',rev,'pending_estimates',pending,'costs',costs,
 'totals',jsonb_build_object('eligible_revenue',CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(rev)x WHERE (x->>'included')::boolean AND x->>'amount' IS NULL) THEN NULL ELSE (SELECT round(coalesce(sum((x->>'amount')::numeric) FILTER(WHERE (x->>'included')::boolean),0),2) FROM jsonb_array_elements(rev)x) END,
 'estimated_pending_revenue',(SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(pending)x),
 'known_estimated_cost',(SELECT sum((x->>'amount')::numeric) FROM jsonb_array_elements(costs)x),
 'unknown_cost_lines',(SELECT count(*) FROM jsonb_array_elements(costs)x WHERE x->>'amount' IS NULL)),
 'notice','Provisão gerencial, não título financeiro, NF, boleto, cobrança ou pagamento. Estimativas não autorizam faturamento.');
 RETURN v||jsonb_build_object('hash',md5(v::text));
END $$;
REVOKE ALL ON FUNCTION public.hiring_provision_compute(uuid,date,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_provision_preview(w uuid,p_cfg uuid,p_month date,p_tz text DEFAULT 'UTC')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_billing_configs;
BEGIN
 SELECT * INTO c FROM project_billing_configs WHERE id=p_cfg AND workspace_id=w;
 IF c.id IS NULL OR NOT public.hiring_provision_access(w,c.contract_id,'techfinance.provisions.manage.workspace') THEN RAISE EXCEPTION 'Sem acesso à prévia da provisão.' USING ERRCODE='42501';END IF;
 RETURN public.hiring_provision_compute(p_cfg,p_month,p_tz);
END $$;
REVOKE ALL ON FUNCTION public.hiring_provision_preview(uuid,uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_provision_preview(uuid,uuid,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hiring_provision_close(w uuid,p_cfg uuid,p_month date,p_hash text,p_previous uuid,p_reason text,p_tz text DEFAULT 'UTC')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.project_billing_configs;v jsonb;prev public.hiring_monthly_provisions;r uuid;lo date;
BEGIN
 SELECT * INTO c FROM project_billing_configs WHERE id=p_cfg AND workspace_id=w;
 IF c.id IS NULL OR NOT public.hiring_provision_access(w,c.contract_id,'techfinance.provisions.approve.workspace',true)
 OR NOT public.user_has_permission(auth.uid(),w,'techfinance.provisions.manage.workspace') THEN RAISE EXCEPTION 'Sem acesso ao fechamento financeiro.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND finance_gate_enabled) THEN RAISE EXCEPTION 'Fechamento integrado não está ativo neste workspace.';END IF;
 lo:=date_trunc('month',p_month)::date;
 IF lo IS NULL OR lo>=date_trunc('month',current_date)::date THEN RAISE EXCEPTION 'Feche apenas mês encerrado.';END IF;
 IF length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Justifique o fechamento/revisão (mínimo 10 caracteres).';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('hiring_provision:'||p_cfg||':'||lo));
 SELECT * INTO prev FROM hiring_monthly_provisions WHERE config_id=p_cfg AND period_from=lo ORDER BY revision DESC LIMIT 1;
 PERFORM 1 FROM contracts WHERE id=c.contract_id AND workspace_id=w FOR SHARE;
 v:=public.hiring_provision_compute(p_cfg,p_month,p_tz);
 IF v->>'hash' IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'PREVIEW_STALE: fontes alteradas, refaça a prévia.';END IF;
 IF prev.id IS NOT NULL AND prev.source_hash=p_hash THEN RETURN prev.id;END IF;
 IF prev.id IS DISTINCT FROM p_previous THEN RAISE EXCEPTION 'REVISION_STALE: confira a última revisão.';END IF;
 INSERT INTO hiring_monthly_provisions(workspace_id,config_id,contract_id,legal_entity_id,period_from,period_to,currency,revision,supersedes_id,snapshot,source_hash,closed_by,reason)
 VALUES(w,c.id,c.contract_id,(v->>'legal_entity_id')::uuid,lo,(v->>'to')::date,c.currency,coalesce(prev.revision,0)+1,prev.id,v,p_hash,auth.uid(),btrim(p_reason)) RETURNING id INTO r;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.hiring_provision_close(uuid,uuid,date,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_provision_close(uuid,uuid,date,text,uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hiring_provision_context(w uuid,k uuid,p_month date,p_cfg uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.hiring_provision_access(w,k,'techfinance.provisions.view.workspace') THEN RAISE EXCEPTION 'Sem acesso às provisões.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('enabled',coalesce((SELECT finance_gate_enabled FROM hiring_workspace_settings WHERE workspace_id=w),false),
 'configs',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'model',model,'currency',currency,'version',version,'service_id',service_id,'valid_from',valid_from,'valid_to',valid_to) ORDER BY valid_from DESC),'[]') FROM project_billing_configs WHERE workspace_id=w AND contract_id=k AND status='active'),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY revision DESC),'[]') FROM(SELECT id,config_id,period_from,currency,revision,supersedes_id,snapshot,source_hash,closed_at,reason FROM hiring_monthly_provisions WHERE workspace_id=w AND contract_id=k AND period_from=date_trunc('month',p_month)::date AND (p_cfg IS NULL OR config_id=p_cfg) ORDER BY revision DESC LIMIT 50)x));
END $$;
REVOKE ALL ON FUNCTION public.hiring_provision_context(uuid,uuid,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_provision_context(uuid,uuid,date,uuid) TO authenticated;
