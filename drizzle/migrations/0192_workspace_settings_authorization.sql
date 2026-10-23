-- Separate configuration privileges from invoices/payments and meeting operations.
-- No role/preset grants and no existing JSON settings are changed.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
VALUES
 ('techfinance.payments_settings.view.workspace','techfinance','payments_settings','view','workspace','Ver configurações de pagamentos','Consultar gateway, ambiente e método de cobrança do workspace.',true),
 ('techfinance.payments_settings.manage.workspace','techfinance','payments_settings','manage','workspace','Gerenciar configurações de pagamentos','Alterar gateway, ambiente e método; exige também visualização.',true),
 ('techfinance.nfse_settings.view.workspace','techfinance','nfse_settings','view','workspace','Ver configurações de NFS-e','Consultar provedor e parâmetros de emissão de NFS-e.',true),
 ('techfinance.nfse_settings.manage.workspace','techfinance','nfse_settings','manage','workspace','Gerenciar configurações de NFS-e','Alterar provedor e parâmetros fiscais; exige também visualização.',true),
 ('techsales.meeting_settings.view.workspace','techsales','meeting_settings','view','workspace','Ver configurações de reuniões','Consultar provedor, consentimento, retenção e transcrição.',true),
 ('techsales.meeting_settings.manage.workspace','techsales','meeting_settings','manage','workspace','Gerenciar configurações de reuniões','Alterar política de reuniões; exige também visualização.',true)
ON CONFLICT(key) DO NOTHING;

-- Table-wide SELECT/INSERT/UPDATE defeats column revocation. Replace it with
-- the same privileges on non-sensitive columns; preserve RLS, service_role and
-- administrative SQL access. No authenticated SELECT * can reveal these JSONs.
DO $columns$
DECLARE v_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) INTO v_columns
    FROM pg_attribute WHERE attrelid='public.workspaces'::regclass
      AND attnum>0 AND NOT attisdropped
      AND attname NOT IN ('payments_settings','nfse_settings','meeting_settings');
  REVOKE SELECT,INSERT,UPDATE ON public.workspaces FROM PUBLIC,anon,authenticated;
  REVOKE SELECT(payments_settings,nfse_settings,meeting_settings),
    INSERT(payments_settings,nfse_settings,meeting_settings),
    UPDATE(payments_settings,nfse_settings,meeting_settings)
    ON public.workspaces FROM PUBLIC,anon,authenticated;
  EXECUTE format('GRANT SELECT(%s),INSERT(%s),UPDATE(%s) ON public.workspaces TO anon,authenticated',v_columns,v_columns,v_columns);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='techerp_api_subject') THEN
    REVOKE SELECT,INSERT,UPDATE ON public.workspaces FROM techerp_api_subject;
    REVOKE SELECT(payments_settings,nfse_settings,meeting_settings),
      INSERT(payments_settings,nfse_settings,meeting_settings),
      UPDATE(payments_settings,nfse_settings,meeting_settings)
      ON public.workspaces FROM techerp_api_subject;
  END IF;
END $columns$;

CREATE OR REPLACE FUNCTION public.workspace_settings_assert(_workspace uuid,_section text,_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_prefix text; v_actor uuid:=auth.uid();
BEGIN
  v_prefix := CASE _section
    WHEN 'payments' THEN 'techfinance.payments_settings'
    WHEN 'nfse' THEN 'techfinance.nfse_settings'
    WHEN 'meeting' THEN 'techsales.meeting_settings' END;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Configuração não reconhecida.' USING ERRCODE='22023';
  END IF;
  IF _workspace IS NULL OR v_actor IS NULL OR _write IS NULL
     OR NOT public.is_workspace_member(_workspace,v_actor)
     OR _workspace NOT IN(SELECT public.current_user_workspaces())
     OR NOT public.user_has_permission(v_actor,_workspace,v_prefix||'.view.workspace')
     OR (_write AND (public.is_read_only_view()
       OR NOT public.user_has_permission(v_actor,_workspace,v_prefix||'.manage.workspace'))) THEN
    RAISE EXCEPTION 'Você não tem permissão para acessar estas configurações.' USING ERRCODE='42501';
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.workspace_settings_assert(uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_workspace_sensitive_settings(_workspace uuid,_section text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_value jsonb;
BEGIN
  PERFORM public.workspace_settings_assert(_workspace,_section,false);
  SELECT CASE _section WHEN 'payments' THEN w.payments_settings
      WHEN 'nfse' THEN w.nfse_settings WHEN 'meeting' THEN w.meeting_settings END
    INTO v_value FROM public.workspaces w WHERE w.id=_workspace;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuração indisponível.' USING ERRCODE='42501'; END IF;
  RETURN COALESCE(v_value,'{}'::jsonb);
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_workspace_sensitive_settings(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_sensitive_settings(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_workspace_sensitive_settings(_workspace uuid,_section text,_value jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_allowed text[]; v_column text; v_previous jsonb; v_changed jsonb;
BEGIN
  PERFORM public.workspace_settings_assert(_workspace,_section,true);
  IF jsonb_typeof(_value) IS DISTINCT FROM 'object' OR octet_length(_value::text)>16384 THEN
    RAISE EXCEPTION 'Formato de configuração inválido.' USING ERRCODE='22023';
  END IF;
  v_allowed := CASE _section
    WHEN 'payments' THEN ARRAY['gateway','mode','default_method']
    WHEN 'nfse' THEN ARRAY['provider','enabled','service_code','municipal_inscription','company_id_nfeio']
    WHEN 'meeting' THEN ARRAY['provider','require_consent','retention_days','transcription_model'] END;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(_value) k WHERE NOT k=ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Campo não permitido na configuração.' USING ERRCODE='22023';
  END IF;
  IF _section='payments' AND NOT COALESCE(
      _value->>'gateway' IN('asaas','pagarme','mercadopago','manual')
      AND _value->>'mode' IN('sandbox','live')
      AND _value->>'default_method' IN('pix','boleto','credit_card'),false) THEN
    RAISE EXCEPTION 'Parâmetros de pagamento inválidos.' USING ERRCODE='22023';
  ELSIF _section='nfse' THEN
    IF NOT COALESCE(_value->>'provider'='nfe_io' AND jsonb_typeof(_value->'enabled')='boolean',false)
       OR EXISTS(SELECT 1 FROM unnest(ARRAY['service_code','municipal_inscription','company_id_nfeio']) k
         WHERE (_value ? k) AND (jsonb_typeof(_value->k) NOT IN('string','null')
           OR length(_value->>k)>CASE WHEN k='company_id_nfeio' THEN 120 ELSE 50 END)) THEN
      RAISE EXCEPTION 'Parâmetros de NFS-e inválidos.' USING ERRCODE='22023';
    END IF;
  ELSIF _section='meeting' THEN
    IF NOT COALESCE(_value->>'provider'='jitsi'
        AND jsonb_typeof(_value->'require_consent')='boolean'
        AND jsonb_typeof(_value->'retention_days')='number'
        AND _value->>'retention_days' ~ '^[0-9]{1,3}$'
        AND jsonb_typeof(_value->'transcription_model')='string'
        AND length(_value->>'transcription_model') BETWEEN 1 AND 100,false) THEN
      RAISE EXCEPTION 'Parâmetros de reunião inválidos.' USING ERRCODE='22023';
    END IF;
    IF (_value->>'retention_days')::integer NOT BETWEEN 1 AND 365 THEN
      RAISE EXCEPTION 'A retenção deve ser entre 1 e 365 dias.' USING ERRCODE='22023';
    END IF;
  END IF;
  v_column := CASE _section WHEN 'payments' THEN 'payments_settings'
    WHEN 'nfse' THEN 'nfse_settings' WHEN 'meeting' THEN 'meeting_settings' END;
  EXECUTE format('SELECT %I FROM public.workspaces WHERE id=$1 FOR UPDATE',v_column)
    INTO v_previous USING _workspace;
  IF v_previous IS NULL THEN RAISE EXCEPTION 'Configuração indisponível.' USING ERRCODE='42501'; END IF;
  IF v_previous IS NOT DISTINCT FROM _value THEN RETURN false; END IF;
  EXECUTE format('UPDATE public.workspaces SET %I=$1 WHERE id=$2',v_column) USING _value,_workspace;
  SELECT COALESCE(jsonb_agg(k ORDER BY k),'[]'::jsonb) INTO v_changed FROM (
    SELECT jsonb_object_keys(COALESCE(v_previous,'{}'::jsonb)) AS k
    UNION SELECT jsonb_object_keys(_value)
  ) keys WHERE (v_previous->k) IS DISTINCT FROM (_value->k);
  INSERT INTO public.access_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details)
    VALUES(_workspace,auth.uid(),'workspace_settings_updated','workspace_settings',_workspace,
      jsonb_build_object('section',_section,'changed_keys',v_changed));
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.save_workspace_sensitive_settings(uuid,text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.save_workspace_sensitive_settings(uuid,text,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
