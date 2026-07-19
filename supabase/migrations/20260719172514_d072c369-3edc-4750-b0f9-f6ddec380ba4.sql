
-- Grupos empresariais (agrupam vários CNPJs / legal_entities) por workspace.
CREATE TABLE public.legal_entity_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX legal_entity_groups_code_unique
  ON public.legal_entity_groups (workspace_id, lower(code))
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX legal_entity_groups_system_unique
  ON public.legal_entity_groups (workspace_id)
  WHERE is_system = TRUE;

CREATE INDEX legal_entity_groups_ws_idx ON public.legal_entity_groups(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_entity_groups TO authenticated;
GRANT ALL ON public.legal_entity_groups TO service_role;

ALTER TABLE public.legal_entity_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_legal_entity_groups_select
  ON public.legal_entity_groups FOR SELECT
  USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY ws_legal_entity_groups_write
  ON public.legal_entity_groups FOR ALL
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
  LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_legal_entity_groups_updated
  BEFORE UPDATE ON public.legal_entity_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela associativa N:N grupo <-> CNPJ.
CREATE TABLE public.legal_entity_group_members (
  group_id UUID NOT NULL REFERENCES public.legal_entity_groups(id) ON DELETE CASCADE,
  legal_entity_id UUID NOT NULL REFERENCES public.legal_entities(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, legal_entity_id)
);

CREATE INDEX legal_entity_group_members_le_idx
  ON public.legal_entity_group_members(legal_entity_id);
CREATE INDEX legal_entity_group_members_ws_idx
  ON public.legal_entity_group_members(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_entity_group_members TO authenticated;
GRANT ALL ON public.legal_entity_group_members TO service_role;

ALTER TABLE public.legal_entity_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_legal_entity_group_members_select
  ON public.legal_entity_group_members FOR SELECT
  USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY ws_legal_entity_group_members_write
  ON public.legal_entity_group_members FOR ALL
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin(auth.uid(), workspace_id)
  );

-- Backfill: cria grupo "Todas as empresas" (is_system) por workspace que tenha CNPJs
-- e popula com todos os CNPJs ativos.
INSERT INTO public.legal_entity_groups (workspace_id, code, name, description, is_system, active)
SELECT DISTINCT le.workspace_id, 'ALL', 'Todas as empresas',
       'Grupo padrão mantido automaticamente com todos os CNPJs do workspace.',
       TRUE, TRUE
FROM public.legal_entities le
ON CONFLICT DO NOTHING;

INSERT INTO public.legal_entity_group_members (group_id, legal_entity_id, workspace_id)
SELECT g.id, le.id, le.workspace_id
FROM public.legal_entity_groups g
JOIN public.legal_entities le ON le.workspace_id = g.workspace_id
WHERE g.is_system = TRUE
ON CONFLICT DO NOTHING;

-- Trigger para manter o grupo system em sincronia quando um legal_entity é criado/removido.
CREATE OR REPLACE FUNCTION public.sync_system_legal_entity_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    SELECT id INTO v_group_id FROM public.legal_entity_groups
      WHERE workspace_id = NEW.workspace_id AND is_system = TRUE;
    IF v_group_id IS NULL THEN
      INSERT INTO public.legal_entity_groups (workspace_id, code, name, description, is_system, active)
        VALUES (NEW.workspace_id, 'ALL', 'Todas as empresas',
                'Grupo padrão mantido automaticamente com todos os CNPJs do workspace.', TRUE, TRUE)
        RETURNING id INTO v_group_id;
    END IF;
    INSERT INTO public.legal_entity_group_members (group_id, legal_entity_id, workspace_id)
      VALUES (v_group_id, NEW.id, NEW.workspace_id)
      ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM public.legal_entity_group_members WHERE legal_entity_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_system_leg_group_ins
  AFTER INSERT ON public.legal_entities
  FOR EACH ROW EXECUTE FUNCTION public.sync_system_legal_entity_group();

CREATE TRIGGER trg_sync_system_leg_group_del
  AFTER DELETE ON public.legal_entities
  FOR EACH ROW EXECUTE FUNCTION public.sync_system_legal_entity_group();
