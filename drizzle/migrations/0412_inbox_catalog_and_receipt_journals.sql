CREATE OR REPLACE FUNCTION public.workflow_inbox_sources(p_workspace uuid,p_channel text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE sources jsonb; c jsonb:=public.work_access_context(); k jsonb:=c->'keys';
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'
    OR c->>'workspace' IS DISTINCT FROM p_workspace::text
    OR c->>'actor' IS DISTINCT FROM auth.uid()::text
    OR NOT public.is_workspace_member(p_workspace,auth.uid())
    OR NOT (
      coalesce((k->>'system.workflows.view.own')::boolean,false)
      OR coalesce((k->>'system.workflows.view.team')::boolean,false)
      OR coalesce((k->>'system.workflows.view.workspace')::boolean,false)
    ) THEN RAISE EXCEPTION 'Catálogo indisponível.' USING ERRCODE='42501'; END IF;
  IF p_channel NOT IN ('email','chat','linkedin') OR p_channel IS NULL THEN
    RAISE EXCEPTION 'Canal inválido.' USING ERRCODE='22023';
  END IF;
  IF NOT (
    coalesce((k->>('techsales.inbox.'||p_channel||'.view.own'))::boolean,false)
    OR coalesce((k->>('techsales.inbox.'||p_channel||'.view.team'))::boolean,false)
    OR coalesce((k->>('techsales.inbox.'||p_channel||'.view.workspace'))::boolean,false)
  ) THEN RAISE EXCEPTION 'Canal indisponível.' USING ERRCODE='42501'; END IF;
  IF p_channel='email' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'label',a.email) ORDER BY a.email),'[]')
    INTO sources FROM (
      SELECT id,email FROM public.email_accounts WHERE workspace_id=p_workspace
        AND public.workflow_inbox_account_visible(p_workspace,'email',id)
      ORDER BY email LIMIT 100
    ) a;
  ELSIF p_channel='linkedin' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'label','LinkedIn pessoal') ORDER BY a.id),'[]')
    INTO sources FROM (
      SELECT id FROM public.unipile_accounts WHERE workspace_id=p_workspace
        AND public.workflow_inbox_account_visible(p_workspace,'linkedin',id)
      ORDER BY id LIMIT 100
    ) a;
  ELSE
    sources:=CASE WHEN public.workflow_inbox_account_visible(p_workspace,'chat',p_workspace)
      THEN jsonb_build_array(jsonb_build_object('id',p_workspace,'label','Chat do site deste workspace'))
      ELSE '[]'::jsonb END;
  END IF;
  RETURN jsonb_build_object('workspace_id',p_workspace,'channel',p_channel,'sources',sources);
END $$;
REVOKE ALL ON FUNCTION public.workflow_inbox_sources(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.workflow_inbox_sources(uuid,text) TO authenticated;

CREATE TABLE public.inbox_widget_receipts (
  session_id uuid NOT NULL REFERENCES public.live_chat_sessions(id),
  request_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.live_chat_messages(id),
  body_hash text NOT NULL CHECK (body_hash ~ '^[a-f0-9]{64}$'),
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (session_id,request_id), UNIQUE (message_id)
);
GRANT ALL ON public.inbox_widget_receipts TO service_role;
ALTER TABLE public.inbox_widget_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inbox_widget_receipts FROM PUBLIC,anon,authenticated;
CREATE TABLE public.inbox_unipile_envelopes (
  account_id uuid NOT NULL REFERENCES public.unipile_accounts(id),
  provider_id text NOT NULL, chat_id text NOT NULL, sender_id text NOT NULL,
  envelope_hash text NOT NULL CHECK (envelope_hash ~ '^[a-f0-9]{64}$'),
  body_hash text NOT NULL CHECK (body_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz, received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  provenance text NOT NULL CHECK (provenance IN ('live_signed','history')),
  self_sent boolean NOT NULL, PRIMARY KEY (account_id,provider_id)
);
GRANT ALL ON public.inbox_unipile_envelopes TO service_role;
ALTER TABLE public.inbox_unipile_envelopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inbox_unipile_envelopes FROM PUBLIC,anon,authenticated;
CREATE FUNCTION techerp_api.inbox_immutable_proof() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Prova de ocorrência imutável.' USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_immutable_proof() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_evidence_immutable BEFORE UPDATE OR DELETE
  ON public.inbox_channel_evidence FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_immutable_proof();
CREATE TRIGGER inbox_occurrence_immutable BEFORE UPDATE OR DELETE
  ON public.inbox_channel_occurrences FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_immutable_proof();
CREATE TRIGGER inbox_widget_receipt_immutable BEFORE UPDATE OR DELETE
  ON public.inbox_widget_receipts FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_immutable_proof();
CREATE TRIGGER inbox_unipile_envelope_immutable BEFORE UPDATE OR DELETE
  ON public.inbox_unipile_envelopes FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_immutable_proof();
NOTIFY pgrst,'reload schema';
