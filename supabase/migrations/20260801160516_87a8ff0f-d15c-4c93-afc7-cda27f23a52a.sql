-- 1. Table
CREATE TABLE public.project_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'checkpoint' CHECK (kind IN ('checkpoint','auto')),
  title text NOT NULL,
  summary text,
  health text CHECK (health IN ('green','yellow','red')),
  progress_pct integer CHECK (progress_pct IS NULL OR (progress_pct >= 0 AND progress_pct <= 100)),
  expected_delivery_date date,
  visibility text NOT NULL DEFAULT 'commercial' CHECK (visibility IN ('internal','commercial')),
  published_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid,
  owner_id uuid,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_updates_project_idx ON public.project_updates (project_id, published_at DESC);
CREATE INDEX project_updates_workspace_idx ON public.project_updates (workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_updates TO authenticated;
GRANT ALL ON public.project_updates TO service_role;

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- 2. Deal-delivery visibility helper
CREATE OR REPLACE FUNCTION public.user_can_view_deal_delivery(_user uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.contracts c ON c.id = p.contract_id
    JOIN public.deals d ON d.id = c.deal_id
    WHERE p.id = _project_id
      AND (
        public.user_has_permission(_user, p.workspace_id, 'techsales.deal_delivery.view.workspace')
        OR (d.owner_id = _user AND public.user_has_permission(_user, p.workspace_id, 'techsales.deal_delivery.view.own'))
        OR (public.shares_team_with(d.owner_id, _user) AND public.user_has_permission(_user, p.workspace_id, 'techsales.deal_delivery.view.team'))
      )
  )
$$;

-- 3. Policies
CREATE POLICY project_updates_select ON public.project_updates
FOR SELECT TO authenticated
USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.project_updates.view.workspace')
  OR (visibility = 'commercial' AND public.user_can_view_deal_delivery(auth.uid(), project_id))
);

CREATE POLICY project_updates_insert ON public.project_updates
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.project_updates.create.own')
  )
);

CREATE POLICY project_updates_update ON public.project_updates
FOR UPDATE TO authenticated
USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), workspace_id, 'techprojects.project_updates.update.own'))
  OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.project_updates.update.workspace')
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), workspace_id, 'techprojects.project_updates.update.own'))
    OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.project_updates.update.workspace')
  )
);

CREATE POLICY project_updates_delete ON public.project_updates
FOR DELETE TO authenticated
USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.project_updates.delete.workspace')
);

-- 4. updated_at trigger
CREATE TRIGGER project_updates_touch_updated_at
BEFORE UPDATE ON public.project_updates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Auto macro events from project changes
CREATE OR REPLACE FUNCTION public.project_updates_log_auto_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_summary text;
  v_status_pt text;
  v_old_status_pt text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_status_pt := CASE NEW.status::text
      WHEN 'planning' THEN 'Planejamento'
      WHEN 'active' THEN 'Execução'
      WHEN 'on_hold' THEN 'Em espera'
      WHEN 'done' THEN 'Concluído'
      WHEN 'cancelled' THEN 'Cancelado'
      ELSE NEW.status::text END;
    v_old_status_pt := CASE OLD.status::text
      WHEN 'planning' THEN 'Planejamento'
      WHEN 'active' THEN 'Execução'
      WHEN 'on_hold' THEN 'Em espera'
      WHEN 'done' THEN 'Concluído'
      WHEN 'cancelled' THEN 'Cancelado'
      ELSE OLD.status::text END;
    v_title := 'Situação do projeto: ' || v_status_pt;
    v_summary := 'A situação passou de ' || v_old_status_pt || ' para ' || v_status_pt || '.';
    INSERT INTO public.project_updates (workspace_id, project_id, kind, title, summary, progress_pct, expected_delivery_date, visibility, author_id, owner_id)
    VALUES (NEW.workspace_id, NEW.id, 'auto', v_title, v_summary, NEW.progress, NEW.due_at, 'commercial', auth.uid(), NEW.owner_id);
  END IF;

  IF COALESCE(NEW.progress, 0) IS DISTINCT FROM COALESCE(OLD.progress, 0) THEN
    INSERT INTO public.project_updates (workspace_id, project_id, kind, title, summary, progress_pct, expected_delivery_date, visibility, author_id, owner_id)
    VALUES (NEW.workspace_id, NEW.id, 'auto', 'Evolução atualizada',
      'A evolução passou de ' || COALESCE(OLD.progress, 0) || '% para ' || COALESCE(NEW.progress, 0) || '%.',
      NEW.progress, NEW.due_at, 'commercial', auth.uid(), NEW.owner_id);
  END IF;

  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    INSERT INTO public.project_updates (workspace_id, project_id, kind, title, summary, progress_pct, expected_delivery_date, visibility, author_id, owner_id)
    VALUES (NEW.workspace_id, NEW.id, 'auto', 'Previsão de entrega alterada',
      CASE
        WHEN OLD.due_at IS NULL THEN 'Previsão de entrega definida para ' || to_char(NEW.due_at, 'DD/MM/YYYY') || '.'
        WHEN NEW.due_at IS NULL THEN 'A previsão de entrega foi removida.'
        ELSE 'A previsão de entrega passou de ' || to_char(OLD.due_at, 'DD/MM/YYYY') || ' para ' || to_char(NEW.due_at, 'DD/MM/YYYY') || '.'
      END,
      NEW.progress, NEW.due_at, 'commercial', auth.uid(), NEW.owner_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_log_macro_events
AFTER UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.project_updates_log_auto_event();

-- 6. Permission catalog
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
  ('techsales.deal_delivery.view.own', 'techsales', 'deal_delivery', 'view', 'own', 'Acompanhar entrega dos meus negócios', 'Vê a evolução macro dos projetos originados dos negócios do próprio usuário', true),
  ('techsales.deal_delivery.view.team', 'techsales', 'deal_delivery', 'view', 'team', 'Acompanhar entrega dos negócios da minha equipe', NULL, true),
  ('techsales.deal_delivery.view.workspace', 'techsales', 'deal_delivery', 'view', 'workspace', 'Acompanhar entrega de todos os negócios', NULL, true),
  ('techprojects.project_updates.view.workspace', 'techprojects', 'project_updates', 'view', 'workspace', 'Exibir acompanhamentos de projeto', NULL, true),
  ('techprojects.project_updates.create.own', 'techprojects', 'project_updates', 'create', 'own', 'Publicar acompanhamento de projeto', NULL, true),
  ('techprojects.project_updates.update.own', 'techprojects', 'project_updates', 'update', 'own', 'Editar meus acompanhamentos de projeto', NULL, true),
  ('techprojects.project_updates.update.workspace', 'techprojects', 'project_updates', 'update', 'workspace', 'Editar acompanhamentos de projeto', NULL, true),
  ('techprojects.project_updates.delete.workspace', 'techprojects', 'project_updates', 'delete', 'workspace', 'Excluir acompanhamentos de projeto', NULL, true)
ON CONFLICT (key) DO NOTHING;

-- 7. Additive backfill: whoever can already see own deals can follow their delivery
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT DISTINCT psi.set_id, 'techsales.deal_delivery.view.own'
FROM public.permission_set_items psi
WHERE psi.permission_key IN ('techsales.deals.view.own','techsales.deals.view.team','techsales.deals.view.workspace')
ON CONFLICT DO NOTHING;

INSERT INTO public.job_role_default_permissions (role_id, permission_key)
SELECT DISTINCT jrp.role_id, 'techsales.deal_delivery.view.own'
FROM public.job_role_default_permissions jrp
WHERE jrp.permission_key IN ('techsales.deals.view.own','techsales.deals.view.team','techsales.deals.view.workspace')
ON CONFLICT DO NOTHING;

INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT DISTINCT psi.set_id, 'techprojects.project_updates.view.workspace'
FROM public.permission_set_items psi
WHERE psi.permission_key = 'techprojects.projects.view.workspace'
ON CONFLICT DO NOTHING;

INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT DISTINCT psi.set_id, 'techprojects.project_updates.create.own'
FROM public.permission_set_items psi
WHERE psi.permission_key = 'techprojects.projects.update.workspace'
ON CONFLICT DO NOTHING;

INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT DISTINCT psi.set_id, 'techprojects.project_updates.update.own'
FROM public.permission_set_items psi
WHERE psi.permission_key = 'techprojects.projects.update.workspace'
ON CONFLICT DO NOTHING;