-- 1. Adicionar colunas workspace_id
ALTER TABLE public.ats_pipelines ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.ats_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.ats_applications ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.ats_candidates ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- 2. Chaves estrangeiras para workspaces
ALTER TABLE public.ats_pipelines DROP CONSTRAINT IF EXISTS fk_ats_pipelines_workspace;
ALTER TABLE public.ats_jobs DROP CONSTRAINT IF EXISTS fk_ats_jobs_workspace;
ALTER TABLE public.ats_applications DROP CONSTRAINT IF EXISTS fk_ats_applications_workspace;
ALTER TABLE public.ats_candidates DROP CONSTRAINT IF EXISTS fk_ats_candidates_workspace;

ALTER TABLE public.ats_pipelines ADD CONSTRAINT fk_ats_pipelines_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE RESTRICT;
ALTER TABLE public.ats_jobs ADD CONSTRAINT fk_ats_jobs_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE RESTRICT;
ALTER TABLE public.ats_applications ADD CONSTRAINT fk_ats_applications_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE RESTRICT;
ALTER TABLE public.ats_candidates ADD CONSTRAINT fk_ats_candidates_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE RESTRICT;

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_ats_pipelines_workspace_id ON public.ats_pipelines(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ats_jobs_workspace_id ON public.ats_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ats_applications_workspace_id ON public.ats_applications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ats_candidates_workspace_id ON public.ats_candidates(workspace_id);

-- 4. Backfill workspace_id
UPDATE public.ats_pipelines p
SET workspace_id = COALESCE((SELECT active_workspace_id FROM public.profiles WHERE id = p.owner_id), public.default_workspace_for_user(p.owner_id))
WHERE workspace_id IS NULL;

UPDATE public.ats_jobs j
SET workspace_id = COALESCE((SELECT active_workspace_id FROM public.profiles WHERE id = j.owner_id), public.default_workspace_for_user(j.owner_id))
WHERE workspace_id IS NULL;

UPDATE public.ats_candidates c
SET workspace_id = COALESCE((SELECT active_workspace_id FROM public.profiles WHERE id = c.owner_id), public.default_workspace_for_user(c.owner_id))
WHERE workspace_id IS NULL;

UPDATE public.ats_applications a
SET workspace_id = COALESCE(
  (SELECT workspace_id FROM public.ats_jobs WHERE id = a.job_id),
  (SELECT active_workspace_id FROM public.profiles WHERE id = a.owner_id),
  public.default_workspace_for_user(a.owner_id)
)
WHERE workspace_id IS NULL;

-- 5. NOT NULL
ALTER TABLE public.ats_pipelines ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ats_jobs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ats_applications ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ats_candidates ALTER COLUMN workspace_id SET NOT NULL;

-- 6. Move todas as vagas para o pipeline "RH - Seleção"
UPDATE public.ats_jobs SET pipeline_id = '7d8a58c3-e878-4c9c-a0e5-fa777acc548c' WHERE pipeline_id <> '7d8a58c3-e878-4c9c-a0e5-fa777acc548c';

-- 7. Mapeia estágios das candidaturas para o pipeline "RH - Seleção"
UPDATE public.ats_applications
SET stage_value = CASE stage_value
    WHEN 'applied' THEN 'caixa_de_entrada'
    WHEN 'screening' THEN 'validacao_comportamental'
    WHEN 'interview_hr' THEN 'entrevista_rh'
    WHEN 'hired' THEN 'profissional_contratado'
    WHEN 'rejected' THEN 'vaga_cancelada'
    ELSE stage_value
  END,
  status = CASE
    WHEN stage_value = 'hired' THEN 'hired'
    WHEN stage_value = 'rejected' THEN 'rejected'
    ELSE status
  END
WHERE stage_value IN ('applied', 'screening', 'interview_hr', 'hired', 'rejected');

-- 8. Remove pipelines legados vazios
DELETE FROM public.ats_pipelines WHERE id <> '7d8a58c3-e878-4c9c-a0e5-fa777acc548c';

-- 9. Garante que o pipeline alvo é o padrão e pertence ao workspace WK Technology
UPDATE public.ats_pipelines
SET is_default = true, name = 'RH - Seleção', workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d'
WHERE id = '7d8a58c3-e878-4c9c-a0e5-fa777acc548c';

-- 10. Atualiza trigger de exclusividade de padrão por workspace
CREATE OR REPLACE FUNCTION public.ats_pipelines_enforce_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.ats_pipelines p
    SET is_default = false, updated_at = now()
    WHERE p.id <> NEW.id
      AND p.is_default
      AND p.workspace_id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 11. Atualiza can_access_ats_job para considerar workspace
CREATE OR REPLACE FUNCTION public.can_access_ats_job(_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ats_jobs j
    WHERE j.id = _job_id
      AND j.workspace_id IN (SELECT public.current_user_workspaces())
      AND (
        j.owner_id = auth.uid()
        OR j.hiring_manager_id = auth.uid()
        OR j.recruiter_id = auth.uid()
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_access_ats_job(uuid) TO authenticated;

-- 12. Trigger para preencher workspace_id em novos inserts
CREATE OR REPLACE FUNCTION public.ats_set_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'ats_pipelines' THEN
    IF NEW.workspace_id IS NULL THEN
      NEW.workspace_id := COALESCE(
        (SELECT active_workspace_id FROM public.profiles WHERE id = NEW.owner_id),
        public.default_workspace_for_user(NEW.owner_id)
      );
    END IF;
  ELSIF TG_TABLE_NAME = 'ats_jobs' THEN
    IF NEW.workspace_id IS NULL THEN
      NEW.workspace_id := COALESCE(
        (SELECT active_workspace_id FROM public.profiles WHERE id = NEW.owner_id),
        public.default_workspace_for_user(NEW.owner_id)
      );
    END IF;
  ELSIF TG_TABLE_NAME = 'ats_candidates' THEN
    IF NEW.workspace_id IS NULL THEN
      NEW.workspace_id := COALESCE(
        (SELECT active_workspace_id FROM public.profiles WHERE id = NEW.owner_id),
        public.default_workspace_for_user(NEW.owner_id)
      );
    END IF;
  ELSIF TG_TABLE_NAME = 'ats_applications' THEN
    IF NEW.workspace_id IS NULL THEN
      SELECT workspace_id INTO NEW.workspace_id FROM public.ats_jobs WHERE id = NEW.job_id;
      IF NEW.workspace_id IS NULL THEN
        NEW.workspace_id := COALESCE(
          (SELECT active_workspace_id FROM public.profiles WHERE id = NEW.owner_id),
          public.default_workspace_for_user(NEW.owner_id)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ats_pipelines_a_set_workspace_id ON public.ats_pipelines;
CREATE TRIGGER trg_ats_pipelines_a_set_workspace_id BEFORE INSERT ON public.ats_pipelines FOR EACH ROW EXECUTE FUNCTION public.ats_set_workspace_id();

DROP TRIGGER IF EXISTS trg_ats_jobs_a_set_workspace_id ON public.ats_jobs;
CREATE TRIGGER trg_ats_jobs_a_set_workspace_id BEFORE INSERT ON public.ats_jobs FOR EACH ROW EXECUTE FUNCTION public.ats_set_workspace_id();

DROP TRIGGER IF EXISTS trg_ats_applications_a_set_workspace_id ON public.ats_applications;
CREATE TRIGGER trg_ats_applications_a_set_workspace_id BEFORE INSERT ON public.ats_applications FOR EACH ROW EXECUTE FUNCTION public.ats_set_workspace_id();

DROP TRIGGER IF EXISTS trg_ats_candidates_a_set_workspace_id ON public.ats_candidates;
CREATE TRIGGER trg_ats_candidates_a_set_workspace_id BEFORE INSERT ON public.ats_candidates FOR EACH ROW EXECUTE FUNCTION public.ats_set_workspace_id();

-- 13. Reescreve as políticas RLS
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ats_pipelines'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ats_pipelines', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ats_jobs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ats_jobs', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ats_applications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ats_applications', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ats_candidates'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ats_candidates', pol.policyname);
  END LOOP;
END;
$$;

-- 13.1 ats_pipelines
CREATE POLICY "ats_pipelines_workspace_scope" ON public.ats_pipelines
FOR ALL TO authenticated
USING (workspace_id IN (SELECT public.current_user_workspaces()))
WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ats_pipelines_owner_all" ON public.ats_pipelines
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ats_pipelines_admin_select" ON public.ats_pipelines
FOR SELECT TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_pipelines_admin_update" ON public.ats_pipelines
FOR UPDATE TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_of(workspace_id, auth.uid()));

CREATE POLICY "ats_pipelines_admin_delete" ON public.ats_pipelines
FOR DELETE TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()));

CREATE POLICY "ats_pipelines_rbac_select" ON public.ats_pipelines
FOR SELECT TO authenticated
USING (public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.pipelines.view.workspace'));

CREATE POLICY "ats_pipelines_team_update" ON public.ats_pipelines
FOR UPDATE TO authenticated
USING (public.can_write_owner(owner_id, auth.uid()))
WITH CHECK (public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_pipelines_team_delete" ON public.ats_pipelines
FOR DELETE TO authenticated
USING (public.can_write_owner(owner_id, auth.uid()));

-- 13.2 ats_jobs
CREATE POLICY "ats_jobs_workspace_scope" ON public.ats_jobs
FOR ALL TO authenticated
USING (workspace_id IN (SELECT public.current_user_workspaces()))
WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ats_jobs_owner_all" ON public.ats_jobs
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ats_jobs_admin_select" ON public.ats_jobs
FOR SELECT TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_jobs_hiring_select" ON public.ats_jobs
FOR SELECT TO authenticated
USING ((hiring_manager_id = auth.uid() OR recruiter_id = auth.uid()) AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "ats_jobs_rbac_select" ON public.ats_jobs
FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(), workspace_id, 'techhire.jobs.view.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.jobs.view.workspace'));

CREATE POLICY "ats_jobs_admin_update" ON public.ats_jobs
FOR UPDATE TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_jobs_rbac_update" ON public.ats_jobs
FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(), workspace_id, 'techhire.jobs.update.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.jobs.update.workspace') OR ((owner_id = auth.uid()) AND (public.user_has_permission(auth.uid(), workspace_id, 'techhire.jobs.update.own') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.jobs.update.own'))))
WITH CHECK (public.user_has_permission(auth.uid(), workspace_id, 'techhire.jobs.update.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.jobs.update.workspace') OR ((owner_id = auth.uid()) AND (public.user_has_permission(auth.uid(), workspace_id, 'techhire.jobs.update.own') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.jobs.update.own'))));

CREATE POLICY "ats_jobs_admin_delete" ON public.ats_jobs
FOR DELETE TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_jobs_rbac_delete" ON public.ats_jobs
FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(), workspace_id, 'techhire.jobs.delete.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.jobs.delete.workspace'));

CREATE POLICY "ats_jobs_insert" ON public.ats_jobs
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin_of(workspace_id, auth.uid()) OR (owner_id = auth.uid() AND (public.user_has_permission(auth.uid(), workspace_id, 'techhire.jobs.create.own') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.jobs.create.own'))));

-- 13.3 ats_applications
CREATE POLICY "ats_applications_workspace_scope" ON public.ats_applications
FOR ALL TO authenticated
USING (workspace_id IN (SELECT public.current_user_workspaces()))
WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ats_applications_owner_select" ON public.ats_applications
FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "ats_applications_admin_select" ON public.ats_applications
FOR SELECT TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_applications_rbac_select" ON public.ats_applications
FOR SELECT TO authenticated
USING (public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.view.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.jobs.view.workspace'));

CREATE POLICY "ats_applications_job_access_select" ON public.ats_applications
FOR SELECT TO authenticated
USING (public.can_access_ats_job(job_id));

CREATE POLICY "ats_applications_insert" ON public.ats_applications
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() OR public.can_write_owner(owner_id, auth.uid()) OR public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.create.own'));

CREATE POLICY "ats_applications_admin_update" ON public.ats_applications
FOR UPDATE TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_applications_rbac_update" ON public.ats_applications
FOR UPDATE TO authenticated
USING (public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.update.workspace'))
WITH CHECK (public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.update.workspace'));

CREATE POLICY "ats_applications_admin_delete" ON public.ats_applications
FOR DELETE TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_applications_rbac_delete" ON public.ats_applications
FOR DELETE TO authenticated
USING (public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.delete.workspace'));

-- 13.4 ats_candidates
CREATE POLICY "ats_candidates_workspace_scope" ON public.ats_candidates
FOR ALL TO authenticated
USING (workspace_id IN (SELECT public.current_user_workspaces()))
WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ats_candidates_owner_select" ON public.ats_candidates
FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "ats_candidates_admin_select" ON public.ats_candidates
FOR SELECT TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_candidates_rbac_select" ON public.ats_candidates
FOR SELECT TO authenticated
USING (public.user_has_permission(auth.uid(), workspace_id, 'techhire.candidates.view.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.view.workspace'));

CREATE POLICY "ats_candidates_applications_select" ON public.ats_candidates
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ats_applications a WHERE a.candidate_id = ats_candidates.id AND a.workspace_id IN (SELECT public.current_user_workspaces())));

CREATE POLICY "ats_candidates_owner_update" ON public.ats_candidates
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ats_candidates_admin_update" ON public.ats_candidates
FOR UPDATE TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin_of(workspace_id, auth.uid()));

CREATE POLICY "ats_candidates_rbac_update" ON public.ats_candidates
FOR UPDATE TO authenticated
USING (public.user_has_permission(auth.uid(), workspace_id, 'techhire.candidates.update.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.update.workspace'))
WITH CHECK (public.user_has_permission(auth.uid(), workspace_id, 'techhire.candidates.update.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.update.workspace'));

CREATE POLICY "ats_candidates_owner_delete" ON public.ats_candidates
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "ats_candidates_admin_delete" ON public.ats_candidates
FOR DELETE TO authenticated
USING (public.is_workspace_admin_of(workspace_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

CREATE POLICY "ats_candidates_rbac_delete" ON public.ats_candidates
FOR DELETE TO authenticated
USING (public.user_has_permission(auth.uid(), workspace_id, 'techhire.candidates.delete.workspace') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.delete.workspace'));

CREATE POLICY "ats_candidates_insert" ON public.ats_candidates
FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_admin_of(workspace_id, auth.uid()) OR (owner_id = auth.uid() AND (public.user_has_permission(auth.uid(), workspace_id, 'techhire.candidates.create.own') OR public.techhire_rbac_gate(auth.uid(), workspace_id, 'techhire.candidates.create.own'))));
