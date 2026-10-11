-- Índice de cobertura das colunas lidas pelas policies de activities: contagens/listas amplas sob RLS
-- passam a Index Only Scan (visibility map ~99,8%) em vez de ler o heap inteiro (~2,3 GB).
-- Evidência isolada: 300k linhas, Index Only Scan, Heap Fetches 0, ~4,7k buffers vs 60k páginas de heap.
CREATE INDEX IF NOT EXISTS activities_rls_cover_idx ON public.activities
  (workspace_id, owner_id, assigned_to)
  INCLUDE (related_lead_id, related_deal_id, related_contact_id, related_company_id, id);