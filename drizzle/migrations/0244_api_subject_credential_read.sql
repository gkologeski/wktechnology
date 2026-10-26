-- Using an existing key is independent of permission to manage credentials.
-- The private API role can read only the exact key bound to this transaction.
-- Browsers cannot create subject_sessions or assume techerp_api_subject.
CREATE OR REPLACE FUNCTION public.shared_api_subject_key_read(k uuid,w uuid,o uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(o=auth.uid() AND public.is_workspace_member(w,auth.uid())
 AND EXISTS(SELECT 1 FROM techerp_api.subject_sessions s
 WHERE s.txid=txid_current_if_assigned() AND s.user_id=auth.uid()
 AND s.workspace_id=w AND s.api_key_id=k),false)
$$;
REVOKE ALL ON FUNCTION public.shared_api_subject_key_read(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shared_api_subject_key_read(uuid,uuid,uuid) TO techerp_api_subject;
CREATE POLICY api_key_subject_read ON public.api_keys FOR SELECT TO techerp_api_subject
USING(public.shared_api_subject_key_read(id,workspace_id,owner_id));
NOTIFY pgrst,'reload schema';
