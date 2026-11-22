DO $audit$
BEGIN
 PERFORM set_config('inbox.guard_catalog_before', (SELECT jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]'::jsonb) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR (d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid))) FROM pg_proc p WHERE p.oid='techerp_api.inbox_workflow_guard()'::regprocedure)::text,true);
END $audit$;
CREATE OR REPLACE FUNCTION techerp_api.inbox_workflow_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $guard$
DECLARE
 context jsonb;
 keys jsonb;
 config jsonb;
 channel text;
 account jsonb;
 initial_draft boolean;
 configs jsonb[];
 old_channel text;
BEGIN
 -- Ordinary entities retain their existing guards and authorization.
 IF NEW.entity <> 'inbox_channel_occurrences' THEN
  IF TG_OP='UPDATE' AND OLD.entity='inbox_channel_occurrences' THEN
   IF techerp_api.inbox_event_channel(NEW.trigger#>>'{notification_event,key}') IS NOT NULL
    OR techerp_api.inbox_event_channel(NEW.draft_trigger#>>'{notification_event,key}') IS NOT NULL THEN
    RAISE EXCEPTION 'Troca de origem exige configuração compatível.' USING ERRCODE='42501';
   END IF;
   old_channel:=techerp_api.inbox_event_channel(coalesce(OLD.draft_trigger,OLD.trigger)#>>'{notification_event,key}');
  ELSE
   RETURN NEW;
  END IF;
 END IF;
 context:=public.work_access_context();
 keys:=context->'keys';
 IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'
  OR context->>'actor' IS DISTINCT FROM auth.uid()::text
  OR context->>'workspace' IS DISTINCT FROM NEW.workspace_id::text
  OR public.is_workspace_member(NEW.workspace_id,auth.uid()) IS NOT TRUE
  OR public.is_read_only_view() IS TRUE THEN
  RAISE EXCEPTION 'Ator indisponível.' USING ERRCODE='42501';
 END IF;
 IF NOT (coalesce((keys->>'system.workflows.view.own')::boolean,false)
  OR coalesce((keys->>'system.workflows.view.team')::boolean,false)
  OR coalesce((keys->>'system.workflows.view.workspace')::boolean,false))
  OR NOT (coalesce((keys->>'system.workflows.manage.own')::boolean,false)
  OR coalesce((keys->>'system.workflows.manage.team')::boolean,false)
  OR coalesce((keys->>'system.workflows.manage.workspace')::boolean,false)) THEN
  RAISE EXCEPTION 'Workflows indisponível.' USING ERRCODE='42501';
 END IF;
 IF NEW.entity <> 'inbox_channel_occurrences' THEN
  IF old_channel IS NULL OR NOT (
   coalesce((keys->>('techsales.inbox.'||old_channel||'.view.own'))::boolean,false)
   OR coalesce((keys->>('techsales.inbox.'||old_channel||'.view.team'))::boolean,false)
   OR coalesce((keys->>('techsales.inbox.'||old_channel||'.view.workspace'))::boolean,false)) THEN
   RAISE EXCEPTION 'Canal indisponível.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 -- The live placeholder is valid only before first publication, while inactive.
 -- It matches saveWorkflow's real INSERT ({},[],draft_trigger,draft_actions).
 initial_draft:=NEW.status='draft' AND NEW.enabled IS FALSE
  AND NEW.published_version=0 AND NEW.trigger='{}'::jsonb AND NEW.actions='[]'::jsonb
  AND NEW.draft_trigger IS NOT NULL AND NEW.draft_actions IS NOT NULL;
 IF TG_OP='UPDATE' THEN
  initial_draft:=initial_draft AND OLD.status='draft' AND OLD.enabled IS FALSE
   AND OLD.published_version=0 AND OLD.trigger='{}'::jsonb AND OLD.actions='[]'::jsonb;
 END IF;
 IF initial_draft THEN
  configs:=ARRAY[NEW.draft_trigger->'notification_event'];
 ELSE
  configs:=ARRAY[NEW.trigger->'notification_event',coalesce(NEW.draft_trigger,NEW.trigger)->'notification_event'];
 END IF;
 FOREACH config IN ARRAY configs LOOP
  IF techerp_api.inbox_selection_valid(NEW.workspace_id,config) IS NOT TRUE THEN
   RAISE EXCEPTION 'Evento ou canal inválido.' USING ERRCODE='42501';
  END IF;
  channel:=techerp_api.inbox_event_channel(config->>'key');
  -- Authors require Workflows + channel even when account_ids is absent or [].
  -- Recipient conversation visibility is a separate, unchanged RLS boundary.
  IF NOT (coalesce((keys->>('techsales.inbox.'||channel||'.view.own'))::boolean,false)
   OR coalesce((keys->>('techsales.inbox.'||channel||'.view.team'))::boolean,false)
   OR coalesce((keys->>('techsales.inbox.'||channel||'.view.workspace'))::boolean,false)) THEN
   RAISE EXCEPTION 'Canal indisponível.' USING ERRCODE='42501';
  END IF;
  FOR account IN SELECT * FROM jsonb_array_elements(coalesce(config->'account_ids','[]'::jsonb)) LOOP
   IF public.workflow_inbox_account_visible(NEW.workspace_id,channel,(account#>>'{}')::uuid) IS NOT TRUE THEN
    RAISE EXCEPTION 'Conta indisponível.' USING ERRCODE='42501';
   END IF;
  END LOOP;
 END LOOP;
 IF NEW.trigger?'time_based' OR coalesce(NEW.draft_trigger,'{}'::jsonb)?'time_based'
  OR techerp_api.inbox_actions_valid(NEW.actions) IS NOT TRUE
  OR (NEW.draft_actions IS NOT NULL AND techerp_api.inbox_actions_valid(NEW.draft_actions) IS NOT TRUE) THEN
  RAISE EXCEPTION 'Origem somente leitura exige ações independentes.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $guard$;
DO $audit$
DECLARE catalog_after jsonb;
BEGIN
 SELECT jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]'::jsonb) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR (d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid))) INTO catalog_after FROM pg_proc p WHERE p.oid='techerp_api.inbox_workflow_guard()'::regprocedure;
 IF catalog_after IS DISTINCT FROM current_setting('inbox.guard_catalog_before')::jsonb THEN
  RAISE EXCEPTION 'Inbox guard identity, ACL or dependencies changed';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.workflows'::regclass AND tgname='inbox_runtime_release_guard' AND tgenabled='O') THEN
  RAISE EXCEPTION 'Draft availability lock must stay enabled';
 END IF;
END $audit$;
NOTIFY pgrst,'reload schema';
