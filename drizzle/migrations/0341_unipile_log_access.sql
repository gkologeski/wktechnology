-- Legacy owner-only log policies also need the active workspace and effective permissions.
CREATE POLICY unipile_request_log_personal_read ON public.unipile_request_log AS RESTRICTIVE FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.unipile_accounts a WHERE a.id=account_id
 AND public.unipile_personal_access((SELECT public.work_access_context()),a.workspace_id,a.owner_id,'view')));
CREATE POLICY unipile_message_log_personal_read ON public.unipile_message_log AS RESTRICTIVE FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.unipile_accounts a WHERE a.id=account_id
 AND public.unipile_personal_access((SELECT public.work_access_context()),a.workspace_id,a.owner_id,'view')));
-- Receipts and outreach facts cannot be forged through direct REST.
REVOKE INSERT,UPDATE,DELETE ON public.unipile_message_log FROM authenticated;
