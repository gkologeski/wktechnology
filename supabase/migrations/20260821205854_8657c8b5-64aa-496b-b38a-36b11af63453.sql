-- Fase 1: padrão de leitura ampla governado por permissões
DO $$
DECLARE
  v_set uuid;
BEGIN
  SELECT id INTO v_set
    FROM public.permission_sets
   WHERE name = 'Visibilidade total (padrão)' AND owner_id IS NULL AND workspace_id IS NULL
   LIMIT 1;

  IF v_set IS NULL THEN
    INSERT INTO public.permission_sets (owner_id, workspace_id, module, name, description, is_system)
    VALUES (NULL, NULL, 'system', 'Visibilidade total (padrão)',
            'Permite visualizar todos os registros do workspace. Ajuste manualmente para restringir.', true)
    RETURNING id INTO v_set;
  END IF;

  INSERT INTO public.permission_set_items (set_id, permission_key)
  SELECT v_set, p.key FROM public.permissions p WHERE p.action = 'view'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.job_role_sets (role_id, set_id)
  SELECT jr.id, v_set FROM public.job_roles jr
  ON CONFLICT DO NOTHING;
END $$;

-- Cargos limitados a "own" passam a ter abrangência de workspace
UPDATE public.job_roles SET data_scope = 'workspace', updated_at = now()
 WHERE data_scope <> 'workspace';

-- Novos cargos do sistema herdam as permissões de visualização
INSERT INTO public.job_role_default_permissions (role_id, permission_key)
SELECT jr.id, p.key
  FROM public.job_roles jr
  CROSS JOIN public.permissions p
 WHERE p.action = 'view'
ON CONFLICT DO NOTHING;

-- Remove negações antigas de permissões de visualização
DELETE FROM public.job_role_permission_overrides
 WHERE effect = 'deny' AND permission_key LIKE '%.view.%';