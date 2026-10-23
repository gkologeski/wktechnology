-- WK: autorização explícita do usuário em 23/10/2026.
-- Head de RH recebe o catálogo atual de TechHire e TechPeople somente na WK.
-- Não altera presets globais, outros cargos, outros workspaces ou papel admin.
INSERT INTO public.job_role_permission_overrides
  (workspace_id, role_id, permission_key, effect, created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid, 'aaaaaaaa-0000-4000-8000-000000000004'::uuid,
       p.key, 'grant', '1c237fbe-079e-4eb9-a3e6-c08d85e79688'::uuid
FROM public.permissions p WHERE p.module IN ('techhire', 'techpeople')
ON CONFLICT (workspace_id, role_id, permission_key)
DO UPDATE SET effect = 'grant', updated_at = now();

-- Ponte de compatibilidade para políticas legadas admin-only.
-- Exige a chave efetiva de cada ação (deny prevalece), cargo local e membro ativo.
-- O helper não aceita identidade do cliente nem retorna registros de negócio.
CREATE OR REPLACE FUNCTION public.wk_head_rh_permission(_workspace uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(
    auth.uid() IS NOT NULL
    AND _workspace = '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid
    AND (_key LIKE 'techhire.%' OR _key LIKE 'techpeople.%')
    AND public.is_workspace_member(_workspace, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_job_roles u
       WHERE u.user_id = auth.uid()
         AND u.role_id = 'aaaaaaaa-0000-4000-8000-000000000004'::uuid
         AND (u.workspace_id = _workspace OR u.owner_id = _workspace)
    )
    AND public.user_has_permission(auth.uid(), _workspace, _key), false);
$fn$;
REVOKE ALL ON FUNCTION public.wk_head_rh_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wk_head_rh_permission(uuid, text) TO authenticated, service_role;

-- Documentos/benefícios legados não enviavam workspace_id. Derivar sempre da
-- pessoa evita conceder acesso por owner ambíguo e impede vínculo entre tenants.
CREATE OR REPLACE FUNCTION public.wk_people_child_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_workspace uuid;
BEGIN
  SELECT p.workspace_id INTO v_workspace FROM public.people p WHERE p.id = NEW.person_id;
  IF v_workspace = '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid OR NEW.workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid THEN
    IF v_workspace IS NULL OR (NEW.workspace_id IS NOT NULL AND NEW.workspace_id <> v_workspace) THEN
      RAISE EXCEPTION 'Pessoa e registro devem pertencer ao mesmo workspace.' USING ERRCODE = '23514';
    END IF;
    NEW.workspace_id := v_workspace;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.wk_people_child_workspace() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS wk_people_child_workspace ON public.people_documents;
CREATE TRIGGER wk_people_child_workspace BEFORE INSERT OR UPDATE OF person_id, workspace_id
ON public.people_documents FOR EACH ROW EXECUTE FUNCTION public.wk_people_child_workspace();
UPDATE public.people_documents c SET workspace_id = p.workspace_id FROM public.people p
WHERE c.person_id = p.id AND c.workspace_id IS NULL AND p.workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid;
DROP TRIGGER IF EXISTS wk_people_child_workspace ON public.people_benefits;
CREATE TRIGGER wk_people_child_workspace BEFORE INSERT OR UPDATE OF person_id, workspace_id
ON public.people_benefits FOR EACH ROW EXECUTE FUNCTION public.wk_people_child_workspace();
UPDATE public.people_benefits c SET workspace_id = p.workspace_id FROM public.people p
WHERE c.person_id = p.id AND c.workspace_id IS NULL AND p.workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid;

-- Políticas adicionais: apenas Head de RH da WK com a chave da ação.
-- Mantêm políticas restritivas existentes (incluindo Ver como) e regras legadas.
DROP POLICY IF EXISTS wk_head_rh_view ON public.people_onboarding_plans;
CREATE POLICY wk_head_rh_view ON public.people_onboarding_plans AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.' || kind || '.view.workspace') AND kind IN ('onboarding', 'offboarding') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_onboarding_plans.person_id AND p.workspace_id = people_onboarding_plans.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_create ON public.people_onboarding_plans;
CREATE POLICY wk_head_rh_create ON public.people_onboarding_plans AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.' || kind || '.create.workspace') AND kind IN ('onboarding', 'offboarding') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_onboarding_plans.person_id AND p.workspace_id = people_onboarding_plans.workspace_id) AND owner_id = auth.uid());

DROP POLICY IF EXISTS wk_head_rh_update ON public.people_onboarding_plans;
CREATE POLICY wk_head_rh_update ON public.people_onboarding_plans AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.' || kind || '.update.workspace') AND kind IN ('onboarding', 'offboarding') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_onboarding_plans.person_id AND p.workspace_id = people_onboarding_plans.workspace_id))
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.' || kind || '.update.workspace') AND kind IN ('onboarding', 'offboarding') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_onboarding_plans.person_id AND p.workspace_id = people_onboarding_plans.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_delete ON public.people_onboarding_plans;
CREATE POLICY wk_head_rh_delete ON public.people_onboarding_plans AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.' || kind || '.delete.workspace') AND kind IN ('onboarding', 'offboarding') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_onboarding_plans.person_id AND p.workspace_id = people_onboarding_plans.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_view ON public.people_onboarding_tasks;
CREATE POLICY wk_head_rh_view ON public.people_onboarding_tasks AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people_onboarding_plans p WHERE p.id = people_onboarding_tasks.plan_id AND p.workspace_id = people_onboarding_tasks.workspace_id AND p.kind IN ('onboarding', 'offboarding') AND public.wk_head_rh_permission(p.workspace_id, 'techpeople.' || p.kind || '.view.workspace')));

DROP POLICY IF EXISTS wk_head_rh_create ON public.people_onboarding_tasks;
CREATE POLICY wk_head_rh_create ON public.people_onboarding_tasks AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.people_onboarding_plans p WHERE p.id = people_onboarding_tasks.plan_id AND p.workspace_id = people_onboarding_tasks.workspace_id AND p.kind IN ('onboarding', 'offboarding') AND public.wk_head_rh_permission(p.workspace_id, 'techpeople.' || p.kind || '.create.workspace')));

DROP POLICY IF EXISTS wk_head_rh_update ON public.people_onboarding_tasks;
CREATE POLICY wk_head_rh_update ON public.people_onboarding_tasks AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people_onboarding_plans p WHERE p.id = people_onboarding_tasks.plan_id AND p.workspace_id = people_onboarding_tasks.workspace_id AND p.kind IN ('onboarding', 'offboarding') AND public.wk_head_rh_permission(p.workspace_id, 'techpeople.' || p.kind || '.update.workspace')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.people_onboarding_plans p WHERE p.id = people_onboarding_tasks.plan_id AND p.workspace_id = people_onboarding_tasks.workspace_id AND p.kind IN ('onboarding', 'offboarding') AND public.wk_head_rh_permission(p.workspace_id, 'techpeople.' || p.kind || '.update.workspace')));

DROP POLICY IF EXISTS wk_head_rh_delete ON public.people_onboarding_tasks;
CREATE POLICY wk_head_rh_delete ON public.people_onboarding_tasks AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people_onboarding_plans p WHERE p.id = people_onboarding_tasks.plan_id AND p.workspace_id = people_onboarding_tasks.workspace_id AND p.kind IN ('onboarding', 'offboarding') AND public.wk_head_rh_permission(p.workspace_id, 'techpeople.' || p.kind || '.delete.workspace')));

DROP POLICY IF EXISTS wk_head_rh_view ON public.people_onboarding_templates;
CREATE POLICY wk_head_rh_view ON public.people_onboarding_templates AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.onboarding_templates.view.workspace'));

DROP POLICY IF EXISTS wk_head_rh_create ON public.people_onboarding_templates;
CREATE POLICY wk_head_rh_create ON public.people_onboarding_templates AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.onboarding_templates.create.workspace') AND owner_id = auth.uid());

DROP POLICY IF EXISTS wk_head_rh_update ON public.people_onboarding_templates;
CREATE POLICY wk_head_rh_update ON public.people_onboarding_templates AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.onboarding_templates.update.workspace'))
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.onboarding_templates.update.workspace'));

DROP POLICY IF EXISTS wk_head_rh_delete ON public.people_onboarding_templates;
CREATE POLICY wk_head_rh_delete ON public.people_onboarding_templates AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.onboarding_templates.delete.workspace'));

DROP POLICY IF EXISTS wk_head_rh_view ON public.people_documents;
CREATE POLICY wk_head_rh_view ON public.people_documents AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.documents.view.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_documents.person_id AND p.workspace_id = people_documents.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_create ON public.people_documents;
CREATE POLICY wk_head_rh_create ON public.people_documents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.documents.create.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_documents.person_id AND p.workspace_id = people_documents.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_update ON public.people_documents;
CREATE POLICY wk_head_rh_update ON public.people_documents AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.documents.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_documents.person_id AND p.workspace_id = people_documents.workspace_id))
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.documents.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_documents.person_id AND p.workspace_id = people_documents.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_delete ON public.people_documents;
CREATE POLICY wk_head_rh_delete ON public.people_documents AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.documents.delete.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_documents.person_id AND p.workspace_id = people_documents.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_view ON public.people_benefits;
CREATE POLICY wk_head_rh_view ON public.people_benefits AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.benefits.view.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_benefits.person_id AND p.workspace_id = people_benefits.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_create ON public.people_benefits;
CREATE POLICY wk_head_rh_create ON public.people_benefits AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.benefits.create.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_benefits.person_id AND p.workspace_id = people_benefits.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_update ON public.people_benefits;
CREATE POLICY wk_head_rh_update ON public.people_benefits AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.benefits.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_benefits.person_id AND p.workspace_id = people_benefits.workspace_id))
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.benefits.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_benefits.person_id AND p.workspace_id = people_benefits.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_delete ON public.people_benefits;
CREATE POLICY wk_head_rh_delete ON public.people_benefits AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.benefits.delete.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_benefits.person_id AND p.workspace_id = people_benefits.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_update ON public.people_allocations;
CREATE POLICY wk_head_rh_update ON public.people_allocations AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.allocations.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_allocations.person_id AND p.workspace_id = people_allocations.workspace_id))
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.allocations.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_allocations.person_id AND p.workspace_id = people_allocations.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_delete ON public.people_allocations;
CREATE POLICY wk_head_rh_delete ON public.people_allocations AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.allocations.delete.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_allocations.person_id AND p.workspace_id = people_allocations.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_view ON public.people_incidents;
CREATE POLICY wk_head_rh_view ON public.people_incidents AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.incidents.view.workspace') AND (person_id IS NULL OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_incidents.person_id AND p.workspace_id = people_incidents.workspace_id)));

DROP POLICY IF EXISTS wk_head_rh_create ON public.people_incidents;
CREATE POLICY wk_head_rh_create ON public.people_incidents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.incidents.create.workspace') AND (person_id IS NULL OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_incidents.person_id AND p.workspace_id = people_incidents.workspace_id)));

DROP POLICY IF EXISTS wk_head_rh_update ON public.people_incidents;
CREATE POLICY wk_head_rh_update ON public.people_incidents AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.incidents.update.workspace') AND (person_id IS NULL OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_incidents.person_id AND p.workspace_id = people_incidents.workspace_id)))
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.incidents.update.workspace') AND (person_id IS NULL OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_incidents.person_id AND p.workspace_id = people_incidents.workspace_id)));

DROP POLICY IF EXISTS wk_head_rh_delete ON public.people_incidents;
CREATE POLICY wk_head_rh_delete ON public.people_incidents AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.incidents.delete.workspace') AND (person_id IS NULL OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_incidents.person_id AND p.workspace_id = people_incidents.workspace_id)));

DROP POLICY IF EXISTS wk_head_rh_create ON public.people_events;
CREATE POLICY wk_head_rh_create ON public.people_events AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.people.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_events.person_id AND p.workspace_id = people_events.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_update ON public.people_events;
CREATE POLICY wk_head_rh_update ON public.people_events AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.people.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_events.person_id AND p.workspace_id = people_events.workspace_id))
  WITH CHECK (public.wk_head_rh_permission(workspace_id, 'techpeople.people.update.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_events.person_id AND p.workspace_id = people_events.workspace_id));

DROP POLICY IF EXISTS wk_head_rh_delete ON public.people_events;
CREATE POLICY wk_head_rh_delete ON public.people_events AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.wk_head_rh_permission(workspace_id, 'techpeople.people.delete.workspace') AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_events.person_id AND p.workspace_id = people_events.workspace_id));

-- Incidentes sem pessoa tinham uma restrição adicional exclusivamente admin.
-- Preservar o predicado anterior e acrescentar apenas a autorização local do Head.
DO $patch$
DECLARE r record; v_key text;
BEGIN
  FOR r IN SELECT policyname,qual,with_check FROM pg_policies
    WHERE schemaname='public' AND tablename='people_incidents'
      AND policyname IN ('people_incidents_select_gate','people_incidents_update_gate')
  LOOP
    v_key := CASE WHEN r.policyname='people_incidents_select_gate'
      THEN 'techpeople.incidents.view.workspace' ELSE 'techpeople.incidents.update.workspace' END;
    IF position('wk_head_rh_permission' in r.qual)=0 THEN
      IF r.with_check IS NULL THEN
        EXECUTE format('ALTER POLICY %I ON public.people_incidents USING ((%s) OR public.wk_head_rh_permission(workspace_id,%L))',r.policyname,r.qual,v_key);
      ELSE
        EXECUTE format('ALTER POLICY %I ON public.people_incidents USING ((%s) OR public.wk_head_rh_permission(workspace_id,%L)) WITH CHECK ((%s) OR public.wk_head_rh_permission(workspace_id,%L))',r.policyname,r.qual,v_key,r.with_check,v_key);
      END IF;
    END IF;
  END LOOP;
END $patch$;
