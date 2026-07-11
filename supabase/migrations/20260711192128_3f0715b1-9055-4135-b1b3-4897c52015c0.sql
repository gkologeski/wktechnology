
-- Onda 6: novas chaves de permissão para webhooks e workflows,
-- concedidas aos cargos administrativos de sistema.
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system)
VALUES
  ('system.webhooks.manage.workspace',  'system', 'webhooks',  'manage', 'workspace', 'Gerenciar webhooks',  'Criar, editar, desativar e reenviar webhooks de saída', true),
  ('system.workflows.manage.workspace', 'system', 'workflows', 'manage', 'workspace', 'Gerenciar workflows', 'Criar, editar, publicar e excluir automações',          true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT s.id, p.key
FROM public.permission_sets s
CROSS JOIN (VALUES
  ('system.webhooks.manage.workspace'),
  ('system.workflows.manage.workspace')
) AS p(key)
WHERE s.id IN (
  '00000000-0000-0000-0000-0000000000a1'::uuid, -- Super Admin
  '00000000-0000-0000-0000-0000000000a2'::uuid, -- Admin
  '00000000-0000-0000-0000-0000000000a3'::uuid, -- Sales Manager
  '33333333-0000-4000-8000-000000000001'::uuid, -- Workspace Admin
  '33333333-0000-4000-8000-000000000002'::uuid, -- Workspace Owner
  '11111111-0000-4000-8000-000000000004'::uuid, -- TechSales Admin
  '11111111-0000-4000-8000-000000000003'::uuid, -- TechSales Manager
  '22222222-0000-4000-8000-000000000004'::uuid, -- TechHire Admin
  '22222222-0000-4000-8000-000000000003'::uuid  -- TechHire Manager
)
ON CONFLICT DO NOTHING;
