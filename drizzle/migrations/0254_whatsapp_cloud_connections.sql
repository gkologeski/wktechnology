-- Direct Cloud API is opt-in; the current Lovable connector is not modified.
CREATE TABLE public.wa_cloud_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
 waba_id text NOT NULL UNIQUE CHECK(waba_id ~ '^[0-9]{5,30}$'),
 api_version text NOT NULL CHECK(api_version ~ '^v[0-9]{2}\.0$'),
 credentials_ciphertext text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 webhook_verified_at timestamptz,
 synced_at timestamptz,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id, workspace_id)
);
ALTER TABLE public.wa_cloud_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_cloud_connections FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.wa_cloud_connections TO service_role;
-- Ciphertext and app secret are never exposed via PostgREST to users.
CREATE TABLE public.wa_cloud_numbers (
 phone_number_id text PRIMARY KEY CHECK(phone_number_id ~ '^[0-9]{5,30}$'),
 connection_id uuid NOT NULL,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 display_phone_number text NOT NULL,
 verified_name text,
 quality_rating text,
 status text,
 available boolean NOT NULL DEFAULT true,
 synced_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(connection_id,workspace_id) REFERENCES public.wa_cloud_connections(id,workspace_id)
);
ALTER TABLE public.wa_cloud_numbers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_cloud_numbers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.wa_cloud_numbers TO authenticated;
GRANT ALL ON public.wa_cloud_numbers TO service_role;
CREATE POLICY wa_cloud_numbers_read ON public.wa_cloud_numbers FOR SELECT TO authenticated
 USING(public.is_workspace_member(workspace_id,auth.uid()) AND public.user_has_permission(auth.uid(),workspace_id,'system.whatsapp.view.workspace'));
CREATE INDEX wa_cloud_numbers_workspace ON public.wa_cloud_numbers(workspace_id,connection_id);

CREATE FUNCTION public.wa_cloud_sync_numbers(p_connection uuid,p_workspace uuid,p_numbers jsonb,p_synced_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 PERFORM 1 FROM wa_cloud_connections WHERE id=p_connection AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'connection unavailable'; END IF;
 IF jsonb_typeof(p_numbers)<>'array' THEN RAISE EXCEPTION 'invalid numbers'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_numbers) n JOIN wa_cloud_numbers p ON p.phone_number_id=n->>'phone_number_id'
   WHERE p.connection_id<>p_connection OR p.workspace_id<>p_workspace) THEN RAISE EXCEPTION 'number already assigned'; END IF;
 UPDATE wa_cloud_numbers SET available=false WHERE connection_id=p_connection AND workspace_id=p_workspace;
 INSERT INTO wa_cloud_numbers(phone_number_id,connection_id,workspace_id,display_phone_number,verified_name,quality_rating,status,available,synced_at)
 SELECT n->>'phone_number_id',p_connection,p_workspace,n->>'display_phone_number',n->>'verified_name',n->>'quality_rating',n->>'status',true,p_synced_at
 FROM jsonb_array_elements(p_numbers) n
 ON CONFLICT(phone_number_id) DO UPDATE SET display_phone_number=excluded.display_phone_number,
 verified_name=excluded.verified_name,quality_rating=excluded.quality_rating,status=excluded.status,available=true,synced_at=excluded.synced_at
 WHERE wa_cloud_numbers.connection_id=excluded.connection_id AND wa_cloud_numbers.workspace_id=excluded.workspace_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>jsonb_array_length(p_numbers) THEN RAISE EXCEPTION 'concurrent number assignment'; END IF;
 UPDATE wa_cloud_connections SET synced_at=p_synced_at WHERE id=p_connection AND workspace_id=p_workspace;
END $$;
REVOKE ALL ON FUNCTION public.wa_cloud_sync_numbers(uuid,uuid,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_cloud_sync_numbers(uuid,uuid,jsonb,timestamptz) TO service_role;
