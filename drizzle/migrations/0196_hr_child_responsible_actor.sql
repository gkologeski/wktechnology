-- Forward fix for legacy sync_responsible copying workspace-as-owner into assignee.
CREATE OR REPLACE FUNCTION public.hr_child_links_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j jsonb; previous jsonb; expected_workspace uuid; member uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 j:=to_jsonb(NEW);
 -- The shared legacy responsible trigger uses owner_id, which is a workspace
 -- on these historical HR tables. Normalize only this deterministic INSERT case.
 IF TG_OP='INSERT' AND j ? 'assigned_to' AND j->>'assigned_to'=NEW.workspace_id::text THEN
   NEW:=jsonb_populate_record(NEW,jsonb_build_object('assigned_to',auth.uid()));
   j:=to_jsonb(NEW);
 END IF;
 IF TG_OP='UPDATE' THEN
   previous:=to_jsonb(OLD);
   IF j->>'workspace_id' IS DISTINCT FROM previous->>'workspace_id' OR j->>'owner_id' IS DISTINCT FROM previous->>'owner_id'
      OR j->>'person_id' IS DISTINCT FROM previous->>'person_id' OR j->>'created_by' IS DISTINCT FROM previous->>'created_by' THEN
     RAISE EXCEPTION 'Workspace, pessoa e autoria são imutáveis.' USING ERRCODE='42501';
   END IF;
 END IF;
 IF NEW.person_id IS NOT NULL THEN
   SELECT workspace_id INTO expected_workspace FROM public.people WHERE id=NEW.person_id;
   IF expected_workspace IS NULL OR (NEW.workspace_id IS NOT NULL AND NEW.workspace_id<>expected_workspace) THEN
     RAISE EXCEPTION 'Pessoa e registro devem pertencer ao mesmo workspace.' USING ERRCODE='23514';
   END IF;
   NEW.workspace_id:=expected_workspace;
 END IF;
 IF TG_OP='INSERT' AND j ? 'created_by' THEN NEW:=jsonb_populate_record(NEW,jsonb_build_object('created_by',auth.uid())); END IF;
 member:=(j->>'assigned_to')::uuid;
 IF member IS NOT NULL AND (TG_OP='INSERT' OR j->>'assigned_to' IS DISTINCT FROM previous->>'assigned_to')
   AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=member) THEN
   RAISE EXCEPTION 'Responsável não pertence ao workspace.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hr_child_links_guard() FROM PUBLIC,anon,authenticated;
