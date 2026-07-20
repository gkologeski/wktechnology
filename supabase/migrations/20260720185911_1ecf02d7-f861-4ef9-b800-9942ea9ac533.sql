
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
  ('techsales.companies.create.own', 'techsales', 'companies', 'create', 'own', 'Criar empresas', 'Criar empresas próprias', true),
  ('techsales.companies.update.own', 'techsales', 'companies', 'update', 'own', 'Editar empresas próprias', 'Editar empresas próprias', true),
  ('techsales.companies.delete.own', 'techsales', 'companies', 'delete', 'own', 'Excluir empresas próprias', 'Excluir empresas próprias', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT DISTINCT psi.set_id, replace(psi.permission_key, 'contacts', 'companies')
FROM public.permission_set_items psi
WHERE psi.permission_key IN (
  'techsales.contacts.create.own',
  'techsales.contacts.update.own',
  'techsales.contacts.delete.own'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT DISTINCT set_id, 'techsales.companies.update.own'
FROM public.permission_set_items
WHERE permission_key = 'techsales.contacts.update.workspace'
ON CONFLICT DO NOTHING;

INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT DISTINCT set_id, 'techsales.companies.delete.own'
FROM public.permission_set_items
WHERE permission_key = 'techsales.contacts.delete.workspace'
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS ws_insert_companies ON public.companies;
DROP POLICY IF EXISTS ws_update_companies ON public.companies;
DROP POLICY IF EXISTS ws_delete_companies ON public.companies;

CREATE POLICY ws_insert_companies ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      user_has_permission(auth.uid(), workspace_id, 'techsales.companies.create.own')
      OR user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
    )
  );

CREATE POLICY ws_update_companies ON public.companies
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
      OR (user_has_permission(auth.uid(), workspace_id, 'techsales.companies.update.own') AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
      OR (user_has_permission(auth.uid(), workspace_id, 'techsales.companies.update.own') AND owner_id = auth.uid())
    )
  );

CREATE POLICY ws_delete_companies ON public.companies
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
      OR (user_has_permission(auth.uid(), workspace_id, 'techsales.companies.delete.own') AND owner_id = auth.uid())
    )
  );
