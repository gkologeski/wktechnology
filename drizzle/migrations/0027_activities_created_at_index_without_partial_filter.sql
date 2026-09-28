-- As consultas do painel não filtram deleted_at, então o índice parcial anterior
-- não era aproveitado. Criamos as versões completas e retiramos as parciais.
CREATE INDEX IF NOT EXISTS activities_ws_created_at_idx
  ON public.activities USING btree (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activities_ws_owner_created_at_idx
  ON public.activities USING btree (workspace_id, owner_id, created_at DESC);

DROP INDEX IF EXISTS public.activities_workspace_created_at_idx;
DROP INDEX IF EXISTS public.activities_workspace_owner_created_at_idx;
