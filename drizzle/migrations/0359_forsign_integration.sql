CREATE TABLE public.forsign_connections (
 workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
 key_ciphertext text,
 key_last4 text,
 webhook_secret_ciphertext text,
 enabled boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','connected','failed')),
 last_error text,
 last_tested_at timestamptz,
 updated_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.forsign_connections FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.forsign_connections TO service_role;
ALTER TABLE public.forsign_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.contract_forsign_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
 contract_hash text NOT NULL CHECK (contract_hash ~ '^[a-f0-9]{64}$'),
 operation_id bigint,
 document_ids jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','sent','partially_signed','completed','evidence_recorded','canceled','expired','failed','stale')),
 members jsonb NOT NULL DEFAULT '[]',
 evidence_id uuid,
 last_error text,
 last_synced_at timestamptz,
 completed_at timestamptz,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contract_forsign_operations_op ON public.contract_forsign_operations(workspace_id, operation_id) WHERE operation_id IS NOT NULL;
CREATE UNIQUE INDEX contract_forsign_operations_active ON public.contract_forsign_operations(contract_id, contract_hash) WHERE status IN ('creating','sent','partially_signed','completed','evidence_recorded');
CREATE INDEX contract_forsign_operations_contract ON public.contract_forsign_operations(workspace_id, contract_id, created_at DESC);
CREATE INDEX contract_forsign_operations_pending ON public.contract_forsign_operations(status) WHERE status IN ('sent','partially_signed','completed');
REVOKE ALL ON public.contract_forsign_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.contract_forsign_operations TO authenticated;
GRANT ALL ON public.contract_forsign_operations TO service_role;
ALTER TABLE public.contract_forsign_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_forsign_operations_read ON public.contract_forsign_operations FOR SELECT TO authenticated
 USING (public.hiring_signature_access(workspace_id, contract_id, 'view'));

CREATE TABLE public.forsign_webhook_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 operation_id bigint NOT NULL,
 action integer NOT NULL,
 member_id bigint,
 event_created_at text NOT NULL DEFAULT '',
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX forsign_webhook_events_dedupe ON public.forsign_webhook_events(workspace_id, operation_id, action, coalesce(member_id, 0), event_created_at);
REVOKE ALL ON public.forsign_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.forsign_webhook_events TO service_role;
ALTER TABLE public.forsign_webhook_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techcontracts.forsign_settings.manage.workspace','techcontracts','forsign_settings','manage','workspace','Configurar integração ForSign','Cadastra a chave da API e o segredo do webhook do ForSign do workspace. Sem concessão automática.',true),
('techcontracts.forsign.manage.workspace','techcontracts','forsign','manage','workspace','Enviar contratos pelo ForSign','Envia a versão atual do contrato ao ForSign, atualiza e cancela envios. Exige também gerenciar evidências de assinatura. Sem concessão automática.',true)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.forsign_record_evidence(p_op uuid, p_path text, p_file_hash text, p_signed_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.contract_forsign_operations; r uuid;
BEGIN
 SELECT * INTO o FROM public.contract_forsign_operations WHERE id=p_op FOR UPDATE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'Envio ForSign não encontrado.'; END IF;
 IF o.evidence_id IS NOT NULL THEN RETURN o.evidence_id; END IF;
 PERFORM 1 FROM public.contracts WHERE id=o.contract_id AND workspace_id=o.workspace_id FOR UPDATE;
 IF o.contract_hash IS DISTINCT FROM public.hiring_contract_fingerprint(o.contract_id) THEN
  UPDATE public.contract_forsign_operations SET status='stale', last_error='O contrato mudou depois do envio; o PDF assinado não vale para a versão atual.', updated_at=now() WHERE id=o.id;
  RETURN NULL;
 END IF;
 IF p_path NOT LIKE o.workspace_id::text||'/'||o.contract_id::text||'/%' OR p_file_hash !~ '^[a-f0-9]{64}$'
  OR NOT EXISTS(SELECT 1 FROM storage.objects s WHERE s.bucket_id='contract-signature-evidence' AND s.name=p_path AND s.user_metadata->>'sha256'=p_file_hash AND s.user_metadata->>'contract_hash'=o.contract_hash) THEN
  RAISE EXCEPTION 'PDF assinado não encontrado no arquivo de evidências.';
 END IF;
 INSERT INTO public.hiring_contract_evidence(workspace_id,contract_id,kind,contract_hash,file_path,file_hash,signed_on,reference,note,recorded_by)
 VALUES(o.workspace_id,o.contract_id,'external',o.contract_hash,p_path,p_file_hash,coalesce(p_signed_on,(now() AT TIME ZONE 'America/Sao_Paulo')::date),
  'ForSign · operação '||o.operation_id,'Assinado no ForSign e recebido automaticamente pela integração (PDF final e trilha de auditoria do ForSign).',o.created_by)
 RETURNING id INTO r;
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details)
 VALUES(o.workspace_id,o.contract_id,o.created_by,'external_attested',jsonb_build_object('evidence_id',r,'file_hash',p_file_hash,'provider','forsign','operation_id',o.operation_id));
 UPDATE public.contract_forsign_operations SET status='evidence_recorded', evidence_id=r, updated_at=now() WHERE id=o.id;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.forsign_record_evidence(uuid,text,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.forsign_record_evidence(uuid,text,text,date) TO service_role;