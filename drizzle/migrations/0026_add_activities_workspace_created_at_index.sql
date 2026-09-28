-- Índice composto para acelerar as agregações do painel de vendas por período.
-- Sem ele, filtrar (workspace_id + created_at) varre ~426 mil linhas e estoura o statement timeout.
CREATE INDEX IF NOT EXISTS activities_workspace_created_at_idx
  ON public.activities USING btree (workspace_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Mesmo padrão para os recortes por responsável usados no filtro do painel.
CREATE INDEX IF NOT EXISTS activities_workspace_owner_created_at_idx
  ON public.activities USING btree (workspace_id, owner_id, created_at DESC)
  WHERE deleted_at IS NULL;
