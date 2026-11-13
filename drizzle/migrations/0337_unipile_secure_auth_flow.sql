-- Authentication correlation is private, single-use and tenant-bound. No grants to user roles.
CREATE TABLE public.unipile_auth_flows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL,workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 scope_id text,expected_account_id text,state_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,consumed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX unipile_auth_flows_owner_window ON public.unipile_auth_flows(owner_id,workspace_id,created_at DESC);
ALTER TABLE public.unipile_auth_flows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unipile_auth_flows FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.unipile_auth_flows TO service_role;
ALTER TABLE public.unipile_accounts ADD COLUMN account_scope_id text;
-- Direct REST cannot forge a verified provider account or change a credential's owner.
REVOKE INSERT,UPDATE,DELETE ON public.unipile_accounts FROM authenticated;
CREATE FUNCTION public.unipile_connect_complete(p_flow uuid,p_state_hash text,p_account_id text,p_scope_id text,p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f public.unipile_auth_flows; result uuid;
BEGIN
 SELECT * INTO f FROM public.unipile_auth_flows WHERE id=p_flow;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid connection flow' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(f.workspace_id::text||f.owner_id::text,0));
 SELECT * INTO f FROM public.unipile_auth_flows WHERE id=p_flow FOR UPDATE;
 IF NOT FOUND OR f.consumed_at IS NOT NULL OR f.expires_at<=now() OR f.state_hash IS DISTINCT FROM p_state_hash OR f.scope_id IS DISTINCT FROM p_scope_id OR (f.expected_account_id IS NOT NULL AND f.expected_account_id IS DISTINCT FROM p_account_id)
 THEN RAISE EXCEPTION 'Invalid or consumed connection flow' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.unipile_accounts WHERE unipile_account_id=p_account_id AND (owner_id<>f.owner_id OR workspace_id IS DISTINCT FROM f.workspace_id))
 THEN RAISE EXCEPTION 'Provider account already assigned' USING ERRCODE='42501';END IF;
 IF NOT public.unipile_personal_access(public.work_subject_context(f.workspace_id,f.owner_id),f.workspace_id,f.owner_id,'manage') THEN RAISE EXCEPTION 'Permission revoked' USING ERRCODE='42501';END IF;
 SELECT id INTO result FROM public.unipile_accounts WHERE owner_id=f.owner_id AND workspace_id=f.workspace_id AND provider='linkedin' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF result IS NULL THEN
 INSERT INTO public.unipile_accounts(owner_id,workspace_id,provider,status,unipile_account_id,account_scope_id,display_name,connected_at,last_seen_at)
 VALUES(f.owner_id,f.workspace_id,'linkedin','connected',p_account_id,p_scope_id,p_name,now(),now()) RETURNING id INTO result;
 ELSE
 UPDATE public.unipile_accounts SET status='connected',unipile_account_id=p_account_id,account_scope_id=p_scope_id,display_name=p_name,
 connected_at=now(),last_seen_at=now(),last_error=NULL,connect_token=NULL WHERE id=result;
 END IF;
 UPDATE public.unipile_auth_flows SET consumed_at=now() WHERE id=f.id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.unipile_connect_complete(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_connect_complete(uuid,text,text,text,text) TO service_role;
CREATE FUNCTION public.unipile_connect_start(p_owner uuid,p_workspace uuid,p_scope text,p_expected_account text,p_state_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||p_owner::text,0));
 IF NOT public.unipile_personal_access(public.work_subject_context(p_workspace,p_owner),p_workspace,p_owner,'manage') THEN RAISE EXCEPTION 'Permission revoked' USING ERRCODE='42501';END IF;
 IF length(p_state_hash)<>64 THEN RAISE EXCEPTION 'Invalid state';END IF;
 IF p_expected_account IS NOT NULL AND NOT EXISTS(SELECT 1 FROM unipile_accounts WHERE owner_id=p_owner AND workspace_id=p_workspace AND unipile_account_id=p_expected_account AND account_scope_id IS NOT DISTINCT FROM p_scope) THEN RAISE EXCEPTION 'Account not owned';END IF;
 IF p_expected_account IS NULL AND nullif(p_scope,'') IS NULL THEN RAISE EXCEPTION 'New account needs a personal scope';END IF;
 IF (SELECT count(*) FROM unipile_auth_flows WHERE owner_id=p_owner AND workspace_id=p_workspace AND created_at>now()-interval '10 minutes')>=5 THEN RAISE EXCEPTION 'Connection attempts temporarily limited';END IF;
 UPDATE unipile_auth_flows SET consumed_at=now() WHERE owner_id=p_owner AND workspace_id=p_workspace AND consumed_at IS NULL;
 INSERT INTO unipile_auth_flows(owner_id,workspace_id,scope_id,expected_account_id,state_hash,expires_at)
 VALUES(p_owner,p_workspace,p_scope,p_expected_account,p_state_hash,now()+interval '10 minutes') RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.unipile_connect_start(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_connect_start(uuid,uuid,text,text,text) TO service_role;
