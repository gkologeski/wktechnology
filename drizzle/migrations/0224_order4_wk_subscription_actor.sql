-- Scoped operational attribution approved by Guilherme on 2026-10-25.
-- Preserve historical authors and role permissions; no other workspace is updated.
DO $actor$
DECLARE w uuid:='184b9435-0a9b-4334-9e89-8854dc883f5d';u uuid:='1c237fbe-079e-4eb9-a3e6-c08d85e79688';
 ids uuid[]:=ARRAY['42aacdb6-0d3e-41fa-bcec-3b37c88bd713','7039b884-9fbe-4918-bc33-3666af791260','9439d2bc-ace8-4868-8ce8-7e88ed2d7c6e','e4a4b46c-e50d-4f6d-8fd0-e9c61489cd0c']::uuid[];
 prev text:=current_setting('request.jwt.claims',true); n integer;
BEGIN
 -- Empty/non-WK installations do not receive fixture records or grants.
 IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=w) THEN RETURN;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=w AND user_id=u AND status='active') THEN RAISE EXCEPTION 'WK execution owner must remain an active member';END IF;
 SELECT count(*) INTO n FROM public.workflow_subscriptions WHERE workspace_id=w AND id=ANY(ids) AND enabled AND created_by IS NULL AND (execution_user_id IS NULL OR execution_user_id=u);
 IF n<>4 THEN RAISE EXCEPTION 'WK subscriptions changed since the approved review; expected 4, got %',n;END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
 UPDATE public.workflow_subscriptions SET execution_user_id=u WHERE workspace_id=w AND id=ANY(ids) AND execution_user_id IS NULL;
 PERFORM set_config('request.jwt.claims',coalesce(prev,''),true);
END $actor$;
