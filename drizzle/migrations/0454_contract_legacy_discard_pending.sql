-- DESCARTA-LEGADO: append-only administrative discard, never physical deletion or legal termination.
CREATE TABLE public.contract_legacy_discards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 legacy_id uuid NOT NULL,
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 revision integer NOT NULL,
 contract_fingerprint text NOT NULL,
 actor_id uuid NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 2000),
 operation_id uuid NOT NULL,
 request_hash text NOT NULL,
 discarded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(contract_id), UNIQUE(workspace_id,operation_id),
 FOREIGN KEY(workspace_id,legacy_id) REFERENCES public.contract_legacy_records(workspace_id,id)
);
REVOKE ALL ON public.contract_legacy_discards FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.contract_legacy_discards TO service_role;
ALTER TABLE public.contract_legacy_discards ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_legacy_discards_service_read ON public.contract_legacy_discards FOR SELECT TO service_role USING(true);
CREATE TRIGGER contract_legacy_discards_immutable BEFORE UPDATE OR DELETE ON public.contract_legacy_discards FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_immutable_guard();

CREATE FUNCTION public.contract_legacy_discard_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM contract_legacy_records WHERE contract_id=OLD.id) THEN
   RAISE EXCEPTION 'Contrato legado não pode ser excluído. Use Descartar legado pendente na ficha; original e histórico são preservados.' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
 END IF;
 IF NEW IS DISTINCT FROM OLD AND EXISTS(SELECT 1 FROM contract_legacy_discards WHERE contract_id=OLD.id) THEN
  RAISE EXCEPTION 'Contrato legado descartado: registro preservado somente para consulta.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aa_contract_legacy_discard_guard BEFORE UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_discard_guard();

-- Child writes lock the same parent as discard; no operational association can race the check.
CREATE FUNCTION public.contract_legacy_discard_link_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cid uuid;
BEGIN
 cid:=nullif(to_jsonb(NEW)->>TG_ARGV[0],'')::uuid;
 IF cid IS NULL THEN RETURN NEW; END IF;
 PERFORM 1 FROM contracts WHERE id=cid FOR KEY SHARE;
 IF EXISTS(SELECT 1 FROM contract_legacy_discards WHERE contract_id=cid) THEN
  RAISE EXCEPTION 'Contrato legado descartado: não aceita novos vínculos nem alterações de registros vinculados.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DO $links$
DECLARE f record;
BEGIN
 FOR f IN SELECT ns.nspname AS schema_name,t.relname AS table_name,a.attname AS column_name,k.oid
  FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
  JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=k.conkey[1]
  WHERE k.contype='f' AND k.confrelid='public.contracts'::regclass AND array_length(k.conkey,1)=1
   AND ns.nspname='public' AND t.relname<>'contract_legacy_discards'
 LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_discard_link_guard(%L)',
   'legacy_discard_link_'||f.oid,f.schema_name,f.table_name,f.column_name);
 END LOOP;
END $links$;

CREATE FUNCTION public.contract_legacy_discard_pending(w uuid,p_contract uuid,p_expected_revision integer,p_reason text,p_confirmed boolean,p_operation uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;r contract_legacy_records;d contract_legacy_discards;ctx jsonb;h text;f record;linked boolean;
BEGIN
 -- Same real contract read/update gate; discard additionally requires canonical delete and legacy view.
 c:=contract_legacy_actor(w,p_contract,'view',true);
 ctx:=work_access_context();
 IF NOT work_context_access(ctx,w,'techcontracts.contracts','delete',ARRAY[coalesce(c.assigned_to,c.owner_id)]) THEN
  RAISE EXCEPTION 'Sem permissão para descartar este contrato.' USING ERRCODE='42501';
 END IF;
 IF p_confirmed IS NOT TRUE OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 OR p_operation IS NULL THEN
  RAISE EXCEPTION 'Confirme o descarte e informe um motivo de 5 a 2000 caracteres.' USING ERRCODE='23514';
 END IF;
 h:=encode(sha256(convert_to(jsonb_build_object('a','discard','c',p_contract,'rev',p_expected_revision,'reason',btrim(p_reason),'confirmed',true)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('contract-legacy-op:'||w::text||':'||p_operation::text,0));
 PERFORM 1 FROM contracts WHERE id=c.id AND workspace_id=w FOR UPDATE;
 -- Revalidate after the lock, including reassignment and current authority.
 c:=contract_legacy_actor(w,p_contract,'view',true);
 IF NOT work_context_access(work_access_context(),w,'techcontracts.contracts','delete',ARRAY[coalesce(c.assigned_to,c.owner_id)]) THEN
  RAISE EXCEPTION 'Sem permissão para descartar este contrato.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO d FROM contract_legacy_discards WHERE workspace_id=w AND operation_id=p_operation;
 IF d.id IS NOT NULL THEN
  IF d.request_hash<>h OR d.actor_id IS DISTINCT FROM auth.uid() OR d.contract_id<>p_contract THEN
   RAISE EXCEPTION 'CONFLICT: operação reutilizada com dados diferentes.' USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object('id',d.id,'discarded_at',d.discarded_at,'replayed',true);
 END IF;
 IF EXISTS(SELECT 1 FROM contract_legacy_events WHERE workspace_id=w AND operation_id=p_operation) THEN
  RAISE EXCEPTION 'CONFLICT: identificador já utilizado na trilha do legado.' USING ERRCODE='23505';
 END IF;
 SELECT * INTO r FROM contract_legacy_records WHERE contract_id=c.id AND workspace_id=w FOR UPDATE;
 IF r.id IS NULL OR r.status<>'pending' OR c.status::text<>'draft' OR EXISTS(SELECT 1 FROM contract_legacy_discards WHERE contract_id=c.id) THEN
  RAISE EXCEPTION 'Somente contrato legado pendente, em rascunho e ainda não descartado pode ser descartado.' USING ERRCODE='23514';
 END IF;
 IF p_expected_revision IS DISTINCT FROM r.revision OR r.contract_fingerprint<>contract_legacy_fingerprint(c) THEN
  RAISE EXCEPTION 'STALE: contrato ou revisão mudou. Atualize a ficha e confira o documento antes de descartar.' USING ERRCODE='23514';
 END IF;
 IF contract_legacy_protected_problem(c) IS NOT NULL OR c.deal_id IS NOT NULL OR c.parent_contract_id IS NOT NULL OR c.amendment_of_id IS NOT NULL THEN
  RAISE EXCEPTION 'Contrato com origem comercial, assinatura ou vínculo governado não pode ser descartado.' USING ERRCODE='23514';
 END IF;
 -- Block every operational FK, including future modules; audit/original/evidence/suggestions are preserved.
 FOR f IN SELECT ns.nspname AS schema_name,t.relname AS table_name,a.attname AS column_name
  FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
  JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=k.conkey[1]
  WHERE k.contype='f' AND k.confrelid='public.contracts'::regclass AND array_length(k.conkey,1)=1
   AND ns.nspname='public' AND t.relname NOT IN('contract_legacy_records','contract_legacy_evidence','contract_legacy_discards','contract_events','contract_attachments','contract_link_ai_suggestions')
 LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',f.schema_name,f.table_name,f.column_name) INTO linked USING c.id;
  IF linked THEN RAISE EXCEPTION 'Contrato possui operação vinculada. O descarte não encerra serviços, projetos, alocações ou compromissos financeiros.' USING ERRCODE='23514'; END IF;
 END LOOP;
 INSERT INTO contract_legacy_discards(workspace_id,legacy_id,contract_id,revision,contract_fingerprint,actor_id,reason,operation_id,request_hash)
 VALUES(w,r.id,c.id,r.revision,r.contract_fingerprint,auth.uid(),btrim(p_reason),p_operation,h) RETURNING * INTO d;
 RETURN jsonb_build_object('id',d.id,'discarded_at',d.discarded_at,'replayed',false);
END $$;

CREATE OR REPLACE FUNCTION public.contract_legacy_state(w uuid,p_contract uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;r contract_legacy_records;d contract_legacy_discards;
BEGIN
 c:=contract_legacy_actor(w,p_contract,'view',false);
 SELECT * INTO r FROM contract_legacy_records WHERE contract_id=c.id AND workspace_id=w;
 SELECT * INTO d FROM contract_legacy_discards WHERE contract_id=c.id AND workspace_id=w;
 RETURN jsonb_build_object('contract_id',c.id,'eligible_problem',CASE WHEN r.id IS NULL THEN contract_legacy_protected_problem(c) END,
  'record',CASE WHEN r.id IS NOT NULL THEN jsonb_build_object('id',r.id,'status',r.status,'revision',r.revision,'situation',r.situation,'stale',r.contract_fingerprint<>contract_legacy_fingerprint(c),
   'recognized_at',r.recognized_at,'regularized_at',r.regularized_at) END,
  'discard',CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('discarded_at',d.discarded_at,'actor_id',d.actor_id,'reason',d.reason,'revision',d.revision) END,
  'events',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',e.kind,'revision',e.revision,'actor_id',e.actor_id,'created_at',e.created_at,'details',e.details-'path') ORDER BY e.created_at) FROM contract_legacy_events e WHERE e.legacy_id=r.id),'[]'),
  'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'file_name',x.file_name,'sha256',x.sha256,'size',x.size_bytes,'status',x.status,'revision',x.legacy_revision) ORDER BY x.reserved_at) FROM contract_legacy_evidence x WHERE x.legacy_id=r.id),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.contract_legacy_indicator(w uuid,p_contract uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;ctx jsonb:=work_access_context();
BEGIN
 SELECT * INTO c FROM contracts WHERE workspace_id=w AND id=p_contract;
 IF auth.uid() IS NULL OR c.id IS NULL OR NOT is_workspace_member(w,auth.uid())
  OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w)
  OR NOT EXISTS(SELECT 1 FROM workspaces WHERE id=w AND coalesce(status,'active')='active')
  OR NOT work_context_access(ctx,w,'techcontracts.contracts','view',ARRAY[coalesce(c.assigned_to,c.owner_id)]) THEN
  RAISE EXCEPTION 'Contrato indisponível para consulta.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('status',(SELECT status FROM contract_legacy_records WHERE workspace_id=w AND contract_id=c.id))
  || CASE WHEN EXISTS(SELECT 1 FROM contract_legacy_discards WHERE workspace_id=w AND contract_id=c.id) THEN jsonb_build_object('discarded',true) ELSE '{}'::jsonb END;
END $$;

CREATE FUNCTION public.contract_legacy_discarded_ids(w uuid,p_contracts uuid[]) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cid uuid;result jsonb:='[]';indicator jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(array_length(p_contracts,1),0)>200 THEN RAISE EXCEPTION 'Consulta de contratos indisponível.' USING ERRCODE='42501'; END IF;
 FOR cid IN SELECT DISTINCT unnest(p_contracts) LOOP
  indicator:=contract_legacy_indicator(w,cid);
  IF indicator->>'discarded'='true' THEN result:=result||jsonb_build_array(cid); END IF;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.contract_legacy_discard_guard(),public.contract_legacy_discard_link_guard(),
 public.contract_legacy_discard_pending(uuid,uuid,integer,text,boolean,uuid),public.contract_legacy_discarded_ids(uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contract_legacy_discard_pending(uuid,uuid,integer,text,boolean,uuid),public.contract_legacy_discarded_ids(uuid,uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';