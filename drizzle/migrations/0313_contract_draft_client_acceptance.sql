ALTER TABLE public.contract_drafts
 ADD COLUMN IF NOT EXISTS public_token uuid UNIQUE,
 ADD COLUMN IF NOT EXISTS sent_at timestamptz,
 ADD COLUMN IF NOT EXISTS sent_by uuid,
 ADD COLUMN IF NOT EXISTS sent_to text,
 ADD COLUMN IF NOT EXISTS client_decided_at timestamptz,
 ADD COLUMN IF NOT EXISTS client_name text,
 ADD COLUMN IF NOT EXISTS client_note text;

-- Move o negócio da minuta para o substatus (por nome) da etapa Contratação, sem falhar a operação principal.
CREATE OR REPLACE FUNCTION public.contract_draft_set_deal_substatus(p_draft uuid,p_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d record;s uuid;BEGIN
 SELECT cd.workspace_id,cd.deal_id,de.pipeline_id INTO d FROM contract_drafts cd JOIN deals de ON de.id=cd.deal_id WHERE cd.id=p_draft;
 IF d.deal_id IS NULL THEN RETURN false;END IF;
 SELECT id INTO s FROM pipeline_stage_substatuses WHERE workspace_id=d.workspace_id AND stage_value='contract'
  AND (d.pipeline_id IS NULL OR pipeline_id=d.pipeline_id) AND lower(name)=lower(p_name) AND is_active ORDER BY position LIMIT 1;
 IF s IS NULL THEN RETURN false;END IF;
 BEGIN
  UPDATE deals SET stage='contract',stage_substatus_id=s WHERE id=d.deal_id AND stage_substatus_id IS DISTINCT FROM s;
 EXCEPTION WHEN OTHERS THEN
  INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
   VALUES(d.workspace_id,p_draft,auth.uid(),'deal_update_failed',jsonb_build_object('substatus',p_name,'error',SQLERRM));
  RETURN false;
 END;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_set_deal_substatus(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contract_draft_set_deal_substatus(uuid,text) TO service_role;

-- Aprovador gera o link de aceite (minuta aprovada) e, depois do envio, marca como enviada.
CREATE OR REPLACE FUNCTION public.contract_draft_issue_link(p_draft uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d record;u uuid:=auth.uid();t uuid;BEGIN
 IF is_read_only_view() THEN RAISE EXCEPTION 'Sessão somente leitura.' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft FOR UPDATE;
 IF d.id IS NULL OR NOT contract_draft_is_approver(d.workspace_id,u) THEN RAISE EXCEPTION 'Sem permissão para enviar esta minuta.' USING ERRCODE='42501';END IF;
 IF d.status NOT IN('approved','sent') THEN RAISE EXCEPTION 'A minuta precisa estar aprovada pelo jurídico.' USING ERRCODE='22023';END IF;
 t:=coalesce(d.public_token,gen_random_uuid());
 UPDATE contract_drafts SET public_token=t WHERE id=d.id;
 RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_issue_link(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_issue_link(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.contract_draft_mark_sent(p_draft uuid,p_to text,p_channel text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d record;u uuid:=auth.uid();BEGIN
 IF is_read_only_view() THEN RAISE EXCEPTION 'Sessão somente leitura.' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft FOR UPDATE;
 IF d.id IS NULL OR NOT contract_draft_is_approver(d.workspace_id,u) THEN RAISE EXCEPTION 'Sem permissão para enviar esta minuta.' USING ERRCODE='42501';END IF;
 IF d.status NOT IN('approved','sent') OR d.public_token IS NULL THEN RAISE EXCEPTION 'Gere o link da minuta aprovada antes.' USING ERRCODE='22023';END IF;
 IF p_channel NOT IN('email','link') THEN RAISE EXCEPTION 'Canal inválido.';END IF;
 UPDATE contract_drafts SET status='sent',sent_at=now(),sent_by=u,sent_to=left(nullif(btrim(coalesce(p_to,'')),''),500),updated_at=now() WHERE id=d.id;
 INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
  VALUES(d.workspace_id,d.id,u,'sent',jsonb_build_object('channel',p_channel,'to',left(coalesce(p_to,''),500)));
 PERFORM contract_draft_set_deal_substatus(d.id,'Minuta enviada');
 RETURN jsonb_build_object('id',d.id,'status','sent');
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_mark_sent(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_mark_sent(uuid,text,text) TO authenticated,service_role;

-- Leitura e decisão pelo cliente via token (chamadas só pelo servidor).
CREATE OR REPLACE FUNCTION public.contract_draft_public_get(p_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('title',d.title,'body_html',d.body_html,'status',d.status,
  'workspace_name',w.name,'client_decided_at',d.client_decided_at,'client_name',d.client_name)
 FROM contract_drafts d JOIN workspaces w ON w.id=d.workspace_id
 WHERE d.public_token=p_token AND d.status IN('sent','accepted','changes_requested');
$$;
REVOKE ALL ON FUNCTION public.contract_draft_public_get(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contract_draft_public_get(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.contract_draft_public_decide(p_token uuid,p_decision text,p_name text,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d record;ap record;moved boolean:=false;BEGIN
 SELECT * INTO d FROM contract_drafts WHERE public_token=p_token FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Minuta não encontrada.' USING ERRCODE='22023';END IF;
 IF d.status<>'sent' THEN RAISE EXCEPTION 'Esta minuta já foi respondida.' USING ERRCODE='22023';END IF;
 IF p_decision NOT IN('accept','changes') THEN RAISE EXCEPTION 'Decisão inválida.';END IF;
 IF length(btrim(coalesce(p_name,'')))<3 THEN RAISE EXCEPTION 'Informe seu nome.' USING ERRCODE='22023';END IF;
 IF p_decision='changes' AND length(btrim(coalesce(p_note,'')))<5 THEN RAISE EXCEPTION 'Descreva os ajustes desejados.' USING ERRCODE='22023';END IF;
 UPDATE contract_drafts SET status=CASE p_decision WHEN 'accept' THEN 'accepted' ELSE 'changes_requested' END,
  client_decided_at=now(),client_name=left(btrim(p_name),200),client_note=left(nullif(btrim(coalesce(p_note,'')),''),4000),
  revision=revision+1,updated_at=now() WHERE id=d.id;
 INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
  VALUES(d.workspace_id,d.id,NULL,CASE p_decision WHEN 'accept' THEN 'client_accepted' ELSE 'client_changes' END,
   jsonb_build_object('name',left(btrim(p_name),200),'note',left(coalesce(p_note,''),4000)));
 IF p_decision='accept' THEN moved:=contract_draft_set_deal_substatus(d.id,'Contrato em elaboração');END IF;
 FOR ap IN SELECT a.user_id FROM contract_draft_approvers a WHERE a.workspace_id=d.workspace_id
   AND is_workspace_member(a.workspace_id,a.user_id) LOOP
  INSERT INTO notifications(owner_id,user_id,workspace_id,type,title,body,link,entity,entity_id,dedupe_key)
  VALUES(ap.user_id,ap.user_id,d.workspace_id,'approval',
   CASE p_decision WHEN 'accept' THEN 'Cliente aceitou a minuta' ELSE 'Cliente pediu ajustes na minuta' END,
   CASE p_decision WHEN 'accept' THEN 'Contrato liberado para confecção e assinaturas.' ELSE left(btrim(p_note),300) END,
   '/contracts/drafts/'||d.id,'contract_drafts',d.id,'contract_draft:'||d.id||':client:'||(d.revision+1)||':'||ap.user_id)
  ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN jsonb_build_object('status',CASE p_decision WHEN 'accept' THEN 'accepted' ELSE 'changes_requested' END,'deal_moved',moved);
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_public_decide(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contract_draft_public_decide(uuid,text,text,text) TO service_role;