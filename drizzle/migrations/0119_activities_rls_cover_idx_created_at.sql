-- Substitui activities_rls_cover_idx (0118) por versão que também cobre created_at:
-- 1ª página ordenada sob RLS passa a Index Only Scan (isolado: Heap Fetches 0, 127 ms; real antes: timeout 8 s).
CREATE INDEX IF NOT EXISTS activities_rls_cover2_idx ON public.activities
  (workspace_id, owner_id, assigned_to)
  INCLUDE (related_lead_id, related_deal_id, related_contact_id, related_company_id, id, created_at);
DROP INDEX IF EXISTS public.activities_rls_cover_idx;