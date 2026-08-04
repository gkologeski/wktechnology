-- ============ Modelos de contrato (TechContracts) ============
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  assigned_to UUID NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  role public.contract_role NOT NULL DEFAULT 'provider',
  service_type TEXT NULL,
  body_html TEXT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file_path TEXT NULL,
  imported_from TEXT NOT NULL DEFAULT 'manual' CHECK (imported_from IN ('manual','docx','pdf')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contract_templates_ws_idx ON public.contract_templates (workspace_id, status);
CREATE INDEX contract_templates_owner_idx ON public.contract_templates (owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;
GRANT ALL ON public.contract_templates TO service_role;

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_templates_select" ON public.contract_templates
FOR SELECT TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    owner_id = auth.uid()
    OR public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.view.workspace')
    OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.view.own')
  )
);

CREATE POLICY "contract_templates_insert" ON public.contract_templates
FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND owner_id = auth.uid()
  AND (
    public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.create.own')
  )
);

CREATE POLICY "contract_templates_update" ON public.contract_templates
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.update.workspace')
    OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.update.own'))
  )
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.update.workspace')
    OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.update.own'))
  )
);

CREATE POLICY "contract_templates_delete" ON public.contract_templates
FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.delete.workspace')
    OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contract_templates.delete.own'))
  )
);

CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Vínculo modelo <-> serviço do catálogo ============
CREATE TABLE public.contract_template_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  service_catalog_id UUID NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, service_catalog_id)
);

CREATE INDEX contract_template_services_tpl_idx ON public.contract_template_services (template_id);
CREATE INDEX contract_template_services_svc_idx ON public.contract_template_services (service_catalog_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_template_services TO authenticated;
GRANT ALL ON public.contract_template_services TO service_role;

ALTER TABLE public.contract_template_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_template_services_select" ON public.contract_template_services
FOR SELECT TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND EXISTS (
    SELECT 1 FROM public.contract_templates t
    WHERE t.id = contract_template_services.template_id
      AND t.workspace_id = contract_template_services.workspace_id
  )
);

CREATE POLICY "contract_template_services_write" ON public.contract_template_services
FOR ALL TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND EXISTS (
    SELECT 1 FROM public.contract_templates t
    WHERE t.id = contract_template_services.template_id
      AND t.workspace_id = contract_template_services.workspace_id
      AND (
        public.is_workspace_admin_v2(t.workspace_id, auth.uid())
        OR public.user_has_permission(auth.uid(), t.workspace_id, 'techcontracts.contract_templates.update.workspace')
        OR (t.owner_id = auth.uid() AND public.user_has_permission(auth.uid(), t.workspace_id, 'techcontracts.contract_templates.update.own'))
      )
  )
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND EXISTS (
    SELECT 1 FROM public.contract_templates t
    WHERE t.id = contract_template_services.template_id
      AND t.workspace_id = contract_template_services.workspace_id
      AND (
        public.is_workspace_admin_v2(t.workspace_id, auth.uid())
        OR public.user_has_permission(auth.uid(), t.workspace_id, 'techcontracts.contract_templates.update.workspace')
        OR (t.owner_id = auth.uid() AND public.user_has_permission(auth.uid(), t.workspace_id, 'techcontracts.contract_templates.update.own'))
      )
  )
);

-- ============ Catálogo de permissões ============
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, is_system)
VALUES
  ('techcontracts.contract_templates.view.own', 'techcontracts', 'contract_templates', 'view', 'own', 'Exibir Modelos de contrato (apenas os meus registros)', true),
  ('techcontracts.contract_templates.view.team', 'techcontracts', 'contract_templates', 'view', 'team', 'Exibir Modelos de contrato (registros da minha equipe)', true),
  ('techcontracts.contract_templates.view.workspace', 'techcontracts', 'contract_templates', 'view', 'workspace', 'Exibir Modelos de contrato (todos os registros)', true),
  ('techcontracts.contract_templates.create.own', 'techcontracts', 'contract_templates', 'create', 'own', 'Criar Modelos de contrato', true),
  ('techcontracts.contract_templates.create.workspace', 'techcontracts', 'contract_templates', 'create', 'workspace', 'Criar Modelos de contrato (todos os registros)', true),
  ('techcontracts.contract_templates.update.own', 'techcontracts', 'contract_templates', 'update', 'own', 'Editar Modelos de contrato (apenas os meus registros)', true),
  ('techcontracts.contract_templates.update.team', 'techcontracts', 'contract_templates', 'update', 'team', 'Editar Modelos de contrato (registros da minha equipe)', true),
  ('techcontracts.contract_templates.update.workspace', 'techcontracts', 'contract_templates', 'update', 'workspace', 'Editar Modelos de contrato (todos os registros)', true),
  ('techcontracts.contract_templates.delete.own', 'techcontracts', 'contract_templates', 'delete', 'own', 'Excluir Modelos de contrato (apenas os meus registros)', true),
  ('techcontracts.contract_templates.delete.workspace', 'techcontracts', 'contract_templates', 'delete', 'workspace', 'Excluir Modelos de contrato (todos os registros)', true)
ON CONFLICT (key) DO NOTHING;