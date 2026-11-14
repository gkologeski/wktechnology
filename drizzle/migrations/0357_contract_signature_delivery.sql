-- Contextual contract invitations: no role grants, no client-readable signing tokens.
CREATE TABLE public.contract_esign_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
 signer_id uuid NOT NULL REFERENCES public.esign_signers(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, actor_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','suppressed','failed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,signer_id,request_id)
);
CREATE INDEX contract_esign_deliveries_document ON public.contract_esign_deliveries(workspace_id,document_id,created_at DESC);
ALTER TABLE public.contract_esign_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_esign_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.contract_esign_deliveries TO authenticated;
GRANT ALL ON public.contract_esign_deliveries TO service_role;
CREATE POLICY contract_esign_deliveries_read ON public.contract_esign_deliveries FOR SELECT TO authenticated
USING(workspace_id=(SELECT (public.work_access_context()->>'workspace')::uuid) AND public.work_record_access('techcontracts.esign',document_id,'view'));

CREATE OR REPLACE FUNCTION public.contract_esign_request(p_contract uuid,p_hash text,p_document uuid,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;d public.esign_documents;c jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_request IS NULL OR is_read_only_view() THEN RAISE EXCEPTION 'Sessão e requisição obrigatórias.' USING ERRCODE='42501';END IF;
 w:=work_area_authorize('techcontracts.esign','send',p_document);
 PERFORM work_area_authorize('techcontracts.esign','view',p_document);
 c:=hiring_contract_signature_context(w,p_contract);
 IF c->>'hash' IS DISTINCT FROM p_hash OR NOT EXISTS(SELECT 1 FROM public.hiring_contract_evidence e WHERE e.workspace_id=w AND e.contract_id=p_contract AND e.document_id=p_document AND e.contract_hash=p_hash AND e.revoked_at IS NULL AND e.kind='native') THEN
  RAISE EXCEPTION 'Documento não corresponde à versão atual do contrato. Recarregue e prepare uma nova assinatura.' USING ERRCODE='23514';END IF;
 SELECT * INTO d FROM public.esign_documents WHERE id=p_document AND workspace_id=w FOR UPDATE;
 IF d.id IS NULL OR d.status::text NOT IN('draft','sent','partially_signed') OR (d.expires_at IS NOT NULL AND d.expires_at<=now()) THEN RAISE EXCEPTION 'Documento indisponível para envio.' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.contract_esign_deliveries WHERE document_id=d.id AND request_id<>p_request AND created_at>now()-interval '60 seconds') THEN RAISE EXCEPTION 'Aguarde 60 segundos antes de solicitar outro envio.' USING ERRCODE='23514';END IF;
 IF d.status::text='draft' THEN PERFORM contract_esign_manage('send',d.id,'{}');END IF;
 INSERT INTO public.contract_esign_deliveries(workspace_id,contract_id,document_id,signer_id,request_id,actor_id)
 SELECT w,p_contract,d.id,s.id,p_request,auth.uid() FROM public.esign_signers s WHERE s.document_id=d.id AND s.workspace_id=w AND s.status::text IN('pending','viewed') ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('workspace_id',w,'deliveries',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'signer_id',x.signer_id,'status',x.status)) FROM public.contract_esign_deliveries x JOIN public.esign_signers s ON s.id=x.signer_id AND s.document_id=d.id AND s.workspace_id=w WHERE x.document_id=d.id AND x.workspace_id=w AND x.request_id=p_request AND s.status::text IN('pending','viewed')),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.contract_esign_request(uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_esign_request(uuid,text,uuid,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
