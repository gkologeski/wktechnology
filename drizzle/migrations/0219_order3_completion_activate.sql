-- Restrictive activation follows compatible server/UI publication.
DO $$DECLARE t text;p record;BEGIN
 FOREACH t IN ARRAY ARRAY['contract_approvals','contract_events'] LOOP
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);END LOOP;
 END LOOP;
END $$;
CREATE POLICY work_approval_view ON contract_approvals FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techcontracts.approvals','view',ARRAY[coalesce(approver_id,owner_id)]) AND work_record_access('techcontracts.contracts',contract_id,'view'));
CREATE POLICY work_contract_audit_view ON contract_events FOR SELECT TO authenticated USING(work_record_access('techcontracts.audit',id,'view'));
REVOKE INSERT,UPDATE,DELETE ON contract_approvals,contract_events FROM authenticated;
CREATE OR REPLACE FUNCTION public.contract_process_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN coalesce(NEW,OLD);END IF;
 IF TG_OP='INSERT' THEN NEW.public_token:=encode(extensions.gen_random_bytes(24),'hex');END IF;
 IF TG_OP='UPDATE' AND NEW.public_token IS DISTINCT FROM OLD.public_token THEN RAISE EXCEPTION 'Token público protegido.' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' AND NEW.status<>'draft' THEN RAISE EXCEPTION 'Novo contrato deve começar como rascunho.' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Use a ação de transição ou aprovação do contrato.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contract_process_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzzz_contract_process_guard BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contract_process_guard();
CREATE OR REPLACE FUNCTION public.contract_change_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE typ text;payload jsonb;related uuid;BEGIN
 IF NEW.parent_contract_id IS DISTINCT FROM OLD.parent_contract_id THEN typ:=CASE WHEN NEW.parent_contract_id IS NULL THEN 'parent_unlinked' ELSE 'parent_linked' END;payload:=jsonb_build_object('from',OLD.parent_contract_id,'to',NEW.parent_contract_id,'parent_contract_id',NEW.parent_contract_id,'previous_parent_contract_id',OLD.parent_contract_id,'child_contract_id',NEW.id,'child_title',NEW.title);related:=coalesce(NEW.parent_contract_id,OLD.parent_contract_id);
 ELSIF NEW.amendment_of_id IS DISTINCT FROM OLD.amendment_of_id THEN typ:=CASE WHEN NEW.amendment_of_id IS NULL THEN 'amendment_unlinked' ELSE 'amendment_linked' END;payload:=jsonb_build_object('from',OLD.amendment_of_id,'to',NEW.amendment_of_id,'amendment_of_id',NEW.amendment_of_id,'previous_parent_contract_id',OLD.amendment_of_id,'child_contract_id',NEW.id,'child_title',NEW.title);related:=coalesce(NEW.amendment_of_id,OLD.amendment_of_id);
 ELSIF NEW.document_kind IS DISTINCT FROM OLD.document_kind THEN typ:='document_kind_corrected';payload:=jsonb_build_object('from',OLD.document_kind,'to',NEW.document_kind,'title_before',OLD.title,'title_after',NEW.title);
 ELSIF NEW.role IS DISTINCT FROM OLD.role THEN typ:='role_recalculated';payload:=jsonb_build_object('from',OLD.role,'to',NEW.role,'title_before',OLD.title,'title_after',NEW.title);
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN typ:='status_changed';payload:=jsonb_build_object('from',OLD.status,'to',NEW.status);
 ELSE RETURN NEW;END IF;
 INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(NEW.workspace_id,NEW.id,auth.uid(),typ,payload);
 IF related IS NOT NULL THEN INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) SELECT NEW.workspace_id,related,auth.uid(),typ,payload WHERE EXISTS(SELECT 1 FROM contracts WHERE id=related AND workspace_id=NEW.workspace_id);END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contract_change_audit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER work_contract_change_audit AFTER UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION contract_change_audit();

-- Canonical structure policies replace only the obsolete scope policies.
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='services' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.services',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON services FOR SELECT TO authenticated USING(work_row_access('techservice.services',to_jsonb(services),'view'));
CREATE POLICY work_structure_insert ON services FOR INSERT TO authenticated WITH CHECK(work_row_access('techservice.services',to_jsonb(services),'create'));
CREATE POLICY work_structure_update ON services FOR UPDATE TO authenticated USING(work_row_access('techservice.services',to_jsonb(services),'update')) WITH CHECK(work_row_access('techservice.services',to_jsonb(services),'update'));
CREATE POLICY work_structure_delete ON services FOR DELETE TO authenticated USING(work_row_access('techservice.services',to_jsonb(services),'delete'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON services FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techservice.services');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='contract_templates' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.contract_templates',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON contract_templates FOR SELECT TO authenticated USING(work_row_access('techcontracts.contract_templates',to_jsonb(contract_templates),'view'));
CREATE POLICY work_structure_insert ON contract_templates FOR INSERT TO authenticated WITH CHECK(work_row_access('techcontracts.contract_templates',to_jsonb(contract_templates),'create'));
CREATE POLICY work_structure_update ON contract_templates FOR UPDATE TO authenticated USING(work_row_access('techcontracts.contract_templates',to_jsonb(contract_templates),'update')) WITH CHECK(work_row_access('techcontracts.contract_templates',to_jsonb(contract_templates),'update'));
CREATE POLICY work_structure_delete ON contract_templates FOR DELETE TO authenticated USING(work_row_access('techcontracts.contract_templates',to_jsonb(contract_templates),'delete'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON contract_templates FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techcontracts.contract_templates');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='contract_defaults' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.contract_defaults',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON contract_defaults FOR SELECT TO authenticated USING(work_row_access('techcontracts.defaults',to_jsonb(contract_defaults),'view'));
CREATE POLICY work_structure_insert ON contract_defaults FOR INSERT TO authenticated WITH CHECK(work_row_access('techcontracts.defaults',to_jsonb(contract_defaults),'manage'));
CREATE POLICY work_structure_update ON contract_defaults FOR UPDATE TO authenticated USING(work_row_access('techcontracts.defaults',to_jsonb(contract_defaults),'manage')) WITH CHECK(work_row_access('techcontracts.defaults',to_jsonb(contract_defaults),'manage'));
CREATE POLICY work_structure_delete ON contract_defaults FOR DELETE TO authenticated USING(work_row_access('techcontracts.defaults',to_jsonb(contract_defaults),'manage'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON contract_defaults FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techcontracts.defaults');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_spaces' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_spaces',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_spaces FOR SELECT TO authenticated USING(work_row_access('techprojects.spaces',to_jsonb(project_spaces),'view'));
CREATE POLICY work_structure_insert ON project_spaces FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.spaces',to_jsonb(project_spaces),'create'));
CREATE POLICY work_structure_update ON project_spaces FOR UPDATE TO authenticated USING(work_row_access('techprojects.spaces',to_jsonb(project_spaces),'update')) WITH CHECK(work_row_access('techprojects.spaces',to_jsonb(project_spaces),'update'));
CREATE POLICY work_structure_delete ON project_spaces FOR DELETE TO authenticated USING(work_row_access('techprojects.spaces',to_jsonb(project_spaces),'delete'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_spaces FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.spaces');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_folders' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_folders',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_folders FOR SELECT TO authenticated USING(work_row_access('techprojects.folders',to_jsonb(project_folders),'view'));
CREATE POLICY work_structure_insert ON project_folders FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.folders',to_jsonb(project_folders),'create'));
CREATE POLICY work_structure_update ON project_folders FOR UPDATE TO authenticated USING(work_row_access('techprojects.folders',to_jsonb(project_folders),'update')) WITH CHECK(work_row_access('techprojects.folders',to_jsonb(project_folders),'update'));
CREATE POLICY work_structure_delete ON project_folders FOR DELETE TO authenticated USING(work_row_access('techprojects.folders',to_jsonb(project_folders),'delete'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_folders FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.folders');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_lists' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_lists',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_lists FOR SELECT TO authenticated USING(work_row_access('techprojects.lists',to_jsonb(project_lists),'view'));
CREATE POLICY work_structure_insert ON project_lists FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.lists',to_jsonb(project_lists),'create'));
CREATE POLICY work_structure_update ON project_lists FOR UPDATE TO authenticated USING(work_row_access('techprojects.lists',to_jsonb(project_lists),'update')) WITH CHECK(work_row_access('techprojects.lists',to_jsonb(project_lists),'update'));
CREATE POLICY work_structure_delete ON project_lists FOR DELETE TO authenticated USING(work_row_access('techprojects.lists',to_jsonb(project_lists),'delete'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_lists FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.lists');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_list_templates' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_list_templates',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_list_templates FOR SELECT TO authenticated USING(work_row_access('techprojects.list_templates',to_jsonb(project_list_templates),'view'));
CREATE POLICY work_structure_insert ON project_list_templates FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.list_templates',to_jsonb(project_list_templates),'manage'));
CREATE POLICY work_structure_update ON project_list_templates FOR UPDATE TO authenticated USING(work_row_access('techprojects.list_templates',to_jsonb(project_list_templates),'manage')) WITH CHECK(work_row_access('techprojects.list_templates',to_jsonb(project_list_templates),'manage'));
CREATE POLICY work_structure_delete ON project_list_templates FOR DELETE TO authenticated USING(work_row_access('techprojects.list_templates',to_jsonb(project_list_templates),'manage'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_list_templates FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.list_templates');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_milestones' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_milestones',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_milestones FOR SELECT TO authenticated USING(work_row_access('techprojects.milestones',to_jsonb(project_milestones),'view'));
CREATE POLICY work_structure_insert ON project_milestones FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.milestones',to_jsonb(project_milestones),'create'));
CREATE POLICY work_structure_update ON project_milestones FOR UPDATE TO authenticated USING(work_row_access('techprojects.milestones',to_jsonb(project_milestones),'update')) WITH CHECK(work_row_access('techprojects.milestones',to_jsonb(project_milestones),'update'));
CREATE POLICY work_structure_delete ON project_milestones FOR DELETE TO authenticated USING(work_row_access('techprojects.milestones',to_jsonb(project_milestones),'delete'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_milestones FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.milestones');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_updates' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_updates',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_updates FOR SELECT TO authenticated USING(work_row_access('techprojects.project_updates',to_jsonb(project_updates),'view'));
CREATE POLICY work_structure_insert ON project_updates FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.project_updates',to_jsonb(project_updates),'create'));
CREATE POLICY work_structure_update ON project_updates FOR UPDATE TO authenticated USING(work_row_access('techprojects.project_updates',to_jsonb(project_updates),'update')) WITH CHECK(work_row_access('techprojects.project_updates',to_jsonb(project_updates),'update'));
CREATE POLICY work_structure_delete ON project_updates FOR DELETE TO authenticated USING(work_row_access('techprojects.project_updates',to_jsonb(project_updates),'delete'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_updates FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.project_updates');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_members' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_members',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_members FOR SELECT TO authenticated USING(work_row_access('techprojects.members',to_jsonb(project_members),'view'));
CREATE POLICY work_structure_insert ON project_members FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.members',to_jsonb(project_members),'manage'));
CREATE POLICY work_structure_update ON project_members FOR UPDATE TO authenticated USING(work_row_access('techprojects.members',to_jsonb(project_members),'manage')) WITH CHECK(work_row_access('techprojects.members',to_jsonb(project_members),'manage'));
CREATE POLICY work_structure_delete ON project_members FOR DELETE TO authenticated USING(work_row_access('techprojects.members',to_jsonb(project_members),'manage'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_members FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.members');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_task_statuses' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_task_statuses',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_task_statuses FOR SELECT TO authenticated USING(work_row_access('techprojects.statuses',to_jsonb(project_task_statuses),'view'));
CREATE POLICY work_structure_insert ON project_task_statuses FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.statuses',to_jsonb(project_task_statuses),'manage'));
CREATE POLICY work_structure_update ON project_task_statuses FOR UPDATE TO authenticated USING(work_row_access('techprojects.statuses',to_jsonb(project_task_statuses),'manage')) WITH CHECK(work_row_access('techprojects.statuses',to_jsonb(project_task_statuses),'manage'));
CREATE POLICY work_structure_delete ON project_task_statuses FOR DELETE TO authenticated USING(work_row_access('techprojects.statuses',to_jsonb(project_task_statuses),'manage'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_task_statuses FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.statuses');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_list_custom_fields' AND (permissive='PERMISSIVE' OR policyname IN('pspaces_perm_write','pfolders_perm_write','plists_perm_write','pmilestones_perm_write','pupdates_perm_write')) LOOP EXECUTE format('DROP POLICY %I ON public.project_list_custom_fields',p.policyname);END LOOP;END $$;
CREATE POLICY work_structure_select ON project_list_custom_fields FOR SELECT TO authenticated USING(work_row_access('techprojects.custom_fields',to_jsonb(project_list_custom_fields),'view'));
CREATE POLICY work_structure_insert ON project_list_custom_fields FOR INSERT TO authenticated WITH CHECK(work_row_access('techprojects.custom_fields',to_jsonb(project_list_custom_fields),'manage'));
CREATE POLICY work_structure_update ON project_list_custom_fields FOR UPDATE TO authenticated USING(work_row_access('techprojects.custom_fields',to_jsonb(project_list_custom_fields),'manage')) WITH CHECK(work_row_access('techprojects.custom_fields',to_jsonb(project_list_custom_fields),'manage'));
CREATE POLICY work_structure_delete ON project_list_custom_fields FOR DELETE TO authenticated USING(work_row_access('techprojects.custom_fields',to_jsonb(project_list_custom_fields),'manage'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_list_custom_fields FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.custom_fields');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_task_checklists' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.project_task_checklists',p.policyname);END LOOP;END $$;
CREATE POLICY work_child_select ON project_task_checklists FOR SELECT TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'view'));
CREATE POLICY work_child_insert ON project_task_checklists FOR INSERT TO authenticated WITH CHECK(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'update'));
CREATE POLICY work_child_update ON project_task_checklists FOR UPDATE TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'update')) WITH CHECK(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'update'));
CREATE POLICY work_child_delete ON project_task_checklists FOR DELETE TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'update'));
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_task_checklists FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.tasks');
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_task_dependencies' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.project_task_dependencies',p.policyname);END LOOP;END $$;
CREATE POLICY work_child_select ON project_task_dependencies FOR SELECT TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'view') AND work_record_access('techprojects.tasks',depends_on_task_id,'view') AND task_id<>depends_on_task_id);
CREATE POLICY work_child_insert ON project_task_dependencies FOR INSERT TO authenticated WITH CHECK(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'update') AND work_record_access('techprojects.tasks',depends_on_task_id,'view') AND task_id<>depends_on_task_id);
CREATE POLICY work_child_update ON project_task_dependencies FOR UPDATE TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'update') AND work_record_access('techprojects.tasks',depends_on_task_id,'view') AND task_id<>depends_on_task_id) WITH CHECK(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'update') AND work_record_access('techprojects.tasks',depends_on_task_id,'view') AND task_id<>depends_on_task_id);
CREATE POLICY work_child_delete ON project_task_dependencies FOR DELETE TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.tasks',task_id,'update') AND work_record_access('techprojects.tasks',depends_on_task_id,'view') AND task_id<>depends_on_task_id);
CREATE TRIGGER zzzz_work_structure_guard BEFORE INSERT OR UPDATE ON project_task_dependencies FOR EACH ROW EXECUTE FUNCTION work_structure_guard('techprojects.tasks');
-- All generic signature mutations go through an atomic action boundary. ATS offer RPCs
-- remain independent and retain their existing restrictive read policies and guards.
DO $$DECLARE t text;p record;BEGIN
 FOREACH t IN ARRAY ARRAY['esign_documents','esign_signers','esign_audit','esign_attachments'] LOOP
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);END LOOP;
 END LOOP;
END $$;
CREATE POLICY work_esign_view ON esign_documents FOR SELECT TO authenticated USING(work_row_access('techcontracts.esign',to_jsonb(esign_documents),'view'));
CREATE POLICY work_esign_signers_view ON esign_signers FOR SELECT TO authenticated USING(work_record_access('techcontracts.esign',document_id,'view') AND workspace_id=(work_access_context()->>'workspace')::uuid);
CREATE POLICY work_esign_audit_view ON esign_audit FOR SELECT TO authenticated USING(work_record_access('techcontracts.esign',document_id,'view') AND workspace_id=(work_access_context()->>'workspace')::uuid);
CREATE POLICY work_esign_attachments_view ON esign_attachments FOR SELECT TO authenticated USING(work_record_access('techcontracts.esign',document_id,'view') AND workspace_id=(work_access_context()->>'workspace')::uuid);
REVOKE INSERT,UPDATE,DELETE ON esign_documents,esign_signers,esign_audit,esign_attachments FROM authenticated;
REVOKE SELECT ON esign_signers FROM authenticated;
GRANT SELECT(id,document_id,owner_id,workspace_id,name,email,sign_order,status,signed_name,viewed_at,signed_at,declined_at,decline_reason,created_at) ON esign_signers TO authenticated;

-- Public RPC action boundaries; bodies retain their original locks and domain validation.
CREATE OR REPLACE FUNCTION public.project_time_policy_save(p_ws uuid, p_rules jsonb, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE k text; v_defaults jsonb := public.project_time_policy_defaults(); v_next int; v_rules jsonb := '{}'::jsonb;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.time_policy','manage');IF p_ws IS DISTINCT FROM (work_access_context()->>'workspace')::uuid THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE='42501';END IF; ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  PERFORM public.project_time_assert_actor(p_ws, true);

  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'object' THEN RAISE EXCEPTION 'Regras inválidas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_rules) LOOP
    IF NOT v_defaults ? k THEN RAISE EXCEPTION 'Regra desconhecida: %', k; END IF;
    IF jsonb_typeof(p_rules->k) <> jsonb_typeof(v_defaults->k) THEN RAISE EXCEPTION 'Tipo inválido para %', k; END IF;
    v_rules := v_rules || jsonb_build_object(k, p_rules->k);
  END LOOP;
  IF (v_rules ? 'max_daily_seconds') AND ((v_rules->>'max_daily_seconds')::numeric < 3600 OR (v_rules->>'max_daily_seconds')::numeric > 86400) THEN
    RAISE EXCEPTION 'Limite diário deve ficar entre 1 h e 24 h.';
  END IF;
  IF (v_rules ? 'allocation_max_pct') AND ((v_rules->>'allocation_max_pct')::numeric < 1 OR (v_rules->>'allocation_max_pct')::numeric > 300) THEN
    RAISE EXCEPTION 'Percentual máximo de alocação deve ficar entre 1 e 300.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_time_policy:' || p_ws::text));
  SELECT coalesce(max(version), 0) + 1 INTO v_next FROM public.project_time_policies WHERE workspace_id = p_ws;
  INSERT INTO public.project_time_policies (workspace_id, version, rules, note, created_by)
  VALUES (p_ws, v_next, v_defaults || v_rules, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  PERFORM public.project_time_log(p_ws, 'time_policy', NULL, 'saved', NULL, NULL, p_note,
    jsonb_build_object('version', v_next, 'rules', v_defaults || v_rules));
  RETURN public.project_time_policy_get(p_ws);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_time_approver_set(p_project uuid, p_user uuid, p_role text, p_subject uuid, p_from date, p_to date, p_reason text, p_delegate_of uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_id uuid; o record; v_osubj uuid;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.approvers','manage');IF NOT work_record_access('techprojects.projects',p_project,'view') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF; ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = p_project;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(v_ws, true);

  IF p_role NOT IN ('approver','operational_manager') THEN RAISE EXCEPTION 'Papel inválido.'; END IF;
  IF NOT public.is_workspace_member(v_ws, p_user) THEN RAISE EXCEPTION 'A pessoa precisa ser membro ativo do workspace.'; END IF;
  IF p_subject IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_ws AND user_id = p_subject) THEN
    RAISE EXCEPTION 'Profissional fora do workspace.';
  END IF;
  IF p_subject IS NOT NULL AND p_subject = p_user THEN RAISE EXCEPTION 'Ninguém é aprovador das próprias horas.'; END IF;
  IF p_delegate_of IS NOT NULL THEN
    SELECT * INTO o FROM public.project_time_approvers WHERE id = p_delegate_of AND project_id = p_project AND revoked_at IS NULL;
    IF o.id IS NULL THEN RAISE EXCEPTION 'Aprovação original não encontrada ou revogada.'; END IF;
    IF o.user_id = p_user THEN RAISE EXCEPTION 'Delegação para a mesma pessoa.'; END IF;
    IF p_to IS NULL THEN RAISE EXCEPTION 'Delegação exige data final.'; END IF;
    IF length(btrim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo da delegação.'; END IF;
    v_osubj := o.subject_user_id;
  END IF;
  INSERT INTO public.project_time_approvers (workspace_id, project_id, role, user_id, subject_user_id, delegate_of,
         valid_from, valid_to, reason, created_by)
  VALUES (v_ws, p_project, p_role, p_user,
          coalesce(p_subject, v_osubj), p_delegate_of,
          coalesce(p_from, current_date), p_to, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.project_time_log(v_ws, 'approver', v_id, CASE WHEN p_delegate_of IS NULL THEN 'assigned' ELSE 'delegated' END,
    p_user, p_project, p_reason, jsonb_build_object('role', p_role, 'subject_user_id', p_subject, 'from', p_from, 'to', p_to, 'delegate_of', p_delegate_of));
  RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_time_approver_revoke(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a record;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.approvers','manage'); ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  SELECT * INTO a FROM public.project_time_approvers WHERE id = p_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(a.workspace_id, true);

  IF a.revoked_at IS NOT NULL THEN RETURN; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
  UPDATE public.project_time_approvers SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = btrim(p_reason) WHERE id = p_id;
  PERFORM public.project_time_log(a.workspace_id, 'approver', p_id, 'revoked', a.user_id, a.project_id, p_reason, '{}'::jsonb);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_delivery_template_save(p_ws uuid, p_template uuid, p_name text, p_kind text, p_description text, p_active boolean, p_service_ids uuid[], p_definition jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid := p_template; v_last record; v_ver int; v_bad int;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.delivery_templates','manage');IF p_ws IS DISTINCT FROM (work_access_context()->>'workspace')::uuid THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE='42501';END IF; ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  PERFORM public.project_time_assert_actor(p_ws, true);

  PERFORM public.project_delivery_template_validate_definition(p_definition);
  SELECT count(*) INTO v_bad FROM unnest(coalesce(p_service_ids, '{}')) sid
   WHERE NOT EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.id = sid AND s.workspace_id = p_ws AND s.active);
  IF v_bad > 0 THEN RAISE EXCEPTION 'Use apenas serviços ativos do catálogo deste workspace.'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.project_delivery_templates (workspace_id, name, delivery_kind, description, active, created_by)
    VALUES (p_ws, btrim(p_name), p_kind, p_description, coalesce(p_active, true), auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.project_delivery_templates SET name = btrim(p_name), delivery_kind = p_kind,
           description = p_description, active = coalesce(p_active, active), updated_at = now()
     WHERE id = v_id AND workspace_id = p_ws;
    IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado neste workspace.'; END IF;
  END IF;
  SELECT version, definition INTO v_last FROM public.project_delivery_template_versions
   WHERE template_id = v_id ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF v_last.version IS NULL OR v_last.definition IS DISTINCT FROM p_definition THEN
    v_ver := coalesce(v_last.version, 0) + 1;
    INSERT INTO public.project_delivery_template_versions (workspace_id, template_id, version, definition, created_by)
    VALUES (p_ws, v_id, v_ver, p_definition, auth.uid());
  ELSE
    v_ver := v_last.version;
  END IF;
  DELETE FROM public.project_delivery_template_services WHERE workspace_id = p_ws AND template_id = v_id
     AND NOT (service_catalog_id = ANY (coalesce(p_service_ids, '{}')));
  INSERT INTO public.project_delivery_template_services (workspace_id, template_id, service_catalog_id)
  SELECT p_ws, v_id, sid FROM unnest(coalesce(p_service_ids, '{}')) sid
  ON CONFLICT (workspace_id, service_catalog_id) DO UPDATE SET template_id = EXCLUDED.template_id;
  PERFORM public.project_time_log(p_ws, 'delivery_template', v_id, 'saved', NULL, NULL, NULL,
    jsonb_build_object('version', v_ver, 'services', to_jsonb(coalesce(p_service_ids, '{}'))));
  RETURN jsonb_build_object('template_id', v_id, 'version', v_ver);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_delivery_template_suggest(p_project uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record; v jsonb;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.delivery_templates','view');IF NOT work_record_access('techprojects.projects',p_project,'view') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF; ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  IF NOT public.project_visible_to_current_user(p_project) THEN RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = '42501'; END IF;
  SELECT pr.id, pr.workspace_id, pr.delivery_template_version_id, pr.delivery_template_applied_at, li.service_catalog_id,
         (SELECT count(*) FROM public.project_time_entries e WHERE e.project_id = pr.id AND e.source = 'import') AS imported_entries,
         (SELECT count(*) FROM public.project_tasks t WHERE t.project_id = pr.id) AS tasks
    INTO p FROM public.projects pr
    LEFT JOIN public.deal_line_items li ON li.id = pr.source_line_item_id AND li.workspace_id = pr.workspace_id
   WHERE pr.id = p_project;
  SELECT jsonb_build_object('template_id', t.id, 'name', t.name, 'kind', t.delivery_kind,
           'version_id', v2.id, 'version', v2.version, 'definition', v2.definition)
    INTO v
    FROM public.project_delivery_template_services s
    JOIN public.project_delivery_templates t ON t.id = s.template_id AND t.active
    JOIN LATERAL (SELECT * FROM public.project_delivery_template_versions x WHERE x.template_id = t.id ORDER BY version DESC LIMIT 1) v2 ON true
   WHERE s.workspace_id = p.workspace_id AND s.service_catalog_id = p.service_catalog_id;
  RETURN jsonb_build_object('applied_version_id', p.delivery_template_version_id, 'applied_at', p.delivery_template_applied_at,
    'service_catalog_id', p.service_catalog_id, 'suggestion', v,
    'imported_entries', p.imported_entries, 'tasks', p.tasks);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_delivery_template_apply(p_project uuid, p_version uuid, p_confirm_imported boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record; v record; e jsonb; v_ms int := 0; v_tk int := 0; v_n int; v_prefix text; v_base date;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.delivery_templates','manage');IF NOT work_record_access('techprojects.projects',p_project,'update') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF; ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  SELECT id, workspace_id, delivery_template_version_id, starts_at INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(p.workspace_id, true);
  IF NOT public.project_editable_by_current_user(p_project) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este projeto.' USING ERRCODE = '42501';
  END IF;
  SELECT tv.id, tv.version, tv.definition, t.name, t.delivery_kind, t.active INTO v
    FROM public.project_delivery_template_versions tv JOIN public.project_delivery_templates t ON t.id = tv.template_id
   WHERE tv.id = p_version AND tv.workspace_id = p.workspace_id;
  IF v.id IS NULL OR NOT v.active THEN RAISE EXCEPTION 'Modelo inexistente ou inativo neste workspace.'; END IF;
  IF p.delivery_template_version_id IS NOT NULL THEN
    IF p.delivery_template_version_id = p_version THEN RETURN jsonb_build_object('already_applied', true, 'milestones', 0, 'tasks', 0); END IF;
    RAISE EXCEPTION 'Este projeto já tem outro modelo aplicado; a troca não é automática.';
  END IF;
  IF NOT coalesce(p_confirm_imported, false) AND EXISTS (SELECT 1 FROM public.project_time_entries WHERE project_id = p_project AND source = 'import') THEN
    RAISE EXCEPTION 'Projeto com horas importadas: confirme explicitamente para aplicar o modelo.' USING ERRCODE = 'P0001';
  END IF;
  v_prefix := 'tpl:' || v.id::text || ':';
  v_base := coalesce(p.starts_at, current_date);
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(v.definition->'milestones', '[]'::jsonb)) LOOP
    INSERT INTO public.project_milestones (workspace_id, project_id, name, description, due_at, status, sort_order, template_item_key)
    VALUES (p.workspace_id, p_project, btrim(e->>'name'), e->>'description',
            CASE WHEN (e->>'offset_days') ~ '^\d{1,4}$' THEN v_base + (e->>'offset_days')::int END,
            'pending', coalesce((e->>'order')::int, v_ms), v_prefix || (e->>'key'))
    ON CONFLICT (project_id, template_item_key) WHERE template_item_key IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ms := v_ms + v_n;
  END LOOP;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(v.definition->'tasks', '[]'::jsonb)) LOOP
    INSERT INTO public.project_tasks (workspace_id, project_id, title, description, status, estimated_hours, milestone_id, sort_order, template_item_key)
    VALUES (p.workspace_id, p_project, btrim(e->>'title'), e->>'description', 'todo',
            CASE WHEN (e->>'estimated_hours') ~ '^\d+(\.\d+)?$' THEN (e->>'estimated_hours')::numeric END,
            (SELECT m.id FROM public.project_milestones m WHERE m.project_id = p_project AND m.template_item_key = v_prefix || (e->>'milestone_key')),
            coalesce((e->>'order')::int, v_tk), v_prefix || (e->>'key'))
    ON CONFLICT (project_id, template_item_key) WHERE template_item_key IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_tk := v_tk + v_n;
  END LOOP;
  UPDATE public.projects SET delivery_template_version_id = p_version, delivery_template_applied_at = now(),
         delivery_template_applied_by = auth.uid(),
         client_acceptance_required = client_acceptance_required OR coalesce((v.definition->>'client_acceptance')::boolean, false)
   WHERE id = p_project;
  PERFORM public.project_time_log(p.workspace_id, 'project', p_project, 'delivery_template_applied', NULL, p_project, NULL,
    jsonb_build_object('version_id', p_version, 'template', v.name, 'version', v.version, 'milestones', v_ms, 'tasks', v_tk));
  RETURN jsonb_build_object('already_applied', false, 'milestones', v_ms, 'tasks', v_tk);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_ops_status(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_jobs jsonb; v_queues jsonb;
  v_expected text[] := ARRAY['deal-delivery-jobs','webhook-dispatch-tick','clockify-import-tick','project-alerts-tick',
                             'services-billing-tick','recurrences-tick','dunning-tick','cleanup-cron-logs-daily'];
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.operations','view');IF p_ws IS DISTINCT FROM (work_access_context()->>'workspace')::uuid THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE='42501';END IF; ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  IF v_uid IS NULL OR NOT (p_ws IN (SELECT public.current_user_workspaces())) OR NOT public.is_active_workspace_admin(p_ws, v_uid) THEN
    RAISE EXCEPTION 'Somente administradores ativos do workspace veem a operação.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'name', n.name, 'scheduled', j.jobid IS NOT NULL, 'active', coalesce(j.active, false), 'schedule', j.schedule,
           'last_run', (SELECT jsonb_build_object('status', d.status, 'started_at', d.start_time, 'finished_at', d.end_time)
                          FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1),
           'last_log', (SELECT jsonb_build_object('status', l.status, 'started_at', l.started_at, 'duration_ms', l.duration_ms)
                          FROM public.cron_run_logs l WHERE l.job_name = n.name ORDER BY l.started_at DESC LIMIT 1))
         ORDER BY n.ord), '[]'::jsonb)
    INTO v_jobs
    FROM unnest(v_expected) WITH ORDINALITY n(name, ord) LEFT JOIN cron.job j ON j.jobname = n.name;
  v_queues := jsonb_build_object(
    'deal_delivery', (SELECT jsonb_build_object('by_status', coalesce(jsonb_object_agg(s, c), '{}'::jsonb),
        'oldest_pending', (SELECT min(created_at) FROM public.deal_delivery_jobs WHERE workspace_id = p_ws AND status = 'pending'),
        'expired_leases', (SELECT count(*) FROM public.deal_delivery_jobs WHERE workspace_id = p_ws AND status = 'running' AND lease_until < now()))
      FROM (SELECT status s, count(*) c FROM public.deal_delivery_jobs WHERE workspace_id = p_ws GROUP BY status) x),
    'webhooks', (SELECT jsonb_build_object('by_status', coalesce(jsonb_object_agg(s, c), '{}'::jsonb))
      FROM (SELECT status::text s, count(*) c FROM public.webhook_deliveries WHERE workspace_id = p_ws GROUP BY status) x),
    'imports', (SELECT coalesce(jsonb_agg(jsonb_build_object('status', r.status, 'started_at', r.started_at, 'finished_at', r.finished_at) ORDER BY r.started_at DESC), '[]'::jsonb)
      FROM (SELECT status, started_at, finished_at FROM public.clockify_import_runs WHERE workspace_id = p_ws ORDER BY started_at DESC NULLS LAST LIMIT 5) r),
    'alerts', (SELECT jsonb_build_object('last_run', max(started_at), 'runs', count(*)) FROM public.project_alert_runs WHERE workspace_id = p_ws));
  RETURN jsonb_build_object('generated_at', now(), 'jobs', v_jobs, 'queues', v_queues);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_risk_rules_get(p_project uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid := public.project_dash_ws();
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.risk_rules','view');IF p_project IS NOT NULL AND NOT work_record_access('techprojects.projects',p_project,'view') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF; ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  PERFORM public.project_time_assert_actor(v_ws, false);
  IF p_project IS NOT NULL AND NOT public.project_visible_to_current_user(p_project) THEN
    RAISE EXCEPTION 'Projeto sem acesso.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'defaults', public.project_alert_default_rules(),
    'effective', public.project_alert_rules_effective(v_ws, p_project),
    'workspace_version', (SELECT to_jsonb(v) - 'workspace_id' FROM public.project_risk_rule_versions v
                           WHERE v.workspace_id = v_ws AND v.project_id IS NULL ORDER BY v.version DESC LIMIT 1),
    'project_version', (SELECT to_jsonb(v) - 'workspace_id' FROM public.project_risk_rule_versions v
                         WHERE v.workspace_id = v_ws AND p_project IS NOT NULL AND v.project_id = p_project ORDER BY v.version DESC LIMIT 1),
    'can_manage', public.is_active_workspace_admin(v_ws, auth.uid())
                  OR public.user_has_permission(auth.uid(), v_ws, 'techprojects.risk_rules.manage.workspace'));
END $function$
;
CREATE OR REPLACE FUNCTION public.project_risk_rules_save(p_project uuid, p_rules jsonb, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid := public.project_dash_ws(); v_def jsonb := public.project_alert_default_rules(); v_out jsonb := '{}'::jsonb;
  k text; r jsonb; v_ver int; v_id uuid; n numeric;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.risk_rules','manage');IF p_project IS NOT NULL AND NOT work_record_access('techprojects.projects',p_project,'view') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF; ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  PERFORM public.project_time_assert_actor(v_ws, true);
  IF NOT (public.is_active_workspace_admin(v_ws, auth.uid())
          OR public.user_has_permission(auth.uid(), v_ws, 'techprojects.risk_rules.manage.workspace')) THEN
    RAISE EXCEPTION 'Sem permissão para configurar regras de risco.' USING ERRCODE = '42501';
  END IF;
  IF p_project IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project AND p.workspace_id = v_ws) THEN
    RAISE EXCEPTION 'Projeto fora do workspace.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Descreva o motivo da mudança (mínimo 5 caracteres).' USING ERRCODE = '22023'; END IF;
  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'object' THEN RAISE EXCEPTION 'Regras inválidas.' USING ERRCODE = '22023'; END IF;
  FOR k, r IN SELECT * FROM jsonb_each(p_rules) LOOP
    IF NOT v_def ? k THEN RAISE EXCEPTION 'Regra desconhecida: %.', k USING ERRCODE = '22023'; END IF;
    IF jsonb_typeof(r) <> 'object' THEN RAISE EXCEPTION 'Regra % inválida.', k USING ERRCODE = '22023'; END IF;
    r := (v_def->k) || r;
    IF k = '_schedule' THEN
      -- Avaliação automática diária: só no nível do workspace; desligada por padrão.
      IF p_project IS NOT NULL THEN RAISE EXCEPTION 'A avaliação automática é configurada só para o workspace.' USING ERRCODE = '22023'; END IF;
      IF jsonb_typeof(r->'enabled') <> 'boolean' OR coalesce(r->>'tz', '') !~ '^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$'
         OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = r->>'tz') THEN
        RAISE EXCEPTION 'Avaliação automática: informe ativa (sim/não) e um fuso válido.' USING ERRCODE = '22023';
      END IF;
      v_out := v_out || jsonb_build_object(k, jsonb_build_object('enabled', r->'enabled', 'tz', r->>'tz'));
      CONTINUE;
    END IF;
    IF jsonb_typeof(r->'enabled') <> 'boolean' THEN RAISE EXCEPTION 'Regra %: "ativa" precisa ser verdadeiro ou falso.', k USING ERRCODE = '22023'; END IF;
    IF NOT (r->>'severity') IN ('low','medium','high') THEN RAISE EXCEPTION 'Regra %: severidade inválida.', k USING ERRCODE = '22023'; END IF;
    FOR n IN SELECT (r->>x)::numeric FROM unnest(ARRAY['warn_pct','critical_pct','horizon_days','days','grace_days']) x WHERE r ? x LOOP
      IF n IS NULL OR n < 0 OR n > 1000 OR n <> trunc(n) THEN RAISE EXCEPTION 'Regra %: limite inválido.', k USING ERRCODE = '22023'; END IF;
    END LOOP;
    IF k = 'hours_budget' AND ((r->>'warn_pct')::int < 1 OR (r->>'critical_pct')::int < (r->>'warn_pct')::int) THEN
      RAISE EXCEPTION 'Orçamento de horas: o limite crítico precisa ser maior ou igual ao de aviso.' USING ERRCODE = '22023';
    END IF;
    IF k = 'capacity_exceeded' AND ((r->>'horizon_days')::int < 1 OR (r->>'horizon_days')::int > 180) THEN
      RAISE EXCEPTION 'Capacidade: horizonte entre 1 e 180 dias.' USING ERRCODE = '22023';
    END IF;
    IF k = 'hours_unreviewed' AND ((r->>'days')::int < 1 OR (r->>'days')::int > 90) THEN
      RAISE EXCEPTION 'Horas sem revisão: entre 1 e 90 dias.' USING ERRCODE = '22023';
    END IF;
    IF k = 'deal_won_no_project' AND (r->>'grace_days')::int > 60 THEN
      RAISE EXCEPTION 'Ganho sem projeto: tolerância máxima de 60 dias.' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object(k, r);
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended('project_risk_rules:' || v_ws || ':' || coalesce(p_project::text, '-'), 0));
  SELECT coalesce(max(v.version), 0) + 1 INTO v_ver FROM public.project_risk_rule_versions v
   WHERE v.workspace_id = v_ws AND v.project_id IS NOT DISTINCT FROM p_project;
  INSERT INTO public.project_risk_rule_versions (workspace_id, project_id, version, rules, note, created_by)
  VALUES (v_ws, p_project, v_ver, v_out, btrim(p_note), auth.uid()) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'version', v_ver);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_alert_refresh(p_tz text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid := public.project_dash_ws();
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.alerts','manage'); ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  PERFORM public.project_time_assert_actor(v_ws, true);
  IF NOT (public.is_active_workspace_admin(v_ws, auth.uid())
          OR public.user_has_permission(auth.uid(), v_ws, 'techprojects.alerts.manage.workspace')) THEN
    RAISE EXCEPTION 'Sem permissão para reavaliar alertas.' USING ERRCODE = '42501';
  END IF;
  RETURN public.project_alert_evaluate(v_ws, p_tz, auth.uid(), 'manual');
END $function$
;
CREATE OR REPLACE FUNCTION public.project_alert_act(p_alert uuid, p_action text, p_note text, p_until date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a record; v_new text; v_today date;
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize('techprojects.alerts','manage'); ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  SELECT * INTO a FROM public.project_alerts WHERE id = p_alert FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alerta não encontrado.' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.project_time_assert_actor(a.workspace_id, true);
  IF NOT public.project_alert_can_act(p_alert) THEN RAISE EXCEPTION 'Sem permissão para tratar este alerta.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Descreva a justificativa (mínimo 5 caracteres).' USING ERRCODE = '22023'; END IF;
  v_today := current_date;
  CASE p_action
    WHEN 'ack' THEN
      IF a.status NOT IN ('open','snoozed') THEN RAISE EXCEPTION 'Só alertas abertos ou adiados podem ser reconhecidos.' USING ERRCODE = '22023'; END IF;
      v_new := 'acknowledged';
    WHEN 'snooze' THEN
      IF a.status = 'resolved' THEN RAISE EXCEPTION 'Alerta resolvido não pode ser adiado.' USING ERRCODE = '22023'; END IF;
      IF p_until IS NULL OR p_until <= v_today OR p_until > v_today + 90 THEN
        RAISE EXCEPTION 'Adie para uma data entre amanhã e 90 dias.' USING ERRCODE = '22023';
      END IF;
      v_new := 'snoozed';
    WHEN 'resolve' THEN
      IF a.status = 'resolved' THEN RAISE EXCEPTION 'Alerta já resolvido.' USING ERRCODE = '22023'; END IF;
      v_new := 'resolved';
    WHEN 'reopen' THEN
      IF a.status = 'open' THEN RAISE EXCEPTION 'Alerta já está aberto.' USING ERRCODE = '22023'; END IF;
      v_new := 'open';
    ELSE RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023';
  END CASE;
  UPDATE public.project_alerts SET status = v_new, updated_at = now(),
         snoozed_until = CASE WHEN v_new = 'snoozed' THEN p_until ELSE NULL END,
         resolution = CASE WHEN v_new = 'resolved' THEN 'manual' ELSE NULL END,
         resolved_at = CASE WHEN v_new = 'resolved' THEN now() ELSE NULL END
   WHERE id = p_alert;
  INSERT INTO public.project_alert_events (workspace_id, alert_id, kind, actor, note, before, after)
  VALUES (a.workspace_id, p_alert,
          CASE p_action WHEN 'ack' THEN 'acknowledged' WHEN 'snooze' THEN 'snoozed' WHEN 'resolve' THEN 'resolved' ELSE 'reopened' END,
          auth.uid(), btrim(p_note), jsonb_build_object('status', a.status, 'snoozed_until', a.snoozed_until),
          jsonb_build_object('status', v_new, 'snoozed_until', CASE WHEN v_new = 'snoozed' THEN p_until END));
  RETURN jsonb_build_object('id', p_alert, 'status', v_new);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_recon_assert_admin(p_ws uuid, p_write boolean)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_ws IS NULL THEN RAISE EXCEPTION 'Workspace obrigatório.' USING ERRCODE = '22023'; END IF;
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), '') = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN RETURN; END IF;
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_workspace_admin(p_ws, auth.uid())
     OR NOT EXISTS (SELECT 1 FROM public.current_user_workspaces() AS w(id) WHERE w.id = p_ws) THEN
    RAISE EXCEPTION 'Apenas administradores ativos do workspace ativo.' USING ERRCODE = '42501';
  END IF;
  IF p_write AND public.is_read_only_view() THEN
    RAISE EXCEPTION 'O modo Ver como é somente leitura.' USING ERRCODE = '42501';
  END IF;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_time_policy_resolve(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v record;
BEGIN
 IF auth.uid() IS NOT NULL THEN IF p_ws IS DISTINCT FROM (work_access_context()->>'workspace')::uuid OR NOT (coalesce((work_time_context()->'time_grants') ?| ARRAY['view.own','view.team','view.workspace','create.own','create.team','create.workspace','update.own','update.team','update.workspace'],false) OR EXISTS(SELECT 1 FROM user_effective_permissions(auth.uid(),p_ws)k WHERE k ~ '^techprojects\.time_policy\.(view|manage)\.workspace$')) THEN RAISE EXCEPTION 'Política operacional indisponível.' USING ERRCODE='42501';END IF;ELSIF coalesce(auth.role(),'')<>'service_role' AND session_user NOT IN('postgres','supabase_admin') THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_workspace_member(p_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso à política deste workspace.' USING ERRCODE = '42501';
  END IF;
  SELECT version, rules, created_at INTO v FROM public.project_time_policies
   WHERE workspace_id = p_ws ORDER BY version DESC LIMIT 1;
  RETURN public.project_time_policy_defaults() || coalesce(v.rules, '{}'::jsonb)
    || jsonb_build_object('version', coalesce(v.version, 0), 'saved_at', v.created_at);
END $function$
;
REVOKE ALL ON FUNCTION project_time_policy_resolve(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION project_time_policy_resolve(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.project_time_policy_save(p_ws uuid, p_rules jsonb, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE k text; v_defaults jsonb := public.project_time_policy_defaults(); v_next int; v_rules jsonb := '{}'::jsonb;
BEGIN PERFORM work_area_authorize('techprojects.time_policy','manage');
  PERFORM public.project_time_assert_actor(p_ws, true);

  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'object' THEN RAISE EXCEPTION 'Regras inválidas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_rules) LOOP
    IF NOT v_defaults ? k THEN RAISE EXCEPTION 'Regra desconhecida: %', k; END IF;
    IF jsonb_typeof(p_rules->k) <> jsonb_typeof(v_defaults->k) THEN RAISE EXCEPTION 'Tipo inválido para %', k; END IF;
    v_rules := v_rules || jsonb_build_object(k, p_rules->k);
  END LOOP;
  IF (v_rules ? 'max_daily_seconds') AND ((v_rules->>'max_daily_seconds')::numeric < 3600 OR (v_rules->>'max_daily_seconds')::numeric > 86400) THEN
    RAISE EXCEPTION 'Limite diário deve ficar entre 1 h e 24 h.';
  END IF;
  IF (v_rules ? 'allocation_max_pct') AND ((v_rules->>'allocation_max_pct')::numeric < 1 OR (v_rules->>'allocation_max_pct')::numeric > 300) THEN
    RAISE EXCEPTION 'Percentual máximo de alocação deve ficar entre 1 e 300.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_time_policy:' || p_ws::text));
  SELECT coalesce(max(version), 0) + 1 INTO v_next FROM public.project_time_policies WHERE workspace_id = p_ws;
  INSERT INTO public.project_time_policies (workspace_id, version, rules, note, created_by)
  VALUES (p_ws, v_next, v_defaults || v_rules, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  PERFORM public.project_time_log(p_ws, 'time_policy', NULL, 'saved', NULL, NULL, p_note,
    jsonb_build_object('version', v_next, 'rules', v_defaults || v_rules));
  RETURN public.project_time_policy_resolve(p_ws);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_time_trackable_projects(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_pol jsonb;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, false);
  v_pol := public.project_time_policy_resolve(p_ws);
  RETURN jsonb_build_object(
    'policy', v_pol,
    'projects', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'status', p.status,
               'favorite', EXISTS (SELECT 1 FROM public.project_time_favorites f WHERE f.user_id = v_uid AND f.project_id = p.id),
               'last_used', (SELECT max(e.entry_date) FROM public.project_time_entries e WHERE e.user_id = v_uid AND e.project_id = p.id),
               'billable_default', NOT EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p.id AND m.user_id = v_uid AND m.bill_rate_hour = 0))
             ORDER BY p.name)
        FROM public.projects p
       WHERE p.workspace_id = p_ws AND p.status IN ('planning','active')
         AND (public.project_time_can_track(v_uid, p.id, current_date)
              OR NOT coalesce((v_pol->>'track_requires_link')::boolean, true))), '[]'::jsonb),
    'person_linked', EXISTS (SELECT 1 FROM public.people pe WHERE pe.profile_id = v_uid AND (pe.workspace_id = p_ws OR pe.owner_id = p_ws)));
END $function$
;
CREATE OR REPLACE FUNCTION public.project_timer_start(p_ws uuid, p_project uuid, p_task uuid, p_description text, p_billable boolean, p_tz text, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_pol jsonb;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, true);
  IF p_request_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid AND client_request_id = p_request_id;
    IF v_id IS NOT NULL THEN RETURN public.project_timer_json(v_id) || jsonb_build_object('idempotent', true); END IF;
  END IF;
  SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid AND state IN ('running','paused');
  IF v_id IS NOT NULL THEN RETURN public.project_timer_json(v_id) || jsonb_build_object('conflict', true); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
  IF p_task IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE id = p_task AND project_id = p_project) THEN
    RAISE EXCEPTION 'Atividade não pertence ao projeto.';
  END IF;
  IF NOT public.project_time_tz_valid(p_tz) OR p_tz IS NULL THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;
  v_pol := public.project_time_policy_resolve(p_ws);
  IF coalesce((v_pol->>'track_requires_link')::boolean, true)
     AND NOT public.project_time_can_track(v_uid, p_project, (now() AT TIME ZONE p_tz)::date) THEN
    RAISE EXCEPTION 'Profissional sem vínculo para apontar neste projeto (membro liberado ou alocação vigente).' USING ERRCODE = '42501';
  END IF;
  BEGIN
    INSERT INTO public.project_timer_sessions (workspace_id, user_id, project_id, task_id, description, billable, timezone,
           state, client_request_id, policy_version)
    VALUES (p_ws, v_uid, p_project, p_task, p_description, coalesce(p_billable, true), p_tz, 'running', p_request_id,
            (v_pol->>'version')::int)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid
       AND (state IN ('running','paused') OR client_request_id = p_request_id) ORDER BY created_at DESC LIMIT 1;
    RETURN public.project_timer_json(v_id) || jsonb_build_object('conflict', true);
  END;
  INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at)
  VALUES (p_ws, v_id, 'work', p_task, now());
  RETURN public.project_timer_json(v_id);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_timesheet_scan(p_ws uuid, p_user uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pol jsonb := public.project_time_policy_resolve(p_ws); v jsonb;
BEGIN
  WITH e AS (
    SELECT t.id, t.revision, t.project_id, t.entry_date, t.review_flags, t.start_time, t.end_time, t.entry_kind,
           coalesce(t.duration_seconds, t.duration_minutes * 60, 0)::bigint AS secs, pr.name AS project_name, tk.title AS task_title
      FROM public.project_time_entries t JOIN public.projects pr ON pr.id = t.project_id
      LEFT JOIN public.project_tasks tk ON tk.id = t.task_id
     WHERE t.workspace_id = p_ws AND t.user_id = p_user AND t.entry_date BETWEEN p_from AND p_to
       AND t.status IN ('draft','rejected') AND t.period_closing_id IS NULL),
  blockers AS (
    SELECT 'running_timer' AS code, 'Há um cronômetro em andamento; finalize antes de enviar.' AS message, NULL::uuid AS project_id, 1::bigint AS n
      FROM public.project_timer_sessions s WHERE s.workspace_id = p_ws AND s.user_id = p_user AND s.state IN ('running','paused')
       AND (s.started_at AT TIME ZONE s.timezone)::date <= p_to
    UNION ALL
    SELECT 'overlap', 'Apontamentos com sobreposição de horário precisam ser corrigidos.', NULL, count(*)
      FROM e WHERE coalesce((v_pol->>'submit_blocks_on_overlap')::boolean, true) AND 'overlap' = ANY (coalesce(e.review_flags, '{}')) HAVING count(*) > 0
    UNION ALL
    SELECT 'no_approver', 'Projeto "' || e.project_name || '" sem líder aprovador configurado.', e.project_id, count(*)
      FROM e WHERE coalesce((v_pol->>'submit_requires_approver')::boolean, true) AND NOT public.project_time_has_approver(e.project_id, p_user)
     GROUP BY e.project_id, e.project_name),
  warnings AS (
    SELECT 'daily_excess' AS code, 'Dias acima do limite diário da política; o aprovador verá o alerta.' AS message, count(*) AS n
      FROM e WHERE 'daily_excess' = ANY (coalesce(e.review_flags, '{}')) HAVING count(*) > 0
    UNION ALL
    SELECT 'unpositioned', 'Lançamentos só por duração: sobreposição não é verificável.', count(*)
      FROM e WHERE e.entry_kind = 'duration' HAVING count(*) > 0
    UNION ALL
    SELECT 'dst_ambiguous', 'Trechos na troca de horário de verão sem horário local exibível (UTC preservado).', count(*)
      FROM e WHERE 'dst_ambiguous' = ANY (coalesce(e.review_flags, '{}')) HAVING count(*) > 0)
  SELECT jsonb_build_object(
    'entries', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'revision', revision, 'project_id', project_id, 'project_name', project_name,
                 'task_title', task_title, 'entry_date', entry_date, 'seconds', secs, 'review_flags', review_flags) ORDER BY entry_date, start_time NULLS LAST) FROM e), '[]'::jsonb),
    'hash', coalesce((SELECT md5(string_agg(id::text || ':' || revision, ',' ORDER BY id)) FROM e), md5('')),
    'entry_count', (SELECT count(*) FROM e),
    'total_seconds', coalesce((SELECT sum(secs) FROM e), 0),
    'blockers', coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM blockers b), '[]'::jsonb),
    'warnings', coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM warnings w), '[]'::jsonb),
    'policy_version', (v_pol->>'version')::int) INTO v;
  RETURN v;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_period_close_check(p_ws uuid, p_scope text, p_project uuid, p_user uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pol jsonb := public.project_time_policy_resolve(p_ws); v jsonb;
BEGIN
  WITH e AS (SELECT * FROM public.project_period_scope_entries(p_ws, p_scope, p_project, p_user, p_from, p_to)),
  acc AS (SELECT (p_scope = 'project' AND coalesce((SELECT client_acceptance_required FROM public.projects WHERE id = p_project), false)
                   AND coalesce((v_pol->>'closing_requires_client_acceptance')::boolean, true)) AS req)
  SELECT jsonb_build_object(
    'pending', (SELECT count(*) FROM e WHERE status IN ('draft','submitted','rejected')),
    'pending_seconds', coalesce((SELECT sum(coalesce(duration_seconds, duration_minutes * 60, 0)) FROM e WHERE status IN ('draft','submitted','rejected')), 0),
    'eligible', (SELECT count(*) FROM e WHERE status = 'approved' AND period_closing_id IS NULL),
    'eligible_seconds', coalesce((SELECT sum(coalesce(duration_seconds, duration_minutes * 60, 0)) FROM e WHERE status = 'approved' AND period_closing_id IS NULL), 0),
    'already_closed', (SELECT count(*) FROM e WHERE period_closing_id IS NOT NULL),
    'missing_acceptance', CASE WHEN (SELECT req FROM acc) THEN (SELECT count(*) FROM e WHERE status = 'approved' AND client_acceptance_id IS NULL AND period_closing_id IS NULL) ELSE 0 END,
    'imported_locked', (SELECT count(*) FROM e WHERE status = 'locked' AND source = 'import'),
    'imported_locked_seconds', coalesce((SELECT sum(public.project_entry_seconds(started_at, stopped_at, duration_minutes, hours)) FROM e WHERE status = 'locked' AND source = 'import'), 0),
    'running_timers', (SELECT count(*) FROM public.project_timer_sessions s WHERE s.workspace_id = p_ws AND s.state IN ('running','paused')
                        AND ((p_scope = 'project' AND s.project_id = p_project) OR (p_scope = 'person' AND s.user_id = p_user))),
    'overlapping_closing', EXISTS (SELECT 1 FROM public.project_period_closings c WHERE c.workspace_id = p_ws AND c.status = 'closed' AND c.scope = p_scope
                        AND c.project_id IS NOT DISTINCT FROM p_project AND c.user_id IS NOT DISTINCT FROM p_user
                        AND c.period_from <= p_to AND c.period_to >= p_from),
    'acceptance_required', (SELECT req FROM acc),
    'policy_version', (v_pol->>'version')::int) INTO v;
  RETURN v;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_time_entries_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_overlap record;
  v_forced boolean := NEW.source = 'import' AND current_setting('app.clockify_force_import', true) = 'on';
  v_import boolean := coalesce(current_setting('app.clockify_import', true), '') = 'on';
  v_flow boolean := coalesce(current_setting('app.project_time_workflow', true), '') = 'on';
  v_free boolean;
  v_content boolean := false;
  v_workflow boolean := false;
  v_times boolean := false;
  v_policy jsonb;
  v_secs bigint;
  v_day bigint;
  v_flags text[] := '{}';
BEGIN
  -- Vínculo auditado (person_id/allocation_id): não recalcula duração nem mexe em updated_at.
  IF TG_OP = 'UPDATE' AND public.project_is_link_backfill(to_jsonb(OLD), to_jsonb(NEW), ARRAY['person_id','allocation_id']) THEN
    NEW.updated_at := OLD.updated_at;
    RETURN NEW;
  END IF;

  IF NEW.project_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um projeto.'; END IF;
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um profissional.'; END IF;

  -- Caminhos privilegiados: importadores (flag de importação), RPCs do fluxo (flag de fluxo) e
  -- processos de servidor sem usuário. Sessões de usuário comum passam por todas as guardas.
  v_free := v_import OR v_flow OR auth.uid() IS NULL;

  IF TG_OP = 'UPDATE' THEN
    v_content := (NEW.project_id, NEW.task_id, NEW.user_id, NEW.entry_date, NEW.start_time, NEW.end_time,
                  NEW.duration_minutes, NEW.duration_seconds, NEW.hours, NEW.started_at, NEW.stopped_at,
                  NEW.billable, NEW.description, NEW.entry_kind, NEW.timezone, NEW.hourly_rate,
                  NEW.workspace_id, NEW.source, NEW.external_id, NEW.person_id, NEW.allocation_id)
      IS DISTINCT FROM (OLD.project_id, OLD.task_id, OLD.user_id, OLD.entry_date, OLD.start_time, OLD.end_time,
                  OLD.duration_minutes, OLD.duration_seconds, OLD.hours, OLD.started_at, OLD.stopped_at,
                  OLD.billable, OLD.description, OLD.entry_kind, OLD.timezone, OLD.hourly_rate,
                  OLD.workspace_id, OLD.source, OLD.external_id, OLD.person_id, OLD.allocation_id);
    v_workflow := (NEW.status, NEW.submitted_at, NEW.approved_at, NEW.approved_by, NEW.rejected_at, NEW.rejected_by,
                   NEW.reject_reason, NEW.locked_at, NEW.submission_id, NEW.period_closing_id, NEW.client_acceptance_id,
                   NEW.revision, NEW.timer_session_id, NEW.review_flags)
      IS DISTINCT FROM (OLD.status, OLD.submitted_at, OLD.approved_at, OLD.approved_by, OLD.rejected_at, OLD.rejected_by,
                   OLD.reject_reason, OLD.locked_at, OLD.submission_id, OLD.period_closing_id, OLD.client_acceptance_id,
                   OLD.revision, OLD.timer_session_id, OLD.review_flags);
    v_times := (NEW.entry_date, NEW.start_time, NEW.end_time, NEW.user_id) IS DISTINCT FROM (OLD.entry_date, OLD.start_time, OLD.end_time, OLD.user_id);
    IF NOT v_free THEN
      IF OLD.period_closing_id IS NOT NULL AND (v_content OR v_workflow) THEN
        RAISE EXCEPTION 'Apontamento em competência fechada; reabra a competência antes de alterar.' USING ERRCODE = '42501';
      END IF;
      IF v_workflow THEN
        RAISE EXCEPTION 'A situação de aprovação só muda pelo fluxo de envio e aprovação.' USING ERRCODE = '42501';
      END IF;
      IF v_content AND OLD.status IN ('approved','locked') THEN
        RAISE EXCEPTION 'Apontamento aprovado ou travado; reabra a aprovação antes de editar.' USING ERRCODE = '42501';
      END IF;
      IF v_content AND OLD.status IN ('submitted','rejected') THEN
        -- Editar depois do envio invalida o item enviado: volta a rascunho e precisa ser reenviado.
        NEW.status := 'draft'; NEW.submitted_at := NULL; NEW.submission_id := NULL;
      END IF;
    END IF;
    IF v_content THEN NEW.revision := OLD.revision + 1; END IF;
  ELSE
    v_times := true;
    IF NOT v_free THEN
      IF NEW.status IS DISTINCT FROM 'draft' OR NEW.approved_at IS NOT NULL OR NEW.submitted_at IS NOT NULL
         OR NEW.locked_at IS NOT NULL OR NEW.submission_id IS NOT NULL OR NEW.period_closing_id IS NOT NULL
         OR NEW.client_acceptance_id IS NOT NULL OR NEW.timer_session_id IS NOT NULL OR NEW.review_flags IS NOT NULL THEN
        RAISE EXCEPTION 'Novo apontamento começa como rascunho.' USING ERRCODE = '42501';
      END IF;
      NEW.revision := 0;
    END IF;
  END IF;

  IF NOT v_free AND (TG_OP = 'INSERT' OR NEW.project_id IS DISTINCT FROM OLD.project_id
                     OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.entry_date IS DISTINCT FROM OLD.entry_date) THEN
    v_policy := public.project_time_policy_resolve(NEW.workspace_id);
    IF coalesce((v_policy->>'track_requires_link')::boolean, true)
       AND NOT public.project_time_can_track(NEW.user_id, NEW.project_id, NEW.entry_date) THEN
      RAISE EXCEPTION 'Profissional sem vínculo para apontar neste projeto (membro liberado ou alocação vigente).' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT public.project_time_tz_valid(NEW.timezone) THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;

  -- Tipo e duração canônica em segundos (registros novos/editados; importados não são reescritos).
  IF NOT v_import AND (TG_OP = 'INSERT' OR v_content) THEN
    IF NEW.entry_kind IS NULL THEN
      NEW.entry_kind := CASE WHEN NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN 'interval'
                             WHEN NEW.source = 'timer' THEN 'timer' ELSE 'duration' END;
    END IF;
    IF NEW.entry_kind = 'duration' THEN
      IF NEW.start_time IS NOT NULL OR NEW.end_time IS NOT NULL THEN
        RAISE EXCEPTION 'Lançamento por duração não tem horário de início/fim.';
      END IF;
      IF TG_OP = 'UPDATE' AND NEW.duration_seconds IS NOT DISTINCT FROM OLD.duration_seconds THEN
        IF NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes AND NEW.duration_minutes IS NOT NULL THEN
          NEW.duration_seconds := NEW.duration_minutes * 60;
        ELSIF NEW.hours IS DISTINCT FROM OLD.hours AND NEW.hours IS NOT NULL THEN
          NEW.duration_seconds := round(NEW.hours * 3600);
        END IF;
      ELSIF NEW.duration_seconds IS NULL THEN
        NEW.duration_seconds := CASE WHEN NEW.duration_minutes IS NOT NULL THEN NEW.duration_minutes * 60
                                     WHEN NEW.hours IS NOT NULL THEN round(NEW.hours * 3600) END;
      END IF;
      IF coalesce(NEW.duration_seconds, 0) <= 0 AND NOT v_free THEN RAISE EXCEPTION 'Informe a duração.'; END IF;
      NEW.duration_minutes := round(NEW.duration_seconds / 60.0)::int;
      NEW.hours := NULL;
      v_flags := v_flags || 'unpositioned'::text;
    ELSIF NEW.entry_kind = 'interval' THEN
      IF NEW.start_time IS NULL OR NEW.end_time IS NULL THEN RAISE EXCEPTION 'Informe início e fim.'; END IF;
      NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::int;
    ELSIF NEW.entry_kind = 'timer' AND NEW.started_at IS NOT NULL AND NEW.stopped_at IS NOT NULL THEN
      NEW.duration_seconds := floor(EXTRACT(EPOCH FROM (NEW.stopped_at - NEW.started_at)))::int;
    END IF;
  END IF;

  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time < NEW.start_time OR (NEW.end_time = NEW.start_time AND NOT v_forced) THEN
      RAISE EXCEPTION 'O horário final deve ser maior que o horário inicial.';
    END IF;
    IF NEW.entry_kind = 'timer' AND NEW.duration_seconds IS NOT NULL THEN
      -- Cronômetro: vale o intervalo UTC real (troca de horário de verão muda o relógio local).
      NEW.duration_minutes := round(NEW.duration_seconds / 60.0)::int;
    ELSE
      NEW.duration_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::int;
    END IF;
  ELSIF NEW.duration_minutes IS NULL AND NEW.duration_seconds IS NOT NULL THEN
    NEW.duration_minutes := round(NEW.duration_seconds / 60.0)::int;
  ELSIF NEW.duration_minutes IS NULL AND NEW.hours IS NOT NULL THEN
    NEW.duration_minutes := GREATEST(0, ROUND(NEW.hours * 60))::int;
  END IF;

  IF NEW.duration_minutes IS NOT NULL THEN
    IF NEW.duration_minutes < 0 THEN RAISE EXCEPTION 'A duração do apontamento não pode ser negativa.'; END IF;
    NEW.hours := ROUND((coalesce(NEW.duration_seconds::numeric / 60, NEW.duration_minutes::numeric) / 60), 2);
    IF NEW.duration_seconds IS NULL THEN NEW.hours := ROUND((NEW.duration_minutes::numeric / 60), 2); END IF;
  END IF;

  IF v_times AND NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL AND NOT v_forced THEN
    SELECT t.start_time, t.end_time INTO v_overlap
      FROM public.project_time_entries t
     WHERE t.user_id = NEW.user_id AND t.entry_date = NEW.entry_date
       AND t.id IS DISTINCT FROM NEW.id
       AND t.start_time IS NOT NULL AND t.end_time IS NOT NULL
       AND t.start_time < NEW.end_time AND t.end_time > NEW.start_time
     LIMIT 1;
    IF v_overlap IS NOT NULL THEN
      IF NEW.entry_kind = 'timer' THEN
        -- Cronômetro é evidência de tempo real: grava e marca para revisão em vez de descartar.
        v_flags := v_flags || 'overlap'::text;
      ELSE
        RAISE EXCEPTION 'Já existe um apontamento entre % e % neste dia.',
          to_char(v_overlap.start_time, 'HH24:MI'), to_char(v_overlap.end_time, 'HH24:MI');
      END IF;
    END IF;
  END IF;

  IF NOT v_import AND (TG_OP = 'INSERT' OR v_content) THEN
    v_policy := coalesce(v_policy, public.project_time_policy_resolve(NEW.workspace_id));
    v_secs := coalesce(NEW.duration_seconds, NEW.duration_minutes * 60, 0);
    SELECT coalesce(sum(coalesce(t.duration_seconds, t.duration_minutes * 60, 0)), 0) INTO v_day
      FROM public.project_time_entries t
     WHERE t.user_id = NEW.user_id AND t.entry_date = NEW.entry_date AND t.id IS DISTINCT FROM NEW.id;
    IF v_day + v_secs > coalesce((v_policy->>'max_daily_seconds')::bigint, 57600) THEN
      v_flags := v_flags || 'daily_excess'::text;
    END IF;
    IF NEW.review_flags IS NOT NULL AND 'dst_ambiguous' = ANY (NEW.review_flags) THEN v_flags := v_flags || 'dst_ambiguous'::text; END IF;
    NEW.review_flags := CASE WHEN cardinality(v_flags) = 0 THEN NULL ELSE (SELECT array_agg(DISTINCT f ORDER BY f) FROM unnest(v_flags) f) END;
  END IF;

  IF NEW.created_by IS NULL THEN NEW.created_by := COALESCE(auth.uid(), NEW.user_id); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.project_time_policy_get(p_ws uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$BEGIN PERFORM work_area_authorize('techprojects.time_policy','view');RETURN project_time_policy_resolve(p_ws);END$$;
REVOKE ALL ON FUNCTION project_time_policy_get(uuid) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION project_time_policy_get(uuid) TO authenticated,service_role;

-- Read boundaries for settings and process data; write RPC flags remain intact.
CREATE POLICY work_setting_view ON project_time_policies AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.time_policy','view','{}'));
CREATE POLICY work_setting_view ON project_time_approvers AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.approvers','view','{}') AND (project_id IS NULL OR work_record_access('techprojects.projects',project_id,'view')));
CREATE POLICY work_setting_view ON project_delivery_templates AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.delivery_templates','view','{}'));
CREATE POLICY work_setting_view ON project_delivery_template_versions AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.delivery_templates','view','{}'));
CREATE POLICY work_setting_view ON project_delivery_template_services AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.delivery_templates','view','{}'));
CREATE POLICY work_setting_view ON project_risk_rule_versions AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.risk_rules','view','{}') AND (project_id IS NULL OR work_record_access('techprojects.projects',project_id,'view')));
CREATE POLICY work_setting_view ON project_rates AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.rates','view','{}') AND (project_id IS NULL OR work_record_access('techprojects.projects',project_id,'view')));
CREATE POLICY work_setting_view ON project_billing_configs AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.billing_config','view','{}') AND (contract_id IS NULL OR work_record_access('techcontracts.contracts',contract_id,'view')));
CREATE POLICY work_setting_view ON project_measurements AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.measurements','view','{}') AND (contract_id IS NULL OR work_record_access('techcontracts.contracts',contract_id,'view')));
DROP POLICY project_billing_configs_select ON project_billing_configs;CREATE POLICY work_billing_config_view ON project_billing_configs FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.billing_config','view','{}') AND work_record_access('techcontracts.contracts',contract_id,'view'));
CREATE POLICY work_measurement_child_view ON project_measurement_lines AS RESTRICTIVE FOR SELECT TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND EXISTS(SELECT 1 FROM project_measurements m WHERE m.id=measurement_id AND m.workspace_id=project_measurement_lines.workspace_id));
CREATE POLICY work_measurement_child_view ON project_measurement_financial_links AS RESTRICTIVE FOR SELECT TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND EXISTS(SELECT 1 FROM project_measurements m WHERE m.id=measurement_id AND m.workspace_id=project_measurement_financial_links.workspace_id));
CREATE POLICY work_alert_view ON project_alerts AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.alerts','view','{}') AND (project_id IS NULL OR work_record_access('techprojects.projects',project_id,'view')) AND (deal_id IS NULL OR work_commercial_reference_allowed('deals',deal_id)));
CREATE POLICY work_alert_view ON project_alert_runs AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.alerts','view','{}'));
CREATE POLICY work_alert_event_view ON project_alert_events AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM project_alerts a WHERE a.id=alert_id AND a.workspace_id=project_alert_events.workspace_id));
CREATE POLICY work_reconciliation_view ON project_people_groups AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.reconciliation','view','{}') AND is_active_workspace_admin(workspace_id,auth.uid()));
CREATE POLICY work_reconciliation_view ON project_people_group_members AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.reconciliation','view','{}') AND is_active_workspace_admin(workspace_id,auth.uid()));
CREATE POLICY work_reconciliation_view ON project_link_batches AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.reconciliation','view','{}') AND is_active_workspace_admin(workspace_id,auth.uid()));
CREATE POLICY work_reconciliation_view ON project_link_changes AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.reconciliation','view','{}') AND is_active_workspace_admin(workspace_id,auth.uid()));
CREATE POLICY work_reconciliation_view ON project_link_suggestions AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.reconciliation','view','{}') AND is_active_workspace_admin(workspace_id,auth.uid()));

-- Confidential project cost/rates cannot be selected directly over REST.
REVOKE SELECT ON public.projects FROM authenticated;GRANT SELECT("id","workspace_id","owner_id","service_id","contract_id","role","name","description","status","starts_at","due_at","progress","planned_hours","metadata","created_at","updated_at","assigned_to","company_id","deal_id","delivery_group_key","source_line_item_id","client_contact_id","origin","delivery_template_version_id","delivery_template_applied_at","delivery_template_applied_by","client_acceptance_required") ON public.projects TO authenticated;
CREATE TRIGGER zzz_work_cost_guard BEFORE INSERT OR UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION work_cost_guard();
REVOKE SELECT ON public.project_members FROM authenticated;GRANT SELECT("id","workspace_id","project_id","user_id","role_in_project","created_at","updated_at","can_track_time") ON public.project_members TO authenticated;
CREATE TRIGGER zzz_work_cost_guard BEFORE INSERT OR UPDATE ON project_members FOR EACH ROW EXECUTE FUNCTION work_cost_guard();
CREATE TRIGGER zzzz_work_milestone_billing_guard BEFORE INSERT OR UPDATE ON project_milestones FOR EACH ROW EXECUTE FUNCTION work_milestone_billing_guard();

-- Dedicated delivery/reconciliation gates preserve the shared admin assertion.
CREATE OR REPLACE FUNCTION public.project_recon_assert_admin(p_ws uuid, p_write boolean)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_ws IS NULL THEN RAISE EXCEPTION 'Workspace obrigatório.' USING ERRCODE = '22023'; END IF;
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), '') = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN RETURN; END IF;
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_workspace_admin(p_ws, auth.uid())
     OR NOT EXISTS (SELECT 1 FROM public.current_user_workspaces() AS w(id) WHERE w.id = p_ws) THEN
    RAISE EXCEPTION 'Apenas administradores ativos do workspace ativo.' USING ERRCODE = '42501';
  END IF;
  IF p_write AND public.is_read_only_view() THEN
    RAISE EXCEPTION 'O modo Ver como é somente leitura.' USING ERRCODE = '42501';
  END IF;
END $function$
;
DO $patch$DECLARE f record;m record;src text;definition text;gate text;BEGIN
 FOR m IN SELECT * FROM (VALUES
('project_reconciliation_overview','techprojects.reconciliation','view'),
('project_reconciliation_breakdown','techprojects.reconciliation','view'),
('project_link_people_overview','techprojects.reconciliation','view'),
('project_reconciliation_decide','techprojects.reconciliation','manage'),
('project_links_apply_exact','techprojects.reconciliation','manage'),
('project_reconciliation_refresh','techprojects.reconciliation','manage'),
('project_link_suggestions_decide','techprojects.reconciliation','manage'),
('project_links_revert','techprojects.reconciliation','manage'),
('deal_delivery_policy_get','techprojects.delivery','view'),
('deal_delivery_policy_save','techprojects.delivery','manage'),
('deal_delivery_history_list','techprojects.delivery','view'),
('deal_delivery_history_preview','techprojects.delivery','manage'),
('deal_delivery_history_apply','techprojects.delivery','manage'),
('deal_delivery_history_apply_exact','techprojects.delivery','manage'),
('deal_delivery_history_create','techprojects.delivery','manage'),
('deal_delivery_history_revert','techprojects.delivery','manage'))x(name,resource,action) LOOP
 SELECT p.oid,p.prosrc,pg_get_functiondef(p.oid) AS def,l.lanname INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.proname=m.name;
 IF f.oid IS NULL OR f.lanname<>'plpgsql' THEN RAISE EXCEPTION 'RPC esperada ausente: %',m.name;END IF;
 gate:=format('IF auth.uid() IS NOT NULL THEN PERFORM work_area_authorize(%L,%L);IF p_ws IS DISTINCT FROM (work_access_context()->>''workspace'')::uuid THEN RAISE EXCEPTION ''Workspace inválido.'' USING ERRCODE=''42501'';END IF;ELSIF coalesce(auth.role(),'''')<>''service_role'' AND session_user NOT IN(''postgres'',''supabase_admin'') THEN RAISE EXCEPTION ''Sessão obrigatória.'' USING ERRCODE=''42501'';END IF;',m.resource,m.action);
 src:=regexp_replace(f.prosrc,'\mBEGIN\M','BEGIN'||chr(10)||gate,'i');
 IF src=f.prosrc THEN RAISE EXCEPTION 'Corpo inesperado: %',m.name;END IF;
 definition:=replace(f.def,f.prosrc,src);EXECUTE definition;
 END LOOP;
END $patch$;
CREATE POLICY work_recon_view ON project_reconciliation_issues AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.reconciliation','view','{}') AND is_active_workspace_admin(workspace_id,auth.uid()));
CREATE POLICY work_recon_view ON project_reconciliation_issue_events AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.reconciliation','view','{}') AND is_active_workspace_admin(workspace_id,auth.uid()));
CREATE POLICY work_recon_view ON project_reconciliation_refreshes AS RESTRICTIVE FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techprojects.reconciliation','view','{}') AND is_active_workspace_admin(workspace_id,auth.uid()));

REVOKE SELECT ON public.contracts FROM authenticated;GRANT SELECT("id","workspace_id","owner_id","role","counterparty_company_id","deal_id","parent_contract_id","number","title","status","starts_at","ends_at","auto_renew","notice_days","total_value","currency","readjustment_index","readjustment_period","payment_terms","body_html","signed_at","signed_pdf_path","metadata","created_at","updated_at","monthly_value","hours_per_month","payment_day","payment_method","late_fee_percent","late_interest_monthly_percent","expense_reimbursement_days","penalty_percent","cure_period_days","trial_period_days","unilateral_termination_notice_days","service_type","service_scope","service_location","governing_law","jurisdiction","confidentiality_term_months","contracting_legal_entity_id","signature_provider","signature_document_id","signature_operation_id","source_file_path","imported_from","import_confidence","assigned_to","document_kind","amendment_of_id","amendment_number","amendment_effective_at","proposal_id","quote_id") ON public.contracts TO authenticated;
CREATE TRIGGER zzzz_work_service_billing_guard BEFORE INSERT OR UPDATE ON services FOR EACH ROW EXECUTE FUNCTION work_service_billing_guard();
CREATE TRIGGER zzzz_work_task_relations_guard BEFORE INSERT OR UPDATE ON project_tasks FOR EACH ROW EXECUTE FUNCTION work_task_relations_guard();
CREATE TRIGGER zzzz_work_contract_file_guard BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION work_contract_file_guard();
CREATE TRIGGER zzzz_work_contract_file_guard BEFORE INSERT OR UPDATE ON contract_templates FOR EACH ROW EXECUTE FUNCTION work_contract_file_guard();
CREATE POLICY work_contract_file_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'contract-imports' OR ((owner=auth.uid() OR owner_id=auth.uid()::text) AND work_contract_storage_allowed(false)));
CREATE POLICY work_contract_file_create ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'contract-imports' OR ((owner=auth.uid() OR owner_id=auth.uid()::text) AND work_contract_storage_allowed(true)));
CREATE POLICY work_contract_file_change ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'contract-imports' OR ((owner=auth.uid() OR owner_id=auth.uid()::text) AND work_contract_storage_allowed(true) AND NOT work_contract_source_in_use(name))) WITH CHECK(bucket_id<>'contract-imports' OR ((owner=auth.uid() OR owner_id=auth.uid()::text) AND work_contract_storage_allowed(true) AND NOT work_contract_source_in_use(name)));
CREATE POLICY work_contract_file_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'contract-imports' OR ((owner=auth.uid() OR owner_id=auth.uid()::text) AND work_contract_storage_allowed(true) AND NOT work_contract_source_in_use(name)));

DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='contract_template_services' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON contract_template_services',p.policyname);END LOOP;END $$;
CREATE POLICY work_template_service_view ON contract_template_services FOR SELECT TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techcontracts.contract_templates',template_id,'view'));
CREATE POLICY work_template_service_insert ON contract_template_services FOR INSERT TO authenticated WITH CHECK(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techcontracts.contract_templates',template_id,'update') AND work_catalog_service_access(service_catalog_id));
CREATE POLICY work_template_service_delete ON contract_template_services FOR DELETE TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techcontracts.contract_templates',template_id,'update'));
REVOKE UPDATE ON contract_template_services FROM authenticated;

CREATE OR REPLACE FUNCTION public.deal_delivery_can_create_project(_ws uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT work_context_access(work_access_context(),_ws,'techprojects.projects','create',ARRAY[auth.uid()]) AND work_context_access(work_access_context(),_ws,'techprojects.projects','view',ARRAY[auth.uid()])$$;
CREATE OR REPLACE FUNCTION public.deal_delivery_can_edit_deal(_deal uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT work_deal_context_access(work_access_context(),_deal,'update')$$;
CREATE OR REPLACE FUNCTION public.deal_delivery_set_operational_owner(p_project uuid, p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record;
BEGIN
 PERFORM work_area_authorize('techprojects.projects','assign',p_project);IF NOT work_record_access('techprojects.projects',p_project,'update') THEN RAISE EXCEPTION 'Edição não autorizada.' USING ERRCODE='42501';END IF;
  SELECT id, workspace_id, assigned_to, deal_id INTO p FROM public.projects WHERE id = p_project;
  PERFORM public.deal_delivery_assert_user(p.workspace_id, true);
  IF NOT public.project_editable_by_current_user(p_project) THEN RAISE EXCEPTION 'Você não pode editar este projeto.' USING ERRCODE = '42501'; END IF;
  IF p_user IS NOT NULL AND NOT public.deal_delivery_is_active_member(p.workspace_id, p_user) THEN
    RAISE EXCEPTION 'O responsável precisa ser membro ativo do workspace.' USING ERRCODE = '22023';
  END IF;
  -- Só o responsável do registro; nenhuma permissão, membership ou papel é concedido.
  UPDATE public.projects SET assigned_to = p_user WHERE id = p_project;
  INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, actor, before, after)
  VALUES (p.workspace_id, p.deal_id, p_project, 'owner_changed', auth.uid(),
          jsonb_build_object('assigned_to', p.assigned_to), jsonb_build_object('assigned_to', p_user));
  RETURN jsonb_build_object('assigned_to', p_user);
END $function$
;
CREATE OR REPLACE FUNCTION public.deal_delivery_ensure_internal(p_deal uuid, p_origin text, p_creator uuid, p_audit_actor uuid, p_job uuid, p_operational_owner uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d record; pol record; g record;
  v_creator uuid; v_owner uuid; v_explicit boolean; v_company uuid; v_contact uuid;
  v_contracts uuid[]; v_contract uuid; v_role public.contract_role := 'provider';
  v_services uuid[]; v_service uuid; v_line uuid; v_hours numeric; v_recurring boolean; v_lines jsonb;
  v_proj uuid; v_name text; v_results jsonb := '[]'::jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('deal_delivery'), hashtext(p_deal::text));
  SELECT x.id, x.workspace_id, x.name, x.description, x.company_id, x.primary_contact_id, x.deleted_at
    INTO d FROM public.deals x WHERE x.id = p_deal;
  IF NOT FOUND OR d.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Negócio não encontrado ou excluído.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO pol FROM public.deal_delivery_policies WHERE workspace_id = d.workspace_id;
  v_creator := coalesce(p_creator, pol.project_creator_id);
  IF NOT public.deal_delivery_is_active_member(d.workspace_id, v_creator) THEN
    RAISE EXCEPTION 'O criador dos projetos não é membro ativo do workspace. Revise a política de entrega.' USING ERRCODE = '22023';
  END IF;
  v_owner := coalesce(p_operational_owner, pol.default_operational_owner_id);
  IF v_owner IS NOT NULL AND NOT public.deal_delivery_is_active_member(d.workspace_id, v_owner) THEN v_owner := NULL; END IF;

  IF NOT work_project_delivery_delegate(d.workspace_id,v_creator,v_owner,p_deal) THEN RAISE EXCEPTION 'O criador configurado não possui permissão para o negócio, criação ou atribuição do projeto.' USING ERRCODE='42501';END IF;
  v_explicit := coalesce(pol.allow_groups, true) AND EXISTS (
    SELECT 1 FROM public.deal_delivery_items i JOIN public.deal_line_items li ON li.id = i.line_item_id AND li.deal_id = p_deal
     WHERE i.deal_id = p_deal AND i.group_key <> 'none');
  SELECT c.id INTO v_company FROM public.companies c
   WHERE c.id = d.company_id AND c.workspace_id = d.workspace_id AND c.deleted_at IS NULL;
  SELECT c.id INTO v_contact FROM public.contacts c
   WHERE c.id = d.primary_contact_id AND c.workspace_id = d.workspace_id AND c.deleted_at IS NULL;
  -- Contrato só quando há exatamente um contrato principal coerente (mesmo workspace e mesma empresa); nunca "o primeiro".
  SELECT array_agg(c.id ORDER BY c.id) INTO v_contracts FROM public.contracts c
   WHERE c.deal_id = p_deal AND c.workspace_id = d.workspace_id AND c.document_kind <> 'amendment'
     AND (c.counterparty_company_id IS NULL OR v_company IS NULL OR c.counterparty_company_id = v_company);
  IF coalesce(cardinality(v_contracts), 0) = 1 THEN
    v_contract := v_contracts[1];
    SELECT c.role INTO v_role FROM public.contracts c WHERE c.id = v_contract;
  END IF;

  FOR g IN
    SELECT s.key, s.label, s.items FROM (
      SELECT i.group_key AS key, max(i.group_label) AS label,
             array_agg(li.id ORDER BY li.position, li.created_at) AS items
        FROM public.deal_delivery_items i JOIN public.deal_line_items li ON li.id = i.line_item_id AND li.deal_id = p_deal
       WHERE v_explicit AND i.deal_id = p_deal AND i.group_key <> 'none'
       GROUP BY i.group_key
      UNION ALL
      SELECT 'default', NULL::text,
             coalesce((SELECT array_agg(li.id ORDER BY li.position, li.created_at) FROM public.deal_line_items li
                        WHERE li.deal_id = p_deal
                          AND NOT EXISTS (SELECT 1 FROM public.deal_delivery_items i
                                           WHERE i.line_item_id = li.id AND i.group_key = 'none')), '{}'::uuid[])
       WHERE NOT v_explicit) s
    ORDER BY s.key
  LOOP
    v_proj := NULL;
    SELECT p.id INTO v_proj FROM public.projects p WHERE p.deal_id = p_deal AND p.delivery_group_key = g.key;
    IF v_proj IS NULL THEN
      SELECT l.project_id INTO v_proj FROM public.project_deal_links l WHERE l.deal_id = p_deal AND l.delivery_group_key = g.key;
    END IF;
    IF v_proj IS NOT NULL THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object('group', g.key, 'project_id', v_proj, 'action', 'existing'));
      CONTINUE;
    END IF;
    v_services := ARRAY(SELECT s.id FROM public.services s
                         WHERE v_contract IS NOT NULL AND s.contract_id = v_contract AND s.workspace_id = d.workspace_id
                           AND s.source_deal_line_item_id = ANY (g.items));
    v_service := CASE WHEN cardinality(v_services) = 1 THEN v_services[1] END;
    v_line := CASE WHEN cardinality(g.items) = 1 THEN g.items[1] END;
    SELECT sum(li.quantity) FILTER (WHERE li.unit = 'hour' AND li.cadence IS NULL),
           coalesce(bool_or(li.unit = 'hour' AND li.cadence IS NOT NULL), false),
           coalesce(jsonb_agg(jsonb_build_object('id', li.id, 'name', li.name, 'quantity', li.quantity, 'unit', li.unit,
                    'cadence', li.cadence, 'service_catalog_id', li.service_catalog_id) ORDER BY li.position, li.created_at), '[]'::jsonb)
      INTO v_hours, v_recurring, v_lines
      FROM public.deal_line_items li WHERE li.id = ANY (g.items);
    IF v_recurring THEN v_hours := NULL; END IF;
    v_name := left(d.name || CASE WHEN g.key <> 'default' THEN ' · ' || coalesce(nullif(btrim(g.label), ''), g.key) ELSE '' END, 200);

    INSERT INTO public.projects (workspace_id, owner_id, name, description, status, role, company_id, client_contact_id,
      contract_id, service_id, deal_id, delivery_group_key, source_line_item_id, origin, planned_hours, assigned_to, metadata)
    VALUES (d.workspace_id, v_creator, v_name, d.description, 'planning', v_role, v_company, v_contact,
      v_contract, v_service, p_deal, g.key, v_line,
      CASE p_origin WHEN 'manual' THEN 'deal_manual' WHEN 'history' THEN 'deal_history' ELSE 'deal_auto' END,
      v_hours, coalesce(v_owner, v_creator),
      jsonb_build_object('delivery', jsonb_build_object(
        'deal_id', p_deal, 'group_key', g.key, 'group_label', g.label, 'origin', p_origin, 'job_id', p_job,
        'line_items', v_lines, 'contracts_found', coalesce(cardinality(v_contracts), 0),
        'operational_owner_defined', v_owner IS NOT NULL, 'created_at', now())))
    RETURNING id INTO v_proj;
    -- Responsável operacional indefinido fica vazio (pendência visível); nunca herda o vendedor.
    IF v_owner IS NULL THEN
      UPDATE public.projects SET assigned_to = NULL WHERE id = v_proj;
    END IF;
    INSERT INTO public.deal_delivery_events (workspace_id, deal_id, project_id, kind, origin, actor, job_id, after)
    VALUES (d.workspace_id, p_deal, v_proj, 'project_created', p_origin, p_audit_actor, p_job,
            jsonb_build_object('deal_id', p_deal, 'group_key', g.key, 'company_id', v_company, 'contract_id', v_contract,
                               'service_id', v_service, 'source_line_item_id', v_line));
    v_results := v_results || jsonb_build_array(jsonb_build_object('group', g.key, 'project_id', v_proj, 'action', 'created'));
  END LOOP;
  RETURN jsonb_build_object('deal_id', p_deal, 'results', v_results);
END $function$
;
CREATE POLICY work_delivery_link_view ON project_deal_links AS RESTRICTIVE FOR SELECT TO authenticated USING(workspace_id=(work_access_context()->>'workspace')::uuid AND work_record_access('techprojects.projects',project_id,'view') AND work_commercial_reference_allowed('deals',deal_id));

-- Dashboard flags and secondary datasets use the same effective permissions as RLS.
CREATE OR REPLACE FUNCTION public.project_dash_scope()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid := public.project_dash_ws(); v_uid uuid := auth.uid(); v_admin boolean; v_full boolean; v_led int;
BEGIN
  PERFORM public.project_time_assert_actor(v_ws, false);
  v_admin := public.is_active_workspace_admin(v_ws, v_uid);
  v_full := public.project_dash_full(v_ws);
  SELECT count(*) INTO v_led FROM public.project_dash_leader_projects(v_ws, v_uid);
  RETURN jsonb_build_object(
    'workspace_id', v_ws, 'user_id', v_uid, 'read_only', public.is_read_only_view(),
    'views', jsonb_build_object(
      'me', true,
      'team', v_full OR v_led > 0,
      'commercial', public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.workspace')
                    OR public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.team')
                    OR public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.own'),
      'finance', public.user_has_permission(v_uid, v_ws, 'techprojects.measurements.view.workspace')
                 OR public.user_has_permission(v_uid, v_ws, 'techprojects.profitability.view.workspace'),
      'quality', v_admin AND public.user_has_permission(v_uid,v_ws,'techprojects.reconciliation.view.workspace')),
    'team_scope', CASE WHEN v_full THEN 'workspace' WHEN v_led > 0 THEN 'led' ELSE 'none' END,
    'led_projects', v_led,
    'can_cost', public.user_has_permission(v_uid, v_ws, 'techprojects.rates.view.workspace')
                OR public.user_has_permission(v_uid, v_ws, 'techprojects.profitability.view.workspace'),
    'can_profitability', public.user_has_permission(v_uid, v_ws, 'techprojects.profitability.view.workspace'),
    'can_manage_alerts', public.user_has_permission(v_uid, v_ws, 'techprojects.alerts.manage.workspace'),
    'can_view_all_alerts', public.user_has_permission(v_uid, v_ws, 'techprojects.alerts.view.workspace'),
    'can_manage_rules', public.user_has_permission(v_uid, v_ws, 'techprojects.risk_rules.manage.workspace'),
    'can_export', public.user_has_permission(v_uid, v_ws, 'techprojects.projects.export.workspace'),
    -- Recebimentos (financial_payments) seguem a RLS do Financeiro: sem acesso, o painel diz "sem acesso", nunca 0.
    'can_received', public.user_has_permission(v_uid,v_ws,'techfinance.payments.view.workspace') AND public.user_has_permission(v_uid,v_ws,'techfinance.entries.view.workspace'),
    'can_open_center', v_admin AND public.user_has_permission(v_uid,v_ws,'techprojects.reconciliation.view.workspace'));
END $function$
;
CREATE OR REPLACE FUNCTION public.project_dash_ds_milestones(p_view text, f jsonb)
 RETURNS TABLE(id uuid, name text, project_id uuid, status text, due_at date, assigned_to uuid, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS MATERIALIZED (SELECT v.*,public.work_access_context() AS work_ctx FROM public.project_dash_vis() v),
  b AS MATERIALIZED (
    SELECT v.*, (f->>'today')::date td,
           nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
           nullif(f->>'person', '')::uuid pe,
           CASE WHEN nullif(f->>'leader', '') IS NOT NULL THEN ARRAY(SELECT public.project_dash_leader_projects(v.ws, (f->>'leader')::uuid)) END ld
      FROM v)
  SELECT x.id, x.name, x.project_id, x.status::text, x.due_at, x.assigned_to,
         array_remove(ARRAY['all',
           CASE WHEN x.status::text = 'done' THEN 'done' END,
           CASE WHEN x.status::text NOT IN ('done','cancelled') AND pr.status::text IN ('active','planning','on_hold') THEN 'open' END,
           CASE WHEN x.status::text NOT IN ('done','cancelled') AND pr.status::text IN ('active','planning','on_hold')
                     AND x.due_at < b.td THEN 'overdue' END,
           CASE WHEN x.status::text NOT IN ('done','cancelled') AND pr.status::text IN ('active','planning','on_hold')
                     AND x.due_at BETWEEN b.td AND b.td + 14 THEN 'due_soon' END], NULL)
    FROM public.project_milestones x CROSS JOIN b
    LEFT JOIN public.projects pr ON pr.id = x.project_id
   WHERE x.workspace_id = b.ws AND work_context_access(b.work_ctx,x.workspace_id,'techprojects.milestones','view',ARRAY[x.assigned_to]) AND work_record_context_access(b.work_ctx,'techprojects.projects',x.project_id,'view')
     AND (p_view <> 'me' OR x.assigned_to = b.uid)
     AND (p_view <> 'team' OR x.project_id = ANY (b.team))
     AND (b.pj IS NULL OR x.project_id = b.pj) AND (b.co IS NULL OR pr.company_id = b.co) AND (b.sv IS NULL OR pr.service_id = b.sv)
     AND (b.ld IS NULL OR x.project_id = ANY (b.ld))
     AND (b.pe IS NULL OR x.assigned_to = b.pe) $function$
;
CREATE OR REPLACE FUNCTION public.project_dash_ds_forecast(p_view text, f jsonb)
 RETURNS TABLE(id uuid, name text, status text, kind text, due_at date, planned_hours numeric, consumed_secs numeric, open_tasks integer, est_tasks integer, remaining_secs numeric, tasks_total integer, tasks_done integer, ms_total integer, ms_done integer, weeks_with_hours integer, w_p25 numeric, w_p50 numeric, w_p75 numeric, alloc_week_secs numeric, method text, eta_low date, eta_mid date, eta_high date, reason text, cut_date date, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Definer só para não reavaliar a RLS por linha: tarefas, marcos e apontamentos usam as MESMAS condições
  -- das políticas (project_dash_vis), e os projetos vêm de ds_projects (já restrito ao visível).
  WITH v AS MATERIALIZED (SELECT v.*, public.work_access_context() AS work_ctx FROM public.project_dash_vis() v),
  b AS (SELECT v.*, (f->>'today')::date td, (date_trunc('week', (f->>'today')::date))::date wk0 FROM v),
  pr AS MATERIALIZED (SELECT p.* FROM public.project_dash_ds_projects(p_view, f) p WHERE 'open' = ANY (p.m)),
  tk AS (SELECT t.project_id, count(*) FILTER (WHERE t.status <> 'done')::int o,
                count(*) FILTER (WHERE t.status <> 'done' AND t.estimated_hours IS NOT NULL)::int oe,
                coalesce(sum(t.estimated_hours) FILTER (WHERE t.status <> 'done'), 0) * 3600 rem,
                count(*)::int tt, count(*) FILTER (WHERE t.status = 'done')::int td
           FROM public.project_tasks t CROSS JOIN b
          WHERE t.workspace_id = b.ws AND t.project_id IN (SELECT id FROM pr) AND public.work_context_access(b.work_ctx,t.workspace_id,'techprojects.tasks','view',array_append(coalesce(t.assignee_ids,'{}'),t.assignee_id)) GROUP BY 1),
  ms AS (SELECT x.project_id, count(*) FILTER (WHERE x.status::text <> 'cancelled')::int tt, count(*) FILTER (WHERE x.status::text = 'done')::int dn
           FROM public.project_milestones x CROSS JOIN b
          WHERE x.workspace_id = b.ws AND x.project_id IN (SELECT id FROM pr) AND work_context_access(b.work_ctx,x.workspace_id,'techprojects.milestones','view',ARRAY[x.assigned_to]) GROUP BY 1),
  -- Consumo total por projeto e cadência das últimas 8 semanas, agregados direto da tabela (antes:
  -- todo o histórico materializado e cruzado com cada semana). Mesmos filtros e mesmas somas.
  ce AS (
    SELECT e.project_id, sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))) s
      FROM public.project_time_entries e CROSS JOIN b
     WHERE e.workspace_id = b.ws AND e.project_id IN (SELECT id FROM pr) AND e.status <> 'rejected'
       AND b.te_perm AND (e.user_id = b.uid OR b.te_full OR e.project_id = ANY (b.te_led)
                          OR (e.project_id::text || ':' || e.user_id::text) = ANY (b.te_pairs))
     GROUP BY 1),
  ew AS (
    SELECT e.project_id, b.wk0 - 7 * (((b.wk0 - e.entry_date) - 1) / 7 + 1) AS w,
           sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))) s
      FROM public.project_time_entries e CROSS JOIN b
     WHERE e.workspace_id = b.ws AND e.project_id IN (SELECT id FROM pr) AND e.status <> 'rejected'
       AND e.entry_date >= (SELECT b0.wk0 - 56 FROM b b0) AND e.entry_date < (SELECT b0.wk0 FROM b b0)
       AND b.te_perm AND (e.user_id = b.uid OR b.te_full OR e.project_id = ANY (b.te_led)
                          OR (e.project_id::text || ':' || e.user_id::text) = ANY (b.te_pairs))
     GROUP BY 1, 2),
  wk AS (SELECT pr.id pid, g.w, coalesce(ew.s, 0) s
           FROM pr CROSS JOIN b CROSS JOIN LATERAL (SELECT (b.wk0 - 7 * i) AS w FROM generate_series(1, 8) i) g
           LEFT JOIN ew ON ew.project_id = pr.id AND ew.w = g.w),
  wq AS (SELECT pid, count(*) FILTER (WHERE s > 0)::int nw,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY s) p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY s) p50,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY s) p75
           FROM wk GROUP BY pid),
  base AS (
    SELECT pr.id, pr.name, pr.status, pr.kind, pr.due_at, pr.planned_hours, coalesce(ce.s, 0) cs,
           coalesce(tk.o, 0) o, coalesce(tk.oe, 0) oe, coalesce(tk.rem, 0) rem, coalesce(tk.tt, 0) tt, coalesce(tk.td, 0) tdn,
           coalesce(ms.tt, 0) mt, coalesce(ms.dn, 0) md, coalesce(wq.nw, 0) nw,
           CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p25 END p25, CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p50 END p50,
           CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p75 END p75,
           public.project_dash_project_week_alloc(b.ws, pr.id, b.td) aw, b.td
      FROM pr CROSS JOIN b LEFT JOIN tk ON tk.project_id = pr.id LEFT JOIN ms ON ms.project_id = pr.id
      LEFT JOIN ce ON ce.project_id = pr.id LEFT JOIN wq ON wq.pid = pr.id),
  calc AS (
    SELECT base.*,
      CASE WHEN kind = 'hunting' THEN 'techhire' WHEN kind = 'capacity' THEN 'competence'
           WHEN o = 0 OR oe = 0 THEN 'none'
           WHEN p50 IS NULL AND coalesce(aw, 0) = 0 THEN 'none'
           ELSE 'estimate' END AS meth,
      nullif(greatest(coalesce(p75, 0), coalesce(aw, 0)), 0) hi_rate,
      least(coalesce(nullif(p25, 0), nullif(aw, 0)), coalesce(nullif(aw, 0), nullif(p25, 0))) lo_rate,
      coalesce(nullif(p50, 0), nullif(aw, 0)) mid_rate
      FROM base)
  SELECT c.id, c.name, c.status, c.kind, c.due_at, c.planned_hours, c.cs, c.o, c.oe, c.rem, c.tt, c.tdn, c.mt, c.md, c.nw,
         c.p25, c.p50, c.p75, c.aw,
         c.meth,
         CASE WHEN c.meth = 'estimate' AND c.hi_rate > 0 THEN c.td + ceil(c.rem / c.hi_rate * 7)::int END,
         CASE WHEN c.meth = 'estimate' AND c.mid_rate > 0 THEN c.td + ceil(c.rem / c.mid_rate * 7)::int END,
         CASE WHEN c.meth = 'estimate' AND c.lo_rate > 0 THEN c.td + ceil(c.rem / c.lo_rate * 7)::int END,
         CASE WHEN c.kind = 'hunting' THEN 'Hunting é acompanhado no TechHire (vagas e candidaturas); sem previsão aqui.'
              WHEN c.kind = 'capacity' THEN 'Entrega recorrente: acompanhe a cobertura da competência (alocado × registrado).'
              WHEN c.o = 0 THEN 'Sem base para prever: nenhuma tarefa aberta.'
              WHEN c.oe = 0 THEN 'Sem base para prever: tarefas abertas sem estimativa.'
              WHEN c.p50 IS NULL AND coalesce(c.aw, 0) = 0 THEN 'Sem base para prever: menos de 4 das últimas 8 semanas com horas e sem capacidade alocada conhecida.'
              WHEN c.oe < c.o THEN 'Estimativa parcial: só ' || c.oe || ' de ' || c.o || ' tarefas abertas têm estimativa; a data tende a ser otimista.'
              END,
         c.td,
         array_remove(ARRAY['open',
           CASE WHEN c.meth = 'estimate' THEN 'forecast' END,
           CASE WHEN c.meth = 'none' THEN 'no_base' END,
           CASE WHEN c.meth = 'techhire' THEN 'hunting' END,
           CASE WHEN c.meth = 'competence' THEN 'recurring' END,
           CASE WHEN c.meth = 'estimate' AND c.due_at IS NOT NULL AND c.mid_rate > 0 AND c.td + ceil(c.rem / c.mid_rate * 7)::int > c.due_at THEN 'late' END,
           CASE WHEN c.meth = 'estimate' AND c.oe < c.o THEN 'partial_estimate' END,
           CASE WHEN c.planned_hours > 0 AND c.cs >= c.planned_hours * 3600 THEN 'over_budget' END], NULL)
    FROM calc c $function$
;
CREATE OR REPLACE FUNCTION public.project_alert_visible_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH c AS MATERIALIZED(SELECT work_access_context()j)
 SELECT a.id FROM project_alerts a CROSS JOIN c WHERE work_context_access(c.j,a.workspace_id,'techprojects.alerts','view','{}') AND (a.project_id IS NULL OR work_record_context_access(c.j,'techprojects.projects',a.project_id,'view')) AND (a.deal_id IS NULL OR work_deal_context_access(c.j,a.deal_id,'view')) $$;
CREATE OR REPLACE FUNCTION public.project_alert_can_act(p_alert uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH c AS MATERIALIZED(SELECT work_access_context()j)
 SELECT EXISTS(SELECT 1 FROM project_alerts a CROSS JOIN c WHERE a.id=p_alert AND work_context_access(c.j,a.workspace_id,'techprojects.alerts','manage','{}') AND work_context_access(c.j,a.workspace_id,'techprojects.alerts','view','{}') AND (a.project_id IS NULL OR work_record_context_access(c.j,'techprojects.projects',a.project_id,'view')) AND (a.deal_id IS NULL OR work_deal_context_access(c.j,a.deal_id,'view'))) $$;
CREATE OR REPLACE FUNCTION public.project_dash_ds_cost(f jsonb)
 RETURNS TABLE(project_id uuid, user_id uuid, entry_date date, n integer, secs numeric, cost_status text, m text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_work_ctx jsonb:=work_access_context();v_ws uuid := (f->>'ws')::uuid; v_cur text := coalesce(nullif(f->>'currency', ''), 'BRL');
BEGIN
  IF v_ws IS DISTINCT FROM public.project_dash_ws() THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(v_ws, false);
  IF NOT (public.user_has_permission(auth.uid(), v_ws, 'techprojects.rates.view.workspace')
          OR public.user_has_permission(auth.uid(), v_ws, 'techprojects.profitability.view.workspace')) THEN
    RAISE EXCEPTION 'Sem permissão para ver a cobertura de custo.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH g AS (
    SELECT e.project_id, e.user_id, e.entry_date, count(*)::int AS n,
           sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))) AS s
      FROM public.project_time_entries e LEFT JOIN public.projects pr ON pr.id = e.project_id
     WHERE e.workspace_id = v_ws AND work_context_access(v_work_ctx,e.workspace_id,'techprojects.projects','view',ARRAY[coalesce(pr.assigned_to,pr.owner_id)]) AND e.entry_date BETWEEN (f->>'from')::date AND (f->>'to')::date AND e.status <> 'rejected'
       AND (nullif(f->>'project', '') IS NULL OR e.project_id = (f->>'project')::uuid)
       AND (nullif(f->>'company', '') IS NULL OR pr.company_id = (f->>'company')::uuid)
       AND (nullif(f->>'service', '') IS NULL OR pr.service_id = (f->>'service')::uuid)
       AND (nullif(f->>'person', '') IS NULL OR e.user_id = (f->>'person')::uuid)
       AND (nullif(f->>'leader', '') IS NULL OR e.project_id IN (SELECT public.project_dash_leader_projects(v_ws, (f->>'leader')::uuid)))
     GROUP BY 1, 2, 3)
  SELECT g.project_id, g.user_id, g.entry_date, g.n, g.s, r.status,
         ARRAY['all', CASE WHEN r.status IN ('found','monthly') THEN 'cost_known' WHEN r.status = 'ambiguous' THEN 'cost_ambiguous' ELSE 'cost_missing' END]
    FROM g CROSS JOIN LATERAL public.project_rate_pick(v_ws, 'cost', v_cur, g.entry_date, g.project_id, g.user_id) r;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_profitability(p_ws uuid, p_project uuid, p_contract uuid, p_from date, p_to date, p_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_work_ctx jsonb:=work_access_context();v_rates boolean; v_cur text := upper(btrim(coalesce(p_currency, ''))); v_eff jsonb; v_mc jsonb; v_rev jsonb; v_fin jsonb;
  v_cost_act numeric; v_people jsonb; v_projects jsonb; v_months jsonb; v_other jsonb; v_recon int; v_unattr numeric; v_shared jsonb;
  v_rev_appr numeric; v_cost_est numeric; v_cov numeric; v_total bigint; v_covered bigint; v_margin numeric;
  v_pr_id uuid; v_pr_contract uuid; v_pr_service uuid;
BEGIN
  PERFORM public.project_bill_assert(p_ws, false, 'techprojects.profitability.view.workspace');
  IF p_project IS NOT NULL AND NOT work_record_context_access(v_work_ctx,'techprojects.projects',p_project,'view') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF;IF p_contract IS NOT NULL AND NOT work_record_context_access(v_work_ctx,'techcontracts.contracts',p_contract,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
  IF (p_project IS NULL) = (p_contract IS NULL) THEN RAISE EXCEPTION 'Informe projeto ou contrato.'; END IF;
  IF p_project IS NOT NULL THEN
    SELECT id, contract_id, service_id INTO v_pr_id, v_pr_contract, v_pr_service FROM public.projects WHERE id = p_project AND workspace_id = p_ws;
    IF v_pr_id IS NULL THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contracts WHERE id = p_contract AND workspace_id = p_ws) THEN
    RAISE EXCEPTION 'Contrato fora do workspace.';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from <> date_trunc('month', p_from)::date
     OR p_to <> (date_trunc('month', p_to) + interval '1 month - 1 day')::date OR p_to < p_from OR p_to - p_from > 366 THEN
    RAISE EXCEPTION 'Período em meses completos, até 12 meses.'; END IF;
  IF v_cur !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Moeda inválida.'; END IF;
  v_rates := public.user_has_permission(auth.uid(), p_ws, 'techprojects.rates.view.workspace');

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.c4_scope (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE pg_temp.c4_scope;
  INSERT INTO pg_temp.c4_scope SELECT p.id FROM public.projects p WHERE p.workspace_id = p_ws
     AND (p.id = p_project OR (p_contract IS NOT NULL AND (p.contract_id = p_contract
          OR p.service_id IN (SELECT s.id FROM public.services s WHERE s.contract_id = p_contract AND s.workspace_id = p_ws))));

  IF EXISTS(SELECT 1 FROM projects p JOIN pg_temp.c4_scope s ON s.id=p.id WHERE NOT work_context_access(v_work_ctx,p.workspace_id,'techprojects.projects','view',ARRAY[coalesce(p.assigned_to,p.owner_id)])) THEN RAISE EXCEPTION 'Sem acesso ao conjunto completo de projetos deste contrato. Consulte um projeto autorizado ou revise o escopo.' USING ERRCODE='42501';END IF;
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.c4_entries (id uuid, user_id uuid, project_id uuid, entry_date date, status text, source text,
    billable boolean, person_id uuid, secs bigint, cst text, crate uuid, camt numeric, cscope text, pst text, pamt numeric, covered boolean, cost numeric) ON COMMIT DROP;
  TRUNCATE pg_temp.c4_entries;
  INSERT INTO pg_temp.c4_entries
  SELECT t.id, t.user_id, t.project_id, t.entry_date, t.status, t.source, coalesce(t.billable, false), t.person_id,
         coalesce(t.duration_seconds, round(public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)))::bigint,
         c.status, c.rate_id, c.amount, c.scope, pr.status, pr.amount, false, NULL
    FROM public.project_time_entries t
    LEFT JOIN LATERAL public.project_rate_pick(p_ws, 'cost', v_cur, t.entry_date, t.project_id, t.user_id) c ON true
    LEFT JOIN LATERAL public.project_rate_pick(p_ws, 'price', v_cur, t.entry_date, t.project_id, t.user_id) pr ON true
   WHERE t.workspace_id = p_ws AND t.project_id IN (SELECT id FROM pg_temp.c4_scope)
     AND t.entry_date BETWEEN p_from AND p_to AND t.status IS DISTINCT FROM 'rejected';
  -- Custo mensal só cobre a hora se a alocação é deste escopo (projeto) — senão não é atribuível.
  UPDATE pg_temp.c4_entries e SET covered = CASE
      WHEN e.cst = 'found' THEN true
      WHEN e.cst = 'monthly' AND e.cscope = 'allocation' THEN EXISTS (SELECT 1 FROM public.project_rates r JOIN public.people_allocations a ON a.id = r.allocation_id
             WHERE r.id = e.crate AND (a.project_id = e.project_id OR (p_contract IS NOT NULL AND a.service_id IN (SELECT s.id FROM public.services s WHERE s.contract_id = p_contract))))
      ELSE false END,
    cost = CASE WHEN e.cst = 'found' THEN e.secs::numeric * e.camt / 3600 ELSE 0 END
  WHERE true;

  SELECT jsonb_build_object(
      'total_seconds', coalesce(sum(secs), 0),
      'approved_seconds', coalesce(sum(secs) FILTER (WHERE status = 'approved'), 0),
      'pending_seconds', coalesce(sum(secs) FILTER (WHERE status IN ('draft','submitted')), 0),
      'imported_seconds', coalesce(sum(secs) FILTER (WHERE source = 'import' OR status = 'locked'), 0),
      'billable_seconds', coalesce(sum(secs) FILTER (WHERE billable), 0),
      'cost_covered_seconds', coalesce(sum(secs) FILTER (WHERE covered), 0),
      'cost_ambiguous_seconds', coalesce(sum(secs) FILTER (WHERE cst = 'ambiguous'), 0),
      'price_covered_seconds', coalesce(sum(secs) FILTER (WHERE pst = 'found'), 0),
      'person_linked_seconds', coalesce(sum(secs) FILTER (WHERE person_id IS NOT NULL), 0),
      'cost_hourly', round(coalesce(sum(cost), 0), 2),
      'partial_seconds', coalesce(sum(secs) FILTER (WHERE cst = 'found' AND pst = 'found' AND billable), 0),
      'partial_price_value', round(coalesce(sum(secs::numeric * pamt / 3600) FILTER (WHERE cst = 'found' AND pst = 'found' AND billable), 0), 2),
      'partial_cost', round(coalesce(sum(cost) FILTER (WHERE cst = 'found' AND pst = 'found' AND billable), 0), 2))
    INTO v_eff FROM pg_temp.c4_entries;

  -- Custo mensal alocado (sem converter para hora), por mês, com pró-rata declarada na tarifa.
  WITH months AS (SELECT g::date AS m0, (g + interval '1 month - 1 day')::date AS m1 FROM generate_series(p_from, p_to, interval '1 month') g),
  r AS (SELECT r.id, r.amount, r.proration, r.valid_from, r.valid_to, a.starts_at, a.ends_at FROM public.project_rates r
          JOIN public.people_allocations a ON a.id = r.allocation_id
         WHERE r.workspace_id = p_ws AND r.kind = 'cost' AND r.unit = 'month' AND r.currency = v_cur AND r.status = 'active'
           AND (a.project_id IN (SELECT id FROM pg_temp.c4_scope)
                OR (p_contract IS NOT NULL AND a.service_id IN (SELECT s.id FROM public.services s WHERE s.contract_id = p_contract)))),
  w AS (SELECT r.*, mo.m0, mo.m1,
          greatest(0, least(mo.m1, coalesce(r.valid_to - 1, mo.m1), coalesce(r.ends_at, mo.m1)) - greatest(mo.m0, r.valid_from, r.starts_at) + 1) AS days,
          (mo.m1 - mo.m0 + 1) AS mdays FROM r CROSS JOIN months mo)
  SELECT jsonb_build_object('amount', round(coalesce(sum(CASE WHEN w.days = 0 THEN 0 WHEN w.proration = 'full_month' THEN w.amount
                                                   ELSE w.amount * w.days / w.mdays END), 0), 2),
                            'rates', count(DISTINCT w.id))
    INTO v_mc FROM w;

  -- Receitas por situação (nunca somadas entre si).
  WITH ms AS (SELECT m.* FROM public.project_measurements m WHERE m.workspace_id = p_ws AND m.currency = v_cur
                 AND m.period_from BETWEEN p_from AND p_to
                 AND CASE WHEN p_contract IS NOT NULL THEN m.contract_id = p_contract
                     ELSE (m.service_id IS NOT NULL AND m.service_id = v_pr_service) OR (m.service_id IS NULL AND m.contract_id = v_pr_contract)
                       OR EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.measurement_id = m.id AND l.included AND l.project_id = p_project) END),
  val AS (SELECT ms.*, CASE WHEN p_contract IS NOT NULL THEN ms.total_amount
             ELSE (SELECT round(coalesce(sum(l.amount), 0), 2) FROM public.project_measurement_lines l
                    WHERE l.measurement_id = ms.id AND l.included AND l.project_id = p_project) END AS v,
             CASE WHEN p_contract IS NOT NULL THEN 0
             ELSE (SELECT round(coalesce(sum(l.amount), 0), 2) FROM public.project_measurement_lines l
                    WHERE l.measurement_id = ms.id AND l.included AND l.project_id IS NULL) END AS unattr,
             NOT EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.measurement_id = ms.id AND l.included
                           AND (l.project_id IS NULL OR l.project_id <> p_project)) AS exclusive
           FROM ms)
  SELECT jsonb_build_object(
      'forecast', round(coalesce(sum(v) FILTER (WHERE status IN ('draft','in_review')), 0), 2),
      'approved', round(coalesce(sum(v) FILTER (WHERE status IN ('approved','ready','generated','failed')), 0), 2),
      'reversed', round(coalesce(sum(v) FILTER (WHERE status = 'reversed'), 0), 2),
      'unknown_amount', count(*) FILTER (WHERE total_amount IS NULL AND status NOT IN ('cancelled','reversed')),
      'unattributed_approved', round(coalesce(sum(unattr) FILTER (WHERE status IN ('approved','ready','generated','failed')), 0), 2),
      'count', count(*) FILTER (WHERE status NOT IN ('cancelled'))),
    jsonb_build_object(
      'launched', round(coalesce((SELECT sum(fe.amount) FROM public.project_measurement_financial_links x JOIN public.financial_entries fe ON fe.id = x.financial_entry_id
          WHERE x.active AND x.measurement_id IN (SELECT id FROM val WHERE p_contract IS NOT NULL OR exclusive) AND fe.status::text <> 'cancelled' AND fe.currency = v_cur), 0), 2),
      'received', round(coalesce((SELECT sum(fe.paid_amount) FROM public.project_measurement_financial_links x JOIN public.financial_entries fe ON fe.id = x.financial_entry_id
          WHERE x.active AND x.measurement_id IN (SELECT id FROM val WHERE p_contract IS NOT NULL OR exclusive) AND fe.status::text <> 'cancelled' AND fe.currency = v_cur), 0), 2),
      'shared_measurements', count(*) FILTER (WHERE p_contract IS NULL AND NOT exclusive AND status IN ('generated')))
    INTO v_rev, v_fin FROM val;

  SELECT round(coalesce(sum(fe.amount), 0), 2) INTO v_cost_act FROM public.financial_entries fe
   WHERE fe.workspace_id = p_ws AND fe.direction::text = 'payable' AND fe.status::text <> 'cancelled' AND fe.currency = v_cur
     AND fe.competence_date BETWEEN p_from AND p_to
     AND (fe.project_id IN (SELECT id FROM pg_temp.c4_scope) OR (p_contract IS NOT NULL AND fe.contract_id = p_contract));

  SELECT coalesce(jsonb_agg(DISTINCT x.cur), '[]'::jsonb) INTO v_other FROM (
    SELECT m.currency AS cur FROM public.project_measurements m WHERE m.workspace_id = p_ws AND m.currency <> v_cur
       AND m.period_from BETWEEN p_from AND p_to AND (m.contract_id = coalesce(p_contract, v_pr_contract))
    UNION SELECT fe.currency FROM public.financial_entries fe WHERE fe.workspace_id = p_ws AND fe.currency <> v_cur AND fe.status::text <> 'cancelled'
       AND fe.competence_date BETWEEN p_from AND p_to AND (fe.project_id IN (SELECT id FROM pg_temp.c4_scope) OR (p_contract IS NOT NULL AND fe.contract_id = p_contract))
    UNION SELECT r.currency FROM public.project_rates r WHERE r.workspace_id = p_ws AND r.currency <> v_cur AND r.status = 'active') x;

  SELECT count(*) INTO v_recon FROM public.project_reconciliation_issues i
   WHERE i.workspace_id = p_ws AND i.status = 'open' AND i.project_id IN (SELECT id FROM pg_temp.c4_scope);

  SELECT coalesce(jsonb_agg(jsonb_build_object('month', mo, 'seconds', s, 'cost_hourly', c) ORDER BY mo), '[]'::jsonb)
    INTO v_months FROM (SELECT date_trunc('month', entry_date)::date mo, sum(secs) s, round(sum(cost), 2) c FROM pg_temp.c4_entries GROUP BY 1) q;

  IF v_rates THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', q.user_id, 'name', pf.full_name, 'seconds', q.s, 'covered_seconds', q.cs,
             'cost_hourly', q.c) ORDER BY q.s DESC), '[]'::jsonb)
      INTO v_people FROM (SELECT user_id, sum(secs) s, sum(secs) FILTER (WHERE covered) cs, round(sum(cost), 2) c FROM pg_temp.c4_entries GROUP BY 1) q
      LEFT JOIN public.profiles pf ON pf.id = q.user_id;
  END IF;
  IF p_contract IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('project_id', q.project_id, 'name', p.name, 'seconds', q.s, 'covered_seconds', q.cs) ORDER BY q.s DESC), '[]'::jsonb)
      INTO v_projects FROM (SELECT project_id, sum(secs) s, sum(secs) FILTER (WHERE covered) cs FROM pg_temp.c4_entries GROUP BY 1) q
      JOIN public.projects p ON p.id = q.project_id;
  END IF;

  v_total := (v_eff->>'total_seconds')::bigint;
  v_covered := (v_eff->>'cost_covered_seconds')::bigint;
  v_cost_est := (v_eff->>'cost_hourly')::numeric + (v_mc->>'amount')::numeric;
  v_rev_appr := (v_rev->>'approved')::numeric;
  v_cov := CASE WHEN v_total > 0 THEN round(v_covered::numeric * 100 / v_total, 2) END;
  v_margin := CASE WHEN v_total = v_covered THEN v_rev_appr - v_cost_est END;

  RETURN jsonb_build_object(
    'currency', v_cur, 'period_from', p_from, 'period_to', p_to, 'scope', CASE WHEN p_contract IS NOT NULL THEN 'contract' ELSE 'project' END,
    'can_view_rates', v_rates,
    'effort', v_eff - 'cost_hourly' - 'partial_cost' - 'partial_price_value',
    'revenue', v_rev, 'finance', v_fin,
    'cost', jsonb_build_object('estimated', round(v_cost_est, 2), 'hourly', (v_eff->>'cost_hourly')::numeric, 'monthly_allocated', v_mc->'amount',
       'monthly_rates', v_mc->'rates', 'actual_payables', v_cost_act),
    'coverage', jsonb_build_object('cost_pct', v_cov,
       'price_pct', CASE WHEN v_total > 0 THEN round((v_eff->>'price_covered_seconds')::numeric * 100 / v_total, 2) END,
       'person_link_pct', CASE WHEN v_total > 0 THEN round((v_eff->>'person_linked_seconds')::numeric * 100 / v_total, 2) END),
    'margin', jsonb_build_object(
       'estimated', v_margin,
       'estimated_pct', CASE WHEN v_margin IS NOT NULL AND v_rev_appr > 0 THEN round(v_margin * 100 / v_rev_appr, 2) END,
       'status', CASE WHEN v_margin IS NULL THEN 'unknown' ELSE 'complete' END,
       'partial_hours', jsonb_build_object('seconds', v_eff->'partial_seconds', 'price_value', v_eff->'partial_price_value',
          'cost', v_eff->'partial_cost', 'margin', (v_eff->>'partial_price_value')::numeric - (v_eff->>'partial_cost')::numeric,
          'margin_pct', CASE WHEN (v_eff->>'partial_price_value')::numeric > 0
             THEN round(((v_eff->>'partial_price_value')::numeric - (v_eff->>'partial_cost')::numeric) * 100 / (v_eff->>'partial_price_value')::numeric, 2) END),
       'actual', v_rev_appr - v_cost_act,
       'actual_pct', CASE WHEN v_rev_appr > 0 THEN round((v_rev_appr - v_cost_act) * 100 / v_rev_appr, 2) END),
    'months', v_months, 'people', v_people, 'projects', v_projects,
    'other_currencies', v_other, 'reconciliation_open', v_recon);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_measurement_lock(p_id uuid, p_key text, p_statuses text[])
 RETURNS project_measurements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m public.project_measurements;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF m.id IS NOT NULL AND NOT work_record_access('techcontracts.contracts',m.contract_id,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medição não encontrada.'; END IF;
  PERFORM public.project_bill_assert(m.workspace_id, true, p_key);
  PERFORM pg_advisory_xact_lock(hashtext('project_measurement_cfg:' || m.config_id));
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id FOR UPDATE;
  IF p_statuses IS NOT NULL AND NOT m.status = ANY (p_statuses) THEN
    RAISE EXCEPTION 'Ação indisponível na situação atual (%).', m.status;
  END IF;
  RETURN m;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_measurement_build(p_cfg uuid, p_month date, p_kind text, p_tz text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.project_billing_configs; k public.contracts; v_from date; v_to date; v_id uuid; x public.project_measurements;
BEGIN
  SELECT * INTO c FROM public.project_billing_configs WHERE id = p_cfg;
  PERFORM work_area_authorize('techprojects.measurements','manage');
  IF c.id IS NOT NULL AND NOT work_record_access('techcontracts.contracts',c.contract_id,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Modelo de cobrança não encontrado.'; END IF;
  PERFORM public.project_bill_assert(c.workspace_id, true, 'techprojects.measurements.manage.workspace');
  IF p_month IS NULL THEN RAISE EXCEPTION 'Informe a competência.'; END IF;
  v_from := date_trunc('month', p_month)::date; v_to := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  IF c.status <> 'active' OR v_from < c.valid_from OR (c.valid_to IS NOT NULL AND v_from >= c.valid_to) THEN
    RAISE EXCEPTION 'Competência fora da vigência do modelo de cobrança.'; END IF;
  IF v_from > current_date THEN RAISE EXCEPTION 'Competência futura não pode ser medida.'; END IF;
  IF coalesce(p_kind, '') NOT IN ('regular','complement') THEN RAISE EXCEPTION 'Tipo de medição inválido.'; END IF;
  IF p_tz IS NULL OR NOT public.project_time_tz_valid(p_tz) THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_measurement_cfg:' || p_cfg));
  SELECT * INTO x FROM public.project_measurements WHERE config_id = p_cfg AND period_from = v_from AND kind = 'regular'
     AND status NOT IN ('cancelled','reversed');
  IF p_kind = 'regular' AND x.id IS NOT NULL THEN
    IF x.status = 'draft' THEN RETURN x.id; END IF;
    RAISE EXCEPTION 'Já existe medição desta competência (situação %); use complemento ou estorno.', x.status;
  END IF;
  IF p_kind = 'complement' THEN
    IF x.id IS NULL OR x.status NOT IN ('approved','ready','generated') THEN RAISE EXCEPTION 'Complemento exige medição regular aprovada ou gerada.'; END IF;
    IF c.model IN ('package','fixed_recurring','percent') THEN
      RAISE EXCEPTION 'Complemento deste modelo não é suportado neste ciclo; estorne e refaça a medição.'; END IF;
    IF EXISTS (SELECT 1 FROM public.project_measurements WHERE config_id = p_cfg AND period_from = v_from AND kind = 'complement'
                 AND status IN ('draft','in_review')) THEN RAISE EXCEPTION 'Já existe complemento em andamento nesta competência.'; END IF;
  END IF;
  SELECT * INTO k FROM public.contracts WHERE id = c.contract_id;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  INSERT INTO public.project_measurements (workspace_id, config_id, config_version, contract_id, service_id, company_id, model, currency,
      period_from, period_to, timezone, kind, created_by, rules_snapshot)
  VALUES (c.workspace_id, c.id, c.version, c.contract_id, c.service_id, k.counterparty_company_id, c.model, c.currency,
      v_from, v_to, p_tz, p_kind, auth.uid(),
      jsonb_build_object('policy', 'c4-v1', 'model', c.model, 'params', c.params, 'config_version', c.version, 'currency', c.currency,
        'rate_precedence', jsonb_build_array('monthly_cost', 'exception', 'allocation', 'service', 'person', 'catalog'),
        'imported_locked', 'excluded', 'rounding_scale', 2, 'conversion', 'none'))
  RETURNING id INTO v_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_fill(v_id);
  PERFORM public.project_measurement_recalc(v_id);
  PERFORM public.project_bill_log(c.workspace_id, 'measurement', v_id, 'created', NULL,
    jsonb_build_object('period', v_from, 'kind', p_kind, 'config_version', c.version));
  RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_measurement_generate(p_id uuid, p_hash text, p_due date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m public.project_measurements; k public.contracts; v_fe uuid; v_ref text; v_err text;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  PERFORM work_area_authorize('techprojects.measurements','view');
  IF m.id IS NOT NULL AND NOT work_record_access('techcontracts.contracts',m.contract_id,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medição não encontrada.'; END IF;
  IF m.status = 'generated' THEN
    PERFORM public.project_bill_assert(m.workspace_id, false, 'techprojects.measurements.view.workspace');
    RETURN jsonb_build_object('status', 'generated', 'financial_entry_id', m.financial_entry_id, 'idempotent', true);
  END IF;
  m := public.project_measurement_lock(p_id, 'techprojects.measurement_finance.create.workspace', ARRAY['ready','approved','failed','generated']);
  IF m.status = 'generated' THEN
    RETURN jsonb_build_object('status', 'generated', 'financial_entry_id', m.financial_entry_id, 'idempotent', true);
  END IF;
  IF NOT public.user_has_permission(auth.uid(), m.workspace_id, 'techfinance.entries.create.own') THEN
    RAISE EXCEPTION 'Sem permissão para criar títulos no Financeiro.' USING ERRCODE = '42501';
  END IF;
  IF p_due IS NULL THEN RAISE EXCEPTION 'Informe o vencimento.'; END IF;
  PERFORM public.project_measurement_assert_fresh(m, p_hash);
  IF m.service_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('project_billing_service:' || m.service_id || ':' || to_char(m.period_from, 'YYYY-MM')));
  END IF;
  PERFORM public.project_measurement_recalc(p_id);
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF jsonb_array_length(m.blockers) > 0 OR jsonb_array_length(m.gates) > 0 THEN
    RAISE EXCEPTION 'GENERATE_BLOCKED: %', (SELECT string_agg(x->>'code', ', ') FROM jsonb_array_elements(m.blockers || m.gates) x);
  END IF;
  SELECT * INTO k FROM public.contracts WHERE id = m.contract_id;
  v_ref := 'project_measurement:' || m.id || ':' || m.revision;
  PERFORM public.project_measurement_set(p_id, '{"attempt":true}');
  BEGIN
    INSERT INTO public.financial_entries (workspace_id, owner_id, direction, origin_type, origin_id, contract_id, service_id,
        counterparty_company_id, legal_entity_id, description, amount, currency, competence_date, due_date, status, external_ref, metadata, notes)
    VALUES (m.workspace_id, auth.uid(), 'receivable', 'project_measurement', m.id, m.contract_id, m.service_id,
        k.counterparty_company_id, k.contracting_legal_entity_id,
        'Medição ' || to_char(m.period_from, 'MM/YYYY') || ' — ' || coalesce(k.title, k.number, 'Contrato'),
        m.total_amount, m.currency, m.period_from, p_due, 'open', v_ref,
        jsonb_build_object('project_measurement_id', m.id, 'revision', m.revision, 'model', m.model, 'lines_hash', m.lines_hash,
          'period_from', m.period_from, 'period_to', m.period_to),
        'Título interno gerado pela medição. Não é nota fiscal, boleto nem cobrança enviada.')
    ON CONFLICT (workspace_id, external_ref) WHERE external_ref IS NOT NULL DO NOTHING
    RETURNING id INTO v_fe;
    IF v_fe IS NULL THEN
      SELECT id INTO v_fe FROM public.financial_entries WHERE workspace_id = m.workspace_id AND external_ref = v_ref;
    END IF;
    PERFORM set_config('app.project_billing_flow', 'on', true);
    INSERT INTO public.project_measurement_financial_links (workspace_id, measurement_id, financial_entry_id, kind, created_by)
    VALUES (m.workspace_id, m.id, v_fe, 'generated', auth.uid());
    PERFORM set_config('app.project_billing_flow', 'off', true);
    PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', 'generated', 'generated', true, 'financial_entry_id', v_fe));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', 'failed', 'failure', left(v_err, 500)));
    PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'generate_failed', NULL, jsonb_build_object('error', left(v_err, 500)));
    RETURN jsonb_build_object('status', 'failed', 'error', left(v_err, 500));
  END;
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'generated', NULL,
    jsonb_build_object('financial_entry_id', v_fe, 'amount', m.total_amount, 'due', p_due));
  RETURN jsonb_build_object('status', 'generated', 'financial_entry_id', v_fe);
END $function$
;

-- Billing actions require their source records, in addition to financial capability.
CREATE OR REPLACE FUNCTION public.project_bill_assert(p_ws uuid, p_write boolean, p_key text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, p_write);
  IF NOT public.user_has_permission(auth.uid(), p_ws, p_key) THEN
    RAISE EXCEPTION 'Sem permissão (%).', p_key USING ERRCODE = '42501';
  END IF;
 IF p_key LIKE 'techprojects.rates.%' THEN PERFORM work_area_authorize('techprojects.rates','view');
 ELSIF p_key LIKE 'techprojects.billing_config.%' THEN PERFORM work_area_authorize('techprojects.billing_config','view');
 ELSIF p_key LIKE 'techprojects.measurement%' THEN PERFORM work_area_authorize('techprojects.measurements','view');END IF;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_billing_config_save(p_ws uuid, p_contract uuid, p_service uuid, p_model text, p_params jsonb, p_valid_from date, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE k public.contracts; s public.services; v_err text; v_prev public.project_billing_configs; v_id uuid; v_legacy int;
BEGIN
 IF NOT work_record_access('techcontracts.contracts',p_contract,'view') OR (p_service IS NOT NULL AND NOT work_record_access('techservice.services',p_service,'view')) THEN RAISE EXCEPTION 'Origem da cobrança indisponível.' USING ERRCODE='42501';END IF;
  PERFORM public.project_bill_assert(p_ws, true, 'techprojects.billing_config.manage.workspace');
  SELECT * INTO k FROM public.contracts WHERE id = p_contract AND workspace_id = p_ws;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contrato fora do workspace.'; END IF;
  IF k.role::text <> 'provider' THEN RAISE EXCEPTION 'Medição só para contratos em que a empresa presta o serviço.'; END IF;
  IF k.currency IS NULL OR k.currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Contrato sem moeda definida.'; END IF;
  IF p_service IS NOT NULL THEN
    SELECT * INTO s FROM public.services WHERE id = p_service AND workspace_id = p_ws;
    IF s.id IS NULL OR s.contract_id <> p_contract THEN RAISE EXCEPTION 'Serviço não pertence a este contrato.'; END IF;
    IF s.currency IS DISTINCT FROM k.currency THEN RAISE EXCEPTION 'Moeda do serviço difere da do contrato; não há conversão.'; END IF;
  END IF;
  IF p_model NOT IN ('per_hour','fixed_recurring','package','milestone','percent') THEN RAISE EXCEPTION 'Modelo inválido.'; END IF;
  v_err := public.project_billing_params_check(p_model, coalesce(p_params, '{}'::jsonb));
  IF v_err IS NOT NULL THEN RAISE EXCEPTION '%', v_err; END IF;
  IF p_model = 'fixed_recurring' AND p_params->>'amount_source' = 'service' AND p_service IS NULL THEN RAISE EXCEPTION 'Valor do serviço exige escolher o serviço.'; END IF;
  IF p_model = 'percent' AND p_service IS NULL THEN RAISE EXCEPTION 'Percentual exige o serviço contratado.'; END IF;
  IF p_model = 'percent' AND NOT p_params ? 'percent' AND s.percent IS NULL THEN RAISE EXCEPTION 'Percentual não definido no serviço nem na configuração.'; END IF;
  IF p_valid_from IS NULL OR p_valid_from <> date_trunc('month', p_valid_from)::date THEN RAISE EXCEPTION 'A vigência começa no primeiro dia de um mês.'; END IF;
  IF p_valid_from < date_trunc('month', current_date)::date THEN RAISE EXCEPTION 'Sem retroatividade: a vigência começa no mês corrente ou depois.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo (mín. 10 caracteres).'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_billing_config:' || p_contract));
  -- Uma configuração ativa por escopo e período; configuração do contrato inteiro não convive com a de um serviço dele.
  SELECT * INTO v_prev FROM public.project_billing_configs c WHERE c.contract_id = p_contract AND c.status = 'active'
     AND c.service_id IS NOT DISTINCT FROM p_service AND c.valid_from < p_valid_from AND c.valid_to IS NULL
   ORDER BY c.valid_from DESC LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.project_billing_configs c WHERE c.contract_id = p_contract AND c.status = 'active'
       AND c.id IS DISTINCT FROM v_prev.id
       AND (c.service_id IS NOT DISTINCT FROM p_service OR c.service_id IS NULL OR p_service IS NULL)
       AND daterange(c.valid_from, c.valid_to) && daterange(p_valid_from, NULL)) THEN
    RAISE EXCEPTION 'CONFIG_OVERLAP: já existe modelo de cobrança vigente que cobre este escopo e período.';
  END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  IF v_prev.id IS NOT NULL THEN
    UPDATE public.project_billing_configs SET valid_to = p_valid_from WHERE id = v_prev.id;
  END IF;
  INSERT INTO public.project_billing_configs (workspace_id, contract_id, service_id, model, currency, params, valid_from, version, supersedes_id, reason, created_by)
  VALUES (p_ws, p_contract, p_service, p_model, k.currency, coalesce(p_params, '{}'::jsonb), p_valid_from,
          coalesce(v_prev.version, 0) + 1, v_prev.id, btrim(p_reason), auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  SELECT count(*) INTO v_legacy FROM public.financial_entries fe
   WHERE fe.workspace_id = p_ws AND p_service IS NOT NULL AND fe.service_id = p_service AND fe.competence_date >= p_valid_from
     AND fe.status::text <> 'cancelled';
  PERFORM public.project_bill_log(p_ws, 'billing_config', v_id, 'activated', p_reason,
    jsonb_build_object('model', p_model, 'service_id', p_service, 'valid_from', p_valid_from, 'supersedes', v_prev.id,
      'legacy_service_entries_from_valid_from', v_legacy,
      'legacy_tick_active', s.id IS NOT NULL AND s.status::text = 'active' AND s.type::text = 'recurring' AND s.next_billing_at IS NOT NULL));
  RETURN jsonb_build_object('id', v_id, 'version', coalesce(v_prev.version, 0) + 1, 'legacy_entries', v_legacy);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_billing_config_end(p_id uuid, p_end date, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.project_billing_configs;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM project_billing_configs cfg WHERE cfg.id=p_id AND work_record_access('techcontracts.contracts',cfg.contract_id,'view')) THEN RAISE EXCEPTION 'Configuração indisponível.' USING ERRCODE='42501';END IF;
  SELECT * INTO c FROM public.project_billing_configs WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Configuração não encontrada.'; END IF;
  PERFORM public.project_bill_assert(c.workspace_id, true, 'techprojects.billing_config.manage.workspace');
  IF p_end IS NULL OR p_end <> date_trunc('month', p_end)::date OR p_end <= c.valid_from OR (c.valid_to IS NOT NULL AND p_end >= c.valid_to) THEN
    RAISE EXCEPTION 'O fim é o primeiro dia de um mês dentro da vigência.'; END IF;
  IF p_end < date_trunc('month', current_date)::date THEN RAISE EXCEPTION 'Sem retroatividade.'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_measurements m WHERE m.config_id = p_id AND m.period_from >= p_end AND m.status NOT IN ('cancelled','reversed')) THEN
    RAISE EXCEPTION 'Há medições após a data; cancele ou estorne antes.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo (mín. 10 caracteres).'; END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_billing_configs SET valid_to = p_end WHERE id = p_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_bill_log(c.workspace_id, 'billing_config', p_id, 'ended', p_reason, jsonb_build_object('end', p_end));
END $function$
;
CREATE OR REPLACE FUNCTION public.project_rate_target_key(p_ws uuid, p_scope text, p_target jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v uuid; v2 uuid;
BEGIN
 IF p_scope='exception' AND NOT work_record_access('techprojects.projects',nullif(p_target->>'project_id','')::uuid,'view') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';
 ELSIF p_scope='service' AND NOT work_record_access('techservice.services',nullif(p_target->>'service_id','')::uuid,'view') THEN RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE='42501';
 ELSIF p_scope='allocation' AND NOT hr_record_access('allocations','view',nullif(p_target->>'allocation_id','')::uuid) THEN RAISE EXCEPTION 'Alocação indisponível.' USING ERRCODE='42501';
 ELSIF p_scope='person' AND NOT hr_record_access('people','view',nullif(p_target->>'person_id','')::uuid) THEN RAISE EXCEPTION 'Pessoa indisponível.' USING ERRCODE='42501';
 ELSIF p_scope='catalog' AND NOT work_catalog_service_access(nullif(p_target->>'service_catalog_id','')::uuid) THEN RAISE EXCEPTION 'Serviço do catálogo indisponível.' USING ERRCODE='42501';END IF;
  IF p_scope = 'exception' THEN
    v := nullif(p_target->>'project_id', '')::uuid; v2 := nullif(p_target->>'user_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = p_ws AND user_id = v2) THEN RAISE EXCEPTION 'Pessoa fora do workspace.'; END IF;
    IF NOT coalesce((p_target->>'confirm_exception')::boolean, false) THEN RAISE EXCEPTION 'Exceção específica exige confirmação explícita.'; END IF;
    RETURN v::text || ':' || v2::text;
  ELSIF p_scope = 'allocation' THEN
    v := nullif(p_target->>'allocation_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.people_allocations WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Alocação fora do workspace.'; END IF;
  ELSIF p_scope = 'service' THEN
    v := nullif(p_target->>'service_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Serviço fora do workspace.'; END IF;
  ELSIF p_scope = 'person' THEN
    v := nullif(p_target->>'person_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Pessoa fora do workspace.'; END IF;
  ELSIF p_scope = 'catalog' THEN
    v := nullif(p_target->>'service_catalog_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.service_catalog WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Serviço do catálogo fora do workspace.'; END IF;
  ELSE RAISE EXCEPTION 'Escopo inválido.';
  END IF;
  RETURN v::text;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_rate_end(p_rate uuid, p_end date, p_reason text, p_confirm_retroactive boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.project_rates;
BEGIN
  SELECT * INTO r FROM public.project_rates WHERE id = p_rate FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Tarifa não encontrada.'; END IF;
 PERFORM project_rate_target_key(r.workspace_id,r.scope,jsonb_build_object('project_id',r.project_id,'user_id',r.user_id,'allocation_id',r.allocation_id,'service_id',r.service_id,'person_id',r.person_id,'service_catalog_id',r.service_catalog_id,'confirm_exception',true));
  PERFORM public.project_bill_assert(r.workspace_id, true, 'techprojects.rates.manage.workspace');
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo (mín. 5 caracteres).'; END IF;
  IF p_end IS NULL OR p_end <= r.valid_from OR (r.valid_to IS NOT NULL AND p_end >= r.valid_to) THEN
    RAISE EXCEPTION 'O fim precisa estar dentro da vigência atual.';
  END IF;
  IF p_end < date_trunc('month', current_date)::date AND NOT coalesce(p_confirm_retroactive, false) THEN
    RAISE EXCEPTION 'RETROACTIVE_CONFIRM: encerramento retroativo exige prévia de impacto e confirmação explícita.';
  END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_rates SET valid_to = p_end WHERE id = r.id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_bill_log(r.workspace_id, 'rate', r.id, 'ended', p_reason, jsonb_build_object('end', p_end, 'previous_end', r.valid_to));
END $function$
;
CREATE OR REPLACE FUNCTION public.project_rate_split(p_rate uuid, p_effective date, p_amount numeric, p_reason text, p_confirm_retroactive boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.project_rates; v_id uuid;
BEGIN
  SELECT * INTO r FROM public.project_rates WHERE id = p_rate FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Tarifa não encontrada.'; END IF;
 PERFORM project_rate_target_key(r.workspace_id,r.scope,jsonb_build_object('project_id',r.project_id,'user_id',r.user_id,'allocation_id',r.allocation_id,'service_id',r.service_id,'person_id',r.person_id,'service_catalog_id',r.service_catalog_id,'confirm_exception',true));
  PERFORM public.project_bill_assert(r.workspace_id, true, 'techprojects.rates.manage.workspace');
  IF r.status <> 'active' THEN RAISE EXCEPTION 'Tarifa encerrada.'; END IF;
  IF p_amount IS NULL THEN RAISE EXCEPTION 'Informe o novo valor.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo (mín. 5 caracteres).'; END IF;
  IF p_effective IS NULL OR p_effective <= r.valid_from OR (r.valid_to IS NOT NULL AND p_effective >= r.valid_to) THEN
    RAISE EXCEPTION 'A data da mudança precisa estar dentro da vigência atual.';
  END IF;
  IF p_effective < date_trunc('month', current_date)::date AND NOT coalesce(p_confirm_retroactive, false) THEN
    RAISE EXCEPTION 'RETROACTIVE_CONFIRM: mudança retroativa exige prévia de impacto e confirmação explícita.';
  END IF;
  PERFORM public.project_rate_assert_free(r.workspace_id, r.kind, r.scope, public.project_rate_key_of(r), r.unit, r.currency,
    p_effective, r.valid_to, r.id);
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_rates SET valid_to = p_effective WHERE id = r.id;
  INSERT INTO public.project_rates (workspace_id, kind, scope, project_id, user_id, allocation_id, service_id, person_id,
      service_catalog_id, unit, proration, currency, amount, valid_from, valid_to, version, supersedes_id, reason, confirmed_by, created_by)
  VALUES (r.workspace_id, r.kind, r.scope, r.project_id, r.user_id, r.allocation_id, r.service_id, r.person_id,
      r.service_catalog_id, r.unit, r.proration, r.currency, p_amount, p_effective, r.valid_to, r.version + 1, r.id, btrim(p_reason),
      CASE WHEN r.scope = 'exception' THEN auth.uid() END, auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_bill_log(r.workspace_id, 'rate', r.id, 'split', p_reason,
    jsonb_build_object('new_rate', v_id, 'effective', p_effective, 'old_amount', r.amount, 'new_amount', p_amount));
  RETURN v_id;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_rate_impact(p_ws uuid, p_scope text, p_target jsonb, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb; v_proj uuid := nullif(p_target->>'project_id','')::uuid; v_user uuid := nullif(p_target->>'user_id','')::uuid;
  v_alloc uuid := nullif(p_target->>'allocation_id','')::uuid; v_svc uuid := nullif(p_target->>'service_id','')::uuid;
  v_person uuid := nullif(p_target->>'person_id','')::uuid; v_cat uuid := nullif(p_target->>'service_catalog_id','')::uuid;
BEGIN
  PERFORM public.project_bill_assert(p_ws, false, 'techprojects.rates.view.workspace');
  PERFORM project_rate_target_key(p_ws,p_scope,p_target||jsonb_build_object('confirm_exception',true));
  IF p_from IS NULL THEN RAISE EXCEPTION 'Informe o início.'; END IF;
  WITH e AS (
    SELECT t.id, coalesce(t.duration_seconds, round(public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)))::bigint AS secs
      FROM public.project_time_entries t JOIN public.projects p ON p.id = t.project_id
     WHERE t.workspace_id = p_ws AND t.entry_date >= p_from AND (p_to IS NULL OR t.entry_date < p_to)
       AND CASE p_scope
         WHEN 'exception' THEN t.project_id = v_proj AND t.user_id = v_user
         WHEN 'allocation' THEN EXISTS (SELECT 1 FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
              WHERE a.id = v_alloc AND pe.profile_id = t.user_id AND (a.project_id = t.project_id OR a.service_id = p.service_id)
                AND a.starts_at <= t.entry_date AND (a.ends_at IS NULL OR a.ends_at >= t.entry_date))
         WHEN 'service' THEN p.service_id = v_svc
         WHEN 'person' THEN EXISTS (SELECT 1 FROM public.people pe WHERE pe.id = v_person AND pe.profile_id = t.user_id)
         ELSE EXISTS (SELECT 1 FROM public.deal_line_items li WHERE li.id = p.source_line_item_id AND li.service_catalog_id = v_cat) END)
  SELECT jsonb_build_object(
    'entries', (SELECT count(*) FROM e),
    'seconds', coalesce((SELECT sum(secs) FROM e), 0),
    'measured_non_draft', (SELECT count(DISTINCT l.measurement_id) FROM public.project_measurement_lines l
        JOIN public.project_measurements m ON m.id = l.measurement_id
       WHERE l.active AND l.source_type = 'time_entry' AND l.source_id IN (SELECT id FROM e) AND m.status <> 'draft'),
    'measured_draft', (SELECT count(DISTINCT l.measurement_id) FROM public.project_measurement_lines l
        JOIN public.project_measurements m ON m.id = l.measurement_id
       WHERE l.active AND l.source_type = 'time_entry' AND l.source_id IN (SELECT id FROM e) AND m.status = 'draft'),
    'retroactive', p_from < date_trunc('month', current_date)::date) INTO v;
  RETURN v;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_rate_legacy_candidates(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c jsonb:=work_access_context();v jsonb;
BEGIN
  PERFORM public.project_bill_assert(p_ws, false, 'techprojects.rates.view.workspace');
  SELECT jsonb_build_object(
    'project_members', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', m.project_id, 'project_name', p.name, 'user_id', m.user_id,
        'user_name', pr.full_name, 'cost_rate_hour', m.cost_rate_hour, 'bill_rate_hour', m.bill_rate_hour) ORDER BY p.name)
      FROM public.project_members m JOIN public.projects p ON p.id = m.project_id LEFT JOIN public.profiles pr ON pr.id = m.user_id
     WHERE m.workspace_id = p_ws AND work_record_context_access(c,'techprojects.members',m.id,'view') AND (m.cost_rate_hour IS NOT NULL OR m.bill_rate_hour IS NOT NULL)), '[]'::jsonb),
    'allocations', coalesce((SELECT jsonb_agg(jsonb_build_object('allocation_id', a.id, 'person_name', pe.full_name, 'project_id', a.project_id,
        'service_id', a.service_id, 'cost_rate', a.cost_rate, 'billable_rate', a.billable_rate, 'currency', a.currency,
        'starts_at', a.starts_at, 'ends_at', a.ends_at) ORDER BY pe.full_name)
      FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
     WHERE a.workspace_id = p_ws AND (a.cost_rate IS NOT NULL OR a.billable_rate IS NOT NULL) AND public.hr_private_row_allowed('allocations_financial','view',to_jsonb(a),false)), '[]'::jsonb),
    'services', coalesce((SELECT jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'unit', s.unit, 'billing_model', s.billing_model,
        'unit_price', s.unit_price, 'quantity', s.quantity, 'currency', s.currency, 'type', s.type, 'status', s.status) ORDER BY s.name)
      FROM public.services s WHERE s.workspace_id = p_ws AND work_record_context_access(c,'techservice.services',s.id,'view')), '[]'::jsonb)) INTO v;
  RETURN v;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_delivery_template_apply(p_project uuid, p_version uuid, p_confirm_imported boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record; v record; e jsonb; v_ms int := 0; v_tk int := 0; v_n int; v_prefix text; v_base date;
BEGIN PERFORM work_area_authorize('techprojects.delivery_templates','manage');IF NOT work_record_access('techprojects.projects',p_project,'update') THEN RAISE EXCEPTION 'Projeto indisponível.' USING ERRCODE='42501';END IF;
  SELECT id, workspace_id, delivery_template_version_id, starts_at INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(p.workspace_id, true);
  IF NOT public.project_editable_by_current_user(p_project) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este projeto.' USING ERRCODE = '42501';
  END IF;
  SELECT tv.id, tv.version, tv.definition, t.name, t.delivery_kind, t.active INTO v
    FROM public.project_delivery_template_versions tv JOIN public.project_delivery_templates t ON t.id = tv.template_id
   WHERE tv.id = p_version AND tv.workspace_id = p.workspace_id;
  IF v.id IS NULL OR NOT v.active THEN RAISE EXCEPTION 'Modelo inexistente ou inativo neste workspace.'; END IF;
  IF p.delivery_template_version_id IS NOT NULL THEN
    IF p.delivery_template_version_id = p_version THEN RETURN jsonb_build_object('already_applied', true, 'milestones', 0, 'tasks', 0); END IF;
    RAISE EXCEPTION 'Este projeto já tem outro modelo aplicado; a troca não é automática.';
  END IF;
  IF NOT coalesce(p_confirm_imported, false) AND EXISTS (SELECT 1 FROM public.project_time_entries WHERE project_id = p_project AND source = 'import') THEN
    RAISE EXCEPTION 'Projeto com horas importadas: confirme explicitamente para aplicar o modelo.' USING ERRCODE = 'P0001';
  END IF;
 IF jsonb_array_length(coalesce(v.definition->'tasks','[]'))>0 AND NOT work_context_access(work_access_context(),p.workspace_id,'techprojects.tasks','create','{}') THEN RAISE EXCEPTION 'O modelo cria tarefas sem responsável e exige criação de tarefas no workspace.' USING ERRCODE='42501';END IF;
 IF jsonb_array_length(coalesce(v.definition->'milestones','[]'))>0 AND NOT work_context_access(work_access_context(),p.workspace_id,'techprojects.milestones','create','{}') THEN RAISE EXCEPTION 'O modelo cria marcos sem responsável e exige criação de marcos no workspace.' USING ERRCODE='42501';END IF;
  v_prefix := 'tpl:' || v.id::text || ':';
  v_base := coalesce(p.starts_at, current_date);
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(v.definition->'milestones', '[]'::jsonb)) LOOP
    INSERT INTO public.project_milestones (workspace_id, project_id, name, description, due_at, status, sort_order, template_item_key)
    VALUES (p.workspace_id, p_project, btrim(e->>'name'), e->>'description',
            CASE WHEN (e->>'offset_days') ~ '^\d{1,4}$' THEN v_base + (e->>'offset_days')::int END,
            'pending', coalesce((e->>'order')::int, v_ms), v_prefix || (e->>'key'))
    ON CONFLICT (project_id, template_item_key) WHERE template_item_key IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ms := v_ms + v_n;
  END LOOP;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(v.definition->'tasks', '[]'::jsonb)) LOOP
    INSERT INTO public.project_tasks (workspace_id, project_id, title, description, status, estimated_hours, milestone_id, sort_order, template_item_key)
    VALUES (p.workspace_id, p_project, btrim(e->>'title'), e->>'description', 'todo',
            CASE WHEN (e->>'estimated_hours') ~ '^\d+(\.\d+)?$' THEN (e->>'estimated_hours')::numeric END,
            (SELECT m.id FROM public.project_milestones m WHERE m.project_id = p_project AND m.template_item_key = v_prefix || (e->>'milestone_key')),
            coalesce((e->>'order')::int, v_tk), v_prefix || (e->>'key'))
    ON CONFLICT (project_id, template_item_key) WHERE template_item_key IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_tk := v_tk + v_n;
  END LOOP;
  UPDATE public.projects SET delivery_template_version_id = p_version, delivery_template_applied_at = now(),
         delivery_template_applied_by = auth.uid(),
         client_acceptance_required = client_acceptance_required OR coalesce((v.definition->>'client_acceptance')::boolean, false)
   WHERE id = p_project;
  PERFORM public.project_time_log(p.workspace_id, 'project', p_project, 'delivery_template_applied', NULL, p_project, NULL,
    jsonb_build_object('version_id', p_version, 'template', v.name, 'version', v.version, 'milestones', v_ms, 'tasks', v_tk));
  RETURN jsonb_build_object('already_applied', false, 'milestones', v_ms, 'tasks', v_tk);
END $function$
;
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='contract_link_ai_suggestions' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON contract_link_ai_suggestions',p.policyname);END LOOP;END $$;
CREATE POLICY work_contract_suggestion_view ON contract_link_ai_suggestions FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techcontracts.links','view','{}') AND work_record_access('techcontracts.contracts',pending_contract_id,'view') AND work_record_access('techcontracts.contracts',target_contract_id,'view'));
CREATE POLICY work_contract_suggestion_create ON contract_link_ai_suggestions FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND work_context_access((SELECT work_access_context()),workspace_id,'techcontracts.links','manage','{}') AND work_record_access('techcontracts.contracts',pending_contract_id,'update') AND work_record_access('techcontracts.contracts',target_contract_id,'view'));
CREATE POLICY work_contract_suggestion_decide ON contract_link_ai_suggestions FOR UPDATE TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,'techcontracts.links','manage','{}') AND work_record_access('techcontracts.contracts',pending_contract_id,'update') AND work_record_access('techcontracts.contracts',target_contract_id,'view')) WITH CHECK(work_context_access((SELECT work_access_context()),workspace_id,'techcontracts.links','manage','{}') AND work_record_access('techcontracts.contracts',pending_contract_id,'update') AND work_record_access('techcontracts.contracts',target_contract_id,'view'));
REVOKE DELETE ON contract_link_ai_suggestions FROM authenticated;
DO $$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_time_entries' AND (permissive='PERMISSIVE' OR policyname IN('ptime_perm_delete','ptime_perm_select','ptime_perm_update','ptime_scope_select')) LOOP EXECUTE format('DROP POLICY %I ON project_time_entries',p.policyname);END LOOP;END $$;
CREATE POLICY work_time_view ON project_time_entries FOR SELECT TO authenticated USING(work_time_context_access((SELECT work_time_context()),workspace_id,project_id,user_id,'view'));
CREATE POLICY work_time_create ON project_time_entries FOR INSERT TO authenticated WITH CHECK(work_time_context_access((SELECT work_time_context()),workspace_id,project_id,user_id,'create'));
CREATE POLICY work_time_update ON project_time_entries FOR UPDATE TO authenticated USING(work_time_context_access((SELECT work_time_context()),workspace_id,project_id,user_id,'update')) WITH CHECK(work_time_context_access((SELECT work_time_context()),workspace_id,project_id,user_id,'update'));
CREATE POLICY work_time_delete ON project_time_entries FOR DELETE TO authenticated USING(work_time_context_access((SELECT work_time_context()),workspace_id,project_id,user_id,'delete'));
CREATE OR REPLACE FUNCTION public.project_time_full_scope_workspaces() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$WITH c AS MATERIALIZED(SELECT work_time_context()j) SELECT (j->>'workspace')::uuid FROM c WHERE j->'time_grants'?'view.workspace'$$;
CREATE OR REPLACE FUNCTION public.project_time_perm_workspaces(p_keys text[]) RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$WITH c AS MATERIALIZED(SELECT work_time_context()j) SELECT (j->>'workspace')::uuid FROM c WHERE EXISTS(SELECT 1 FROM unnest(p_keys)k WHERE j->'time_grants'?(split_part(k,'.',3)||'.'||split_part(k,'.',4)))$$;
CREATE OR REPLACE FUNCTION public.project_time_led_scope() RETURNS TABLE(project_id uuid,subject_user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$WITH c AS MATERIALIZED(SELECT work_time_context()j) SELECT l.project_id,l.subject_user_id FROM c CROSS JOIN LATERAL jsonb_to_recordset(c.j->'time_led')l(project_id uuid,subject_user_id uuid) WHERE c.j->'time_grants'?'view.team'$$;

-- Timer and approval assignments never substitute for a granted action.
CREATE OR REPLACE FUNCTION public.project_timer_start(p_ws uuid, p_project uuid, p_task uuid, p_description text, p_billable boolean, p_tz text, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_pol jsonb;
BEGIN
 IF NOT coalesce((work_time_context()->'time_grants') ?| ARRAY['create.own','create.team','create.workspace'],false) THEN RAISE EXCEPTION 'Sem permissão para usar o cronômetro.' USING ERRCODE='42501';END IF;
  PERFORM public.project_time_assert_actor(p_ws, true);
  IF p_request_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid AND client_request_id = p_request_id;
    IF v_id IS NOT NULL THEN RETURN public.project_timer_json(v_id) || jsonb_build_object('idempotent', true); END IF;
  END IF;
  SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid AND state IN ('running','paused');
  IF v_id IS NOT NULL THEN RETURN public.project_timer_json(v_id) || jsonb_build_object('conflict', true); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project AND workspace_id = p_ws AND status IN('planning','active')) THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
  IF p_task IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE id = p_task AND project_id = p_project) THEN
    RAISE EXCEPTION 'Atividade não pertence ao projeto.';
  END IF;
  IF NOT public.project_time_tz_valid(p_tz) OR p_tz IS NULL THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;
  v_pol := public.project_time_policy_resolve(p_ws);
  IF coalesce((v_pol->>'track_requires_link')::boolean, true)
     AND NOT public.project_time_can_track(v_uid, p_project, (now() AT TIME ZONE p_tz)::date) THEN
    RAISE EXCEPTION 'Profissional sem vínculo para apontar neste projeto (membro liberado ou alocação vigente).' USING ERRCODE = '42501';
  END IF;
  BEGIN
    INSERT INTO public.project_timer_sessions (workspace_id, user_id, project_id, task_id, description, billable, timezone,
           state, client_request_id, policy_version)
    VALUES (p_ws, v_uid, p_project, p_task, p_description, coalesce(p_billable, true), p_tz, 'running', p_request_id,
            (v_pol->>'version')::int)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid
       AND (state IN ('running','paused') OR client_request_id = p_request_id) ORDER BY created_at DESC LIMIT 1;
    RETURN public.project_timer_json(v_id) || jsonb_build_object('conflict', true);
  END;
  INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at)
  VALUES (p_ws, v_id, 'work', p_task, now());
  RETURN public.project_timer_json(v_id);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_timer_lock(p_session uuid)
 RETURNS project_timer_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.project_timer_sessions;
BEGIN
 IF NOT coalesce((work_time_context()->'time_grants') ?| ARRAY['create.own','create.team','create.workspace','update.own','update.team','update.workspace','delete.own','delete.workspace'],false) THEN RAISE EXCEPTION 'Sem permissão para usar o cronômetro.' USING ERRCODE='42501';END IF;
  SELECT * INTO s FROM public.project_timer_sessions WHERE id = p_session FOR UPDATE;
  IF s.id IS NULL OR s.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cronômetro não encontrado.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(s.workspace_id, true);
  RETURN s;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_timer_stop(p_session uuid, p_version integer, p_discard boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.project_timer_sessions; g record; v_now timestamptz := now(); v_s timestamptz; v_e timestamptz;
  v_day date; v_day_end timestamptz; v_part timestamptz; v_secs int; v_ls time; v_le time; v_flags text[];
BEGIN
  s := public.project_timer_lock(p_session);
  IF s.state IN ('stopped','discarded') THEN RETURN public.project_timer_json(s.id) || jsonb_build_object('idempotent', true); END IF;
  IF p_version IS NOT NULL AND p_version <> s.version THEN RAISE EXCEPTION 'TIMER_STALE: o cronômetro mudou em outra aba; atualize.'; END IF;
  UPDATE public.project_timer_segments SET ended_at = v_now WHERE session_id = s.id AND ended_at IS NULL;
  IF coalesce(p_discard, false) THEN
    UPDATE public.project_timer_sessions SET state = 'discarded', stopped_at = v_now, version = version + 1, updated_at = v_now WHERE id = s.id;
    PERFORM public.project_time_log(s.workspace_id, 'timer', s.id, 'discarded', s.user_id, s.project_id, NULL, '{}'::jsonb);
    RETURN public.project_timer_json(s.id);
  END IF;
  IF NOT coalesce((work_time_context()->'time_grants') ?| ARRAY['create.own','create.team','create.workspace'],false) THEN RAISE EXCEPTION 'Sem permissão para gravar horas.' USING ERRCODE='42501';END IF;
  PERFORM set_config('app.project_time_workflow', 'on', true);
  FOR g IN SELECT * FROM public.project_timer_segments WHERE session_id = s.id AND kind = 'work' ORDER BY started_at LOOP
    v_s := g.started_at; v_e := g.ended_at;
    WHILE v_s < v_e LOOP
      v_day := (v_s AT TIME ZONE s.timezone)::date;
      v_day_end := ((v_day + 1)::timestamp AT TIME ZONE s.timezone);
      v_part := least(v_e, v_day_end);
      v_secs := floor(EXTRACT(EPOCH FROM (v_part - v_s)))::int;
      IF v_secs >= 1 THEN
        v_ls := (v_s AT TIME ZONE s.timezone)::time;
        v_le := CASE WHEN v_part = v_day_end THEN '24:00:00'::time ELSE (v_part AT TIME ZONE s.timezone)::time END;
        v_flags := NULL;
        IF v_le <= v_ls THEN v_ls := NULL; v_le := NULL; v_flags := ARRAY['dst_ambiguous']; END IF;
        INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, start_time, end_time,
               duration_seconds, description, billable, source, status, started_at, stopped_at, entry_kind, timezone,
               timer_session_id, created_by, review_flags)
        VALUES (s.workspace_id, s.project_id, g.task_id, s.user_id, v_day, v_ls, v_le, v_secs, s.description, s.billable,
                'timer', 'draft', v_s, v_part, 'timer', s.timezone, s.id, s.user_id, v_flags);
      END IF;
      v_s := v_part;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.project_time_workflow', 'off', true);
  UPDATE public.project_timer_sessions SET state = 'stopped', stopped_at = v_now, version = version + 1, updated_at = v_now WHERE id = s.id;
  RETURN public.project_timer_json(s.id);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_time_can_approve(p_actor uuid, p_project uuid, p_subject uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_pol jsonb;c jsonb;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = p_project;
  IF v_ws IS NULL OR p_actor IS NULL OR NOT public.is_workspace_member(v_ws, p_actor) THEN RETURN false; END IF;
  c:=work_time_context_from(work_subject_context(v_ws,p_actor));IF NOT coalesce(c->'time_grants'?'approve.workspace',false) THEN RETURN false;END IF;
  IF p_subject IS NOT NULL AND NOT work_time_context_access(c,v_ws,p_project,p_subject,'view') THEN RETURN false;END IF;
  IF public.project_time_denied(p_actor, v_ws, 'techprojects.time_entries.approve.workspace')
     OR public.project_time_denied(p_actor, v_ws, 'techprojects.timesheet.approve.workspace') THEN RETURN false; END IF;
  SELECT public.project_time_policy_defaults() || coalesce((SELECT rules FROM public.project_time_policies
          WHERE workspace_id = v_ws ORDER BY version DESC LIMIT 1), '{}'::jsonb) INTO v_pol;
  IF p_subject IS NOT NULL AND p_actor = p_subject AND NOT coalesce((v_pol->>'allow_self_approval')::boolean, false) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.project_time_approvers a
                  WHERE a.project_id = p_project AND a.role = 'approver' AND a.user_id = p_actor
                    AND (p_subject IS NULL OR a.subject_user_id IS NULL OR a.subject_user_id = p_subject)
                    AND public.project_time_approver_row_active(a, current_date));
END $function$
;
CREATE OR REPLACE FUNCTION public.project_dash_vis()
 RETURNS TABLE(ws uuid, uid uuid, recon boolean, te_perm boolean, te_full boolean, te_led uuid[], te_pairs text[], tk_all boolean, pr_all boolean, ms_all boolean, team uuid[], mine uuid[], dl_ws boolean, dl_team boolean, dl_own boolean, dl_team_ids uuid[], dl_restricted boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_time jsonb;v_ws uuid; v_uid uuid := auth.uid(); v_adm boolean; v_p text[]; v_row jsonb;
  v_key text := concat_ws('|', pg_backend_pid(), now(), auth.uid(), current_setting('request.jwt.claims', true));
  v_c text := current_setting('app.project_dash_vis_cache', true);
BEGIN
  -- Reaproveita o escopo dentro da MESMA transação, usuário e claims (chave inclui processo e início da
  -- transação). Clientes não definem configurações arbitrárias (mesmo modelo das flags app.* existentes).
  IF v_c IS NOT NULL AND v_c <> '' AND (v_c::jsonb->>'k') = v_key THEN
    RETURN QUERY SELECT x.* FROM jsonb_to_record(v_c::jsonb->'v') AS x(ws uuid, uid uuid, recon boolean, te_perm boolean, te_full boolean,
      te_led uuid[], te_pairs text[], tk_all boolean, pr_all boolean, ms_all boolean, team uuid[], mine uuid[], dl_ws boolean,
      dl_team boolean, dl_own boolean, dl_team_ids uuid[], dl_restricted boolean);
    RETURN;
  END IF;
  v_ws := public.project_dash_ws();
  PERFORM public.project_time_assert_actor(v_ws, false);
  v_time:=work_time_context();
  v_adm := public.is_workspace_admin_v2(v_ws, v_uid);
  -- Mesma regra de user_has_permission(u, w, k): k pertence a user_effective_permissions(u, w).
  v_p := ARRAY(SELECT k::text FROM public.user_effective_permissions(v_uid, v_ws) k);
  SELECT to_jsonb(r) INTO v_row FROM (SELECT v_ws AS ws, v_uid AS uid,
    (public.is_active_workspace_admin(v_ws, v_uid) AND 'techprojects.reconciliation.view.workspace'=ANY(v_p)) AS recon,
    coalesce(v_time->'time_grants' ?| ARRAY['view.own','view.team','view.workspace'],false) AS te_perm,
    coalesce(v_time->'time_grants'?'view.workspace',false) AS te_full,
    ARRAY(SELECT s.project_id FROM public.project_time_led_scope() s WHERE s.subject_user_id IS NULL) AS te_led,
    ARRAY(SELECT s.project_id::text || ':' || s.subject_user_id::text FROM public.project_time_led_scope() s WHERE s.subject_user_id IS NOT NULL) AS te_pairs,
    v_adm OR v_p && ARRAY['techprojects.tasks.view.workspace','techprojects.tasks.view.own'] AS tk_all,
    v_adm OR v_p && ARRAY['techprojects.projects.view.workspace','techprojects.projects.view.own'] AS pr_all,
    v_adm OR 'techprojects.milestones.view.workspace' = ANY (v_p) AS ms_all,
    ARRAY(SELECT public.project_dash_team_projects(v_ws)) AS team,
    ARRAY(SELECT public.project_dash_my_projects(v_ws)) AS mine,
    'techsales.deals.view.workspace' = ANY (v_p) AS dl_ws,
    'techsales.deals.view.team' = ANY (v_p) AS dl_team,
    'techsales.deals.view.own' = ANY (v_p) AS dl_own,
    ARRAY(SELECT public.my_team_member_ids()) AS dl_team_ids,
    v_ws IN (SELECT public.rep_restricted_workspaces()) AS dl_restricted) r;
  PERFORM set_config('app.project_dash_vis_cache', jsonb_build_object('k', v_key, 'v', v_row)::text, true);
  RETURN QUERY SELECT x.* FROM jsonb_to_record(v_row) AS x(ws uuid, uid uuid, recon boolean, te_perm boolean, te_full boolean,
      te_led uuid[], te_pairs text[], tk_all boolean, pr_all boolean, ms_all boolean, team uuid[], mine uuid[], dl_ws boolean,
      dl_team boolean, dl_own boolean, dl_team_ids uuid[], dl_restricted boolean);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_dash_ds_entries(p_view text, f jsonb, p_prev boolean DEFAULT false)
 RETURNS TABLE(id uuid, entry_date date, project_id uuid, user_id uuid, secs numeric, k text, origin text, billable boolean, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS MATERIALIZED (SELECT v.*,work_time_context() AS time_ctx,work_access_context() AS work_ctx FROM public.project_dash_vis()v),
  b AS MATERIALIZED (
    SELECT v.*,
           CASE WHEN p_prev THEN (f->>'from')::date - ((f->>'to')::date - (f->>'from')::date + 1) ELSE (f->>'from')::date END d0,
           CASE WHEN p_prev THEN (f->>'from')::date - 1 ELSE (f->>'to')::date END d1,
           nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
           nullif(f->>'person', '')::uuid pe, nullif(f->>'origin', '') og, nullif(f->>'status', '') st,
           CASE WHEN nullif(f->>'leader', '') IS NOT NULL THEN ARRAY(SELECT public.project_dash_leader_projects(v.ws, (f->>'leader')::uuid)) END ld
      FROM v),
  iss AS MATERIALIZED (
    SELECT DISTINCT i.time_entry_id FROM public.project_reconciliation_issues i, b
     WHERE b.recon AND i.workspace_id = b.ws AND i.present AND i.status IN ('open','deferred') AND i.time_entry_id IS NOT NULL
       AND i.entry_date BETWEEN b.d0 AND b.d1),
  e AS (
    SELECT e.id, e.entry_date, e.project_id, e.user_id, e.billable, e.review_flags,
           coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours)) AS secs,
           CASE WHEN e.status = 'locked' AND e.source = 'import' THEN 'locked_import' ELSE e.status END AS k,
           CASE WHEN e.timer_session_id IS NOT NULL OR e.source = 'timer' THEN 'timer'
                WHEN e.source = 'import' AND e.external_id LIKE 'clockify:%' THEN 'clockify'
                WHEN e.source = 'import' AND e.external_id LIKE 'jibble:%' THEN 'jibble'
                WHEN e.source IN ('import','integration','api') THEN 'import_other'
                ELSE 'manual' END AS origin
      FROM public.project_time_entries e CROSS JOIN b
      LEFT JOIN public.projects pr ON pr.id = e.project_id
     WHERE e.workspace_id = (SELECT b0.ws FROM b b0) AND e.entry_date BETWEEN (SELECT b0.d0 FROM b b0) AND (SELECT b0.d1 FROM b b0)
       AND e.workspace_id = b.ws AND e.entry_date BETWEEN b.d0 AND b.d1
       AND work_time_context_access(b.time_ctx,e.workspace_id,e.project_id,e.user_id,'view')
       AND (p_view <> 'me' OR e.user_id = b.uid)
       AND (p_view <> 'team' OR e.project_id = ANY (b.team))
       AND (b.pj IS NULL OR e.project_id = b.pj)
       AND (b.co IS NULL OR pr.company_id = b.co)
       AND (b.sv IS NULL OR pr.service_id = b.sv)
       AND (b.ld IS NULL OR e.project_id = ANY (b.ld))
       AND (b.pe IS NULL OR e.user_id = b.pe))
  SELECT e.id, e.entry_date, e.project_id, e.user_id, e.secs, e.k, e.origin, e.billable,
         array_remove(ARRAY['total', e.k, 'origin_' || e.origin,
           CASE WHEN iss.time_entry_id IS NOT NULL THEN 'in_review' END,
           CASE WHEN e.k IN ('approved','locked') THEN 'validated' END,
           CASE WHEN e.k = 'submitted' THEN 'awaiting_review' END,
           CASE WHEN e.k IN ('draft','rejected') THEN 'pending_mine' END,
           CASE WHEN coalesce(array_length(e.review_flags, 1), 0) > 0 THEN 'flagged' END,
           CASE WHEN e.billable THEN 'billable' END], NULL)
    FROM e CROSS JOIN b LEFT JOIN iss ON iss.time_entry_id = e.id
   WHERE (b.og IS NULL OR e.origin = b.og) AND (b.st IS NULL OR e.k = b.st) $function$
;
CREATE OR REPLACE FUNCTION public.project_dash_ds_forecast(p_view text, f jsonb)
 RETURNS TABLE(id uuid, name text, status text, kind text, due_at date, planned_hours numeric, consumed_secs numeric, open_tasks integer, est_tasks integer, remaining_secs numeric, tasks_total integer, tasks_done integer, ms_total integer, ms_done integer, weeks_with_hours integer, w_p25 numeric, w_p50 numeric, w_p75 numeric, alloc_week_secs numeric, method text, eta_low date, eta_mid date, eta_high date, reason text, cut_date date, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Definer só para não reavaliar a RLS por linha: tarefas, marcos e apontamentos usam as MESMAS condições
  -- das políticas (project_dash_vis), e os projetos vêm de ds_projects (já restrito ao visível).
  WITH v AS MATERIALIZED (SELECT v.*,work_time_context() AS time_ctx, public.work_access_context() AS work_ctx FROM public.project_dash_vis() v),
  b AS (SELECT v.*, (f->>'today')::date td, (date_trunc('week', (f->>'today')::date))::date wk0 FROM v),
  pr AS MATERIALIZED (SELECT p.* FROM public.project_dash_ds_projects(p_view, f) p WHERE 'open' = ANY (p.m)),
  tk AS (SELECT t.project_id, count(*) FILTER (WHERE t.status <> 'done')::int o,
                count(*) FILTER (WHERE t.status <> 'done' AND t.estimated_hours IS NOT NULL)::int oe,
                coalesce(sum(t.estimated_hours) FILTER (WHERE t.status <> 'done'), 0) * 3600 rem,
                count(*)::int tt, count(*) FILTER (WHERE t.status = 'done')::int td
           FROM public.project_tasks t CROSS JOIN b
          WHERE t.workspace_id = b.ws AND t.project_id IN (SELECT id FROM pr) AND public.work_context_access(b.work_ctx,t.workspace_id,'techprojects.tasks','view',array_append(coalesce(t.assignee_ids,'{}'),t.assignee_id)) GROUP BY 1),
  ms AS (SELECT x.project_id, count(*) FILTER (WHERE x.status::text <> 'cancelled')::int tt, count(*) FILTER (WHERE x.status::text = 'done')::int dn
           FROM public.project_milestones x CROSS JOIN b
          WHERE x.workspace_id = b.ws AND x.project_id IN (SELECT id FROM pr) AND work_context_access(b.work_ctx,x.workspace_id,'techprojects.milestones','view',ARRAY[x.assigned_to]) GROUP BY 1),
  -- Consumo total por projeto e cadência das últimas 8 semanas, agregados direto da tabela (antes:
  -- todo o histórico materializado e cruzado com cada semana). Mesmos filtros e mesmas somas.
  ce AS (
    SELECT e.project_id, sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))) s
      FROM public.project_time_entries e CROSS JOIN b
     WHERE e.workspace_id = b.ws AND e.project_id IN (SELECT id FROM pr) AND e.status <> 'rejected'
       AND work_time_context_access(b.time_ctx,e.workspace_id,e.project_id,e.user_id,'view')
     GROUP BY 1),
  ew AS (
    SELECT e.project_id, b.wk0 - 7 * (((b.wk0 - e.entry_date) - 1) / 7 + 1) AS w,
           sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))) s
      FROM public.project_time_entries e CROSS JOIN b
     WHERE e.workspace_id = b.ws AND e.project_id IN (SELECT id FROM pr) AND e.status <> 'rejected'
       AND e.entry_date >= (SELECT b0.wk0 - 56 FROM b b0) AND e.entry_date < (SELECT b0.wk0 FROM b b0)
       AND work_time_context_access(b.time_ctx,e.workspace_id,e.project_id,e.user_id,'view')
     GROUP BY 1, 2),
  wk AS (SELECT pr.id pid, g.w, coalesce(ew.s, 0) s
           FROM pr CROSS JOIN b CROSS JOIN LATERAL (SELECT (b.wk0 - 7 * i) AS w FROM generate_series(1, 8) i) g
           LEFT JOIN ew ON ew.project_id = pr.id AND ew.w = g.w),
  wq AS (SELECT pid, count(*) FILTER (WHERE s > 0)::int nw,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY s) p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY s) p50,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY s) p75
           FROM wk GROUP BY pid),
  base AS (
    SELECT pr.id, pr.name, pr.status, pr.kind, pr.due_at, pr.planned_hours, coalesce(ce.s, 0) cs,
           coalesce(tk.o, 0) o, coalesce(tk.oe, 0) oe, coalesce(tk.rem, 0) rem, coalesce(tk.tt, 0) tt, coalesce(tk.td, 0) tdn,
           coalesce(ms.tt, 0) mt, coalesce(ms.dn, 0) md, coalesce(wq.nw, 0) nw,
           CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p25 END p25, CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p50 END p50,
           CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p75 END p75,
           public.project_dash_project_week_alloc(b.ws, pr.id, b.td) aw, b.td
      FROM pr CROSS JOIN b LEFT JOIN tk ON tk.project_id = pr.id LEFT JOIN ms ON ms.project_id = pr.id
      LEFT JOIN ce ON ce.project_id = pr.id LEFT JOIN wq ON wq.pid = pr.id),
  calc AS (
    SELECT base.*,
      CASE WHEN kind = 'hunting' THEN 'techhire' WHEN kind = 'capacity' THEN 'competence'
           WHEN o = 0 OR oe = 0 THEN 'none'
           WHEN p50 IS NULL AND coalesce(aw, 0) = 0 THEN 'none'
           ELSE 'estimate' END AS meth,
      nullif(greatest(coalesce(p75, 0), coalesce(aw, 0)), 0) hi_rate,
      least(coalesce(nullif(p25, 0), nullif(aw, 0)), coalesce(nullif(aw, 0), nullif(p25, 0))) lo_rate,
      coalesce(nullif(p50, 0), nullif(aw, 0)) mid_rate
      FROM base)
  SELECT c.id, c.name, c.status, c.kind, c.due_at, c.planned_hours, c.cs, c.o, c.oe, c.rem, c.tt, c.tdn, c.mt, c.md, c.nw,
         c.p25, c.p50, c.p75, c.aw,
         c.meth,
         CASE WHEN c.meth = 'estimate' AND c.hi_rate > 0 THEN c.td + ceil(c.rem / c.hi_rate * 7)::int END,
         CASE WHEN c.meth = 'estimate' AND c.mid_rate > 0 THEN c.td + ceil(c.rem / c.mid_rate * 7)::int END,
         CASE WHEN c.meth = 'estimate' AND c.lo_rate > 0 THEN c.td + ceil(c.rem / c.lo_rate * 7)::int END,
         CASE WHEN c.kind = 'hunting' THEN 'Hunting é acompanhado no TechHire (vagas e candidaturas); sem previsão aqui.'
              WHEN c.kind = 'capacity' THEN 'Entrega recorrente: acompanhe a cobertura da competência (alocado × registrado).'
              WHEN c.o = 0 THEN 'Sem base para prever: nenhuma tarefa aberta.'
              WHEN c.oe = 0 THEN 'Sem base para prever: tarefas abertas sem estimativa.'
              WHEN c.p50 IS NULL AND coalesce(c.aw, 0) = 0 THEN 'Sem base para prever: menos de 4 das últimas 8 semanas com horas e sem capacidade alocada conhecida.'
              WHEN c.oe < c.o THEN 'Estimativa parcial: só ' || c.oe || ' de ' || c.o || ' tarefas abertas têm estimativa; a data tende a ser otimista.'
              END,
         c.td,
         array_remove(ARRAY['open',
           CASE WHEN c.meth = 'estimate' THEN 'forecast' END,
           CASE WHEN c.meth = 'none' THEN 'no_base' END,
           CASE WHEN c.meth = 'techhire' THEN 'hunting' END,
           CASE WHEN c.meth = 'competence' THEN 'recurring' END,
           CASE WHEN c.meth = 'estimate' AND c.due_at IS NOT NULL AND c.mid_rate > 0 AND c.td + ceil(c.rem / c.mid_rate * 7)::int > c.due_at THEN 'late' END,
           CASE WHEN c.meth = 'estimate' AND c.oe < c.o THEN 'partial_estimate' END,
           CASE WHEN c.planned_hours > 0 AND c.cs >= c.planned_hours * 3600 THEN 'over_budget' END], NULL)
    FROM calc c $function$
;

-- Revoked create rights prevent continuation; pausing/discarding an own unsaved timer stays a personal safety action.
CREATE OR REPLACE FUNCTION public.project_timer_lock(p_session uuid)
 RETURNS project_timer_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.project_timer_sessions;
BEGIN
  SELECT * INTO s FROM public.project_timer_sessions WHERE id = p_session FOR UPDATE;
  IF s.id IS NULL OR s.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cronômetro não encontrado.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(s.workspace_id, true);
  RETURN s;
END $function$
;
CREATE OR REPLACE FUNCTION public.project_timer_resume(p_session uuid, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.project_timer_sessions; v_now timestamptz := now();
BEGIN PERFORM project_timer_authorize_continue(p_session);
  s := public.project_timer_lock(p_session);
  IF s.state = 'running' THEN RETURN public.project_timer_json(s.id) || jsonb_build_object('idempotent', true); END IF;
  IF s.state <> 'paused' THEN RAISE EXCEPTION 'Cronômetro já finalizado.'; END IF;
  IF p_version IS NOT NULL AND p_version <> s.version THEN RAISE EXCEPTION 'TIMER_STALE: o cronômetro mudou em outra aba; atualize.'; END IF;
  UPDATE public.project_timer_segments SET ended_at = v_now WHERE session_id = s.id AND ended_at IS NULL;
  INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at)
  VALUES (s.workspace_id, s.id, 'work', s.task_id, v_now);
  UPDATE public.project_timer_sessions SET state = 'running', version = version + 1, updated_at = v_now WHERE id = s.id;
  RETURN public.project_timer_json(s.id);
END $function$
;
CREATE OR REPLACE FUNCTION public.project_timer_switch(p_session uuid, p_task uuid, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.project_timer_sessions; v_now timestamptz := now();
BEGIN PERFORM project_timer_authorize_continue(p_session);
  s := public.project_timer_lock(p_session);
  IF s.state NOT IN ('running','paused') THEN RAISE EXCEPTION 'Cronômetro já finalizado.'; END IF;
  IF s.task_id IS NOT DISTINCT FROM p_task THEN RETURN public.project_timer_json(s.id) || jsonb_build_object('idempotent', true); END IF;
  IF p_version IS NOT NULL AND p_version <> s.version THEN RAISE EXCEPTION 'TIMER_STALE: o cronômetro mudou em outra aba; atualize.'; END IF;
  IF p_task IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE id = p_task AND project_id = s.project_id) THEN
    RAISE EXCEPTION 'Atividade não pertence ao projeto.';
  END IF;
  IF s.state = 'running' THEN
    UPDATE public.project_timer_segments SET ended_at = v_now WHERE session_id = s.id AND ended_at IS NULL;
    INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at)
    VALUES (s.workspace_id, s.id, 'work', p_task, v_now);
  END IF;
  UPDATE public.project_timer_sessions SET task_id = p_task, version = version + 1, updated_at = v_now WHERE id = s.id;
  RETURN public.project_timer_json(s.id);
END $function$
;

-- Capacity follows project and HR visibility; assignment alone grants no access.
CREATE OR REPLACE FUNCTION public.project_dash_capacity_base(p_view text, f jsonb)
 RETURNS TABLE(person_id uuid, user_id uuid, name text, person_status text, schedule_known boolean, contracted numeric, allocated_total numeric, allocated_scope numeric, expected_scope_to_date numeric, overbooked_days integer, max_load_pct numeric, unquantified integer, allocations_scope integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid := (f->>'ws')::uuid; v_full boolean; c jsonb:=work_access_context(); tc jsonb:=work_time_context(); v_d0 date := (f->>'from')::date; v_d1 date := (f->>'to')::date;
  v_td date := (f->>'today')::date; v_pj uuid := nullif(f->>'project', '')::uuid; v_co uuid := nullif(f->>'company', '')::uuid;
  v_sv uuid := nullif(f->>'service', '')::uuid; v_ld uuid := nullif(f->>'leader', '')::uuid; v_pe uuid := nullif(f->>'person', '')::uuid;
BEGIN
  IF v_ws IS DISTINCT FROM public.project_dash_ws() THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(v_ws, false);
  IF v_d1 - v_d0 > 400 THEN RAISE EXCEPTION 'Capacidade: período máximo de 400 dias.' USING ERRCODE = '22023'; END IF;
  v_full := public.project_dash_full(v_ws);
  IF p_view = 'team' AND NOT (v_full OR EXISTS (SELECT 1 FROM public.project_dash_leader_projects(v_ws, auth.uid()))) THEN
    RAISE EXCEPTION 'Sem acesso à visão Equipe.' USING ERRCODE = '42501';
  END IF;
  IF p_view NOT IN ('me','team') THEN RAISE EXCEPTION 'Capacidade só nas visões Meu trabalho e Equipe.' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  WITH sp AS (
    SELECT p.id FROM public.projects p
     WHERE p.workspace_id = v_ws AND work_record_context_access(c,'techprojects.projects',p.id,'view')
       AND (p_view = 'me' OR p.id IN (SELECT public.project_dash_team_projects(v_ws)))
       AND (v_pj IS NULL OR p.id = v_pj) AND (v_co IS NULL OR p.company_id = v_co) AND (v_sv IS NULL OR p.service_id = v_sv)
       AND (v_ld IS NULL OR p.id IN (SELECT public.project_dash_leader_projects(v_ws, v_ld)))),
  ppl AS (
    SELECT pe.id, pe.profile_id, coalesce(nullif(btrim(pe.preferred_name), ''), pe.full_name) AS nm, pe.status::text AS st,
           pe.work_schedule ws, pe.hire_date, pe.termination_date
      FROM public.people pe
     WHERE pe.workspace_id = v_ws AND public.hr_people_access(pe.workspace_id,'view',pe.profile_id,pe.manager_id,coalesce(pe.assigned_to,pe.created_by,pe.owner_id)) AND NOT coalesce(pe.archived, false)
       AND (v_pe IS NULL OR pe.profile_id = v_pe)
       AND CASE WHEN p_view = 'me' THEN pe.profile_id = auth.uid()
           ELSE (EXISTS (SELECT 1 FROM public.people_allocations a WHERE a.person_id = pe.id AND a.workspace_id = v_ws
                          AND a.project_id IN (SELECT id FROM sp) AND a.status IN ('active','paused')
                          AND coalesce(a.starts_at, v_d1) <= v_d1 AND (a.ends_at IS NULL OR a.ends_at >= v_d0))
                 OR (pe.profile_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_time_entries e
                          WHERE e.workspace_id = v_ws AND work_time_context_access(tc,e.workspace_id,e.project_id,e.user_id,'view') AND e.user_id = pe.profile_id AND e.entry_date BETWEEN v_d0 AND v_d1
                            AND e.project_id IN (SELECT id FROM sp))))
           END),
  days AS (
    SELECT q.id pid, d::date AS day,
           CASE WHEN q.ws IS NULL OR q.st = 'on_leave' OR (q.st = 'terminated' AND q.termination_date IS NULL) THEN NULL
                WHEN (q.hire_date IS NOT NULL AND d::date < q.hire_date) OR (q.termination_date IS NOT NULL AND d::date > q.termination_date) THEN 0
                ELSE coalesce((q.ws->>((ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM d)::int + 1]))::numeric, 0) END AS cap,
           (SELECT sum(coalesce((q.ws->>k)::numeric, 0)) FROM unnest(ARRAY['sun','mon','tue','wed','thu','fri','sat']) k) AS wcap
      FROM ppl q CROSS JOIN generate_series(v_d0, v_d1, interval '1 day') d),
  al AS (
    SELECT a.id, a.person_id, a.allocation_pct, a.hours_per_week, a.starts_at, a.ends_at, (a.project_id IN (SELECT id FROM sp)) AS in_scope
      FROM public.people_allocations a
     WHERE a.workspace_id = v_ws AND public.hr_person_resource_access(a.workspace_id,a.person_id,'techpeople.allocations','view',a.created_by,a.assigned_to) AND a.person_id IN (SELECT id FROM ppl) AND a.status = 'active'),
  dl AS (
    SELECT dy.pid, dy.day, dy.cap,
           sum(CASE WHEN a.allocation_pct IS NOT NULL THEN dy.cap * a.allocation_pct / 100
                    WHEN a.hours_per_week IS NOT NULL AND dy.wcap > 0 THEN a.hours_per_week * 3600 * dy.cap / dy.wcap END) AS at,
           sum(CASE WHEN a.allocation_pct IS NOT NULL THEN dy.cap * a.allocation_pct / 100
                    WHEN a.hours_per_week IS NOT NULL AND dy.wcap > 0 THEN a.hours_per_week * 3600 * dy.cap / dy.wcap END)
             FILTER (WHERE a.in_scope) AS asc_,
           count(a.id) FILTER (WHERE a.allocation_pct IS NULL AND a.hours_per_week IS NULL) AS unq,
           count(a.id) FILTER (WHERE a.in_scope) AS nsc
      FROM days dy
      LEFT JOIN al a ON a.person_id = dy.pid AND coalesce(a.starts_at, dy.day) <= dy.day AND (a.ends_at IS NULL OR a.ends_at >= dy.day)
     GROUP BY dy.pid, dy.day, dy.cap)
  SELECT q.id, q.profile_id, q.nm, q.st,
         (q.ws IS NOT NULL AND q.st <> 'on_leave' AND NOT (q.st = 'terminated' AND q.termination_date IS NULL)),
         CASE WHEN bool_and(dl.cap IS NOT NULL) THEN sum(dl.cap) END,
         CASE WHEN bool_and(dl.cap IS NOT NULL) THEN coalesce(sum(dl.at), 0) END,
         CASE WHEN bool_and(dl.cap IS NOT NULL) THEN coalesce(sum(dl.asc_), 0) END,
         CASE WHEN bool_and(dl.cap IS NOT NULL) THEN coalesce(sum(dl.asc_) FILTER (WHERE dl.day <= v_td), 0) END,
         count(*) FILTER (WHERE dl.cap > 0 AND coalesce(dl.at, 0) > dl.cap + 1)::int,
         max(CASE WHEN dl.cap > 0 THEN round(coalesce(dl.at, 0) / dl.cap * 100, 1) END),
         max(dl.unq)::int,
         max(dl.nsc)::int
    FROM ppl q JOIN dl ON dl.pid = q.id
   WHERE p_view = 'me' OR v_full OR public.can_view_person(q.id) OR public.project_dash_person_in_led(v_ws, q.id)
   GROUP BY q.id, q.profile_id, q.nm, q.st, q.ws, q.termination_date;
END $function$
;

-- Scheduled alerts require a still-authorized source actor.
CREATE OR REPLACE FUNCTION public.project_alert_scheduled_tick(p_limit integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; v_done int := 0; v_fail int := 0; v_skip int := 0; c jsonb; v_res jsonb;
BEGIN
  FOR w IN
    SELECT x.workspace_id, x.created_by, coalesce(x.rules->'_schedule'->>'tz', 'America/Sao_Paulo') AS tz
      FROM (SELECT DISTINCT ON (v.workspace_id) v.workspace_id, v.created_by, v.rules FROM public.project_risk_rule_versions v
             WHERE v.project_id IS NULL ORDER BY v.workspace_id, v.version DESC) x
     WHERE coalesce((x.rules->'_schedule'->>'enabled')::boolean, false)
       AND NOT EXISTS (SELECT 1 FROM public.project_alert_runs r WHERE r.workspace_id = x.workspace_id AND r.trigger = 'scheduled'
                        AND ((r.finished_at IS NOT NULL AND r.started_at > now() - interval '20 hours')
                             OR (r.finished_at IS NULL AND r.started_at > now() - interval '1 hour')))
     LIMIT greatest(1, least(coalesce(p_limit, 5), 50))
  LOOP
    c:=work_subject_context(w.workspace_id,w.created_by);
    IF NOT coalesce(c->'keys'?'techprojects.risk_rules.manage.workspace' AND c->'keys'?'techprojects.alerts.manage.workspace',false) THEN v_skip:=v_skip+1;CONTINUE;END IF;
    BEGIN
      v_res := public.project_alert_evaluate(w.workspace_id, w.tz, NULL, 'scheduled');
      IF v_res->>'status' = 'busy' THEN v_skip := v_skip + 1; ELSE v_done := v_done + 1; END IF;
    EXCEPTION WHEN others THEN
      v_fail := v_fail + 1;
      INSERT INTO public.project_alert_runs (workspace_id, actor, trigger, tz, evaluated_on, counts)
      VALUES (w.workspace_id, NULL, 'scheduled', w.tz, current_date, jsonb_build_object('error', left(SQLERRM, 300)));
    END;
  END LOOP;
  RETURN jsonb_build_object('evaluated', v_done, 'failed', v_fail, 'busy', v_skip);
END $function$
;

CREATE TRIGGER work_contract_suggestion_integrity BEFORE INSERT OR UPDATE ON public.contract_link_ai_suggestions FOR EACH ROW EXECUTE FUNCTION public.work_contract_suggestion_guard();

-- Legacy callers use the same record scope, never a separate manager/admin rule.
CREATE OR REPLACE FUNCTION public.project_visible_to_current_user(_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT work_record_access('techprojects.projects',_project,'view')$$;
CREATE OR REPLACE FUNCTION public.project_editable_by_current_user(_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT work_record_access('techprojects.projects',_project,'update')$$;
