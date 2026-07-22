
-- 1. Novas permissões de exclusão
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system)
VALUES
  ('techsales.deals.delete.own', 'techsales', 'deals', 'delete', 'own', 'Excluir negócios próprios', 'Excluir apenas negócios onde é responsável', true),
  ('techsales.deals.delete.team', 'techsales', 'deals', 'delete', 'team', 'Excluir negócios da equipe', 'Excluir negócios da própria equipe', true)
ON CONFLICT (key) DO NOTHING;

-- 2. Nova policy de DELETE com tiers
DROP POLICY IF EXISTS ws_delete_deals ON public.deals;
CREATE POLICY ws_delete_deals ON public.deals
FOR DELETE
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.delete.workspace')
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.delete.team')
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.delete.own')
      AND owner_id = auth.uid()
    )
  )
);

-- 3. Snapshot de defaults: espelhar delete a partir do update já semeado
INSERT INTO public.job_role_default_permissions (role_id, permission_key)
SELECT d.role_id, replace(d.permission_key, 'update.', 'delete.')
FROM public.job_role_default_permissions d
WHERE d.permission_key IN (
  'techsales.deals.update.workspace',
  'techsales.deals.update.team',
  'techsales.deals.update.own'
)
ON CONFLICT DO NOTHING;

-- 4. Propagar para os bundles ativos (permission_set_items) referenciados por job_role_sets
--    para que as novas permissões apareçam imediatamente na matriz de todos os workspaces.
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT DISTINCT jrs.set_id, replace(psi.permission_key, 'update.', 'delete.') AS permission_key
FROM public.job_role_sets jrs
JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
WHERE psi.permission_key IN (
  'techsales.deals.update.workspace',
  'techsales.deals.update.team',
  'techsales.deals.update.own'
)
ON CONFLICT DO NOTHING;
