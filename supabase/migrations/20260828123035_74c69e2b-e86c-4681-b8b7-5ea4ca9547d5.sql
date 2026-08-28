ALTER TABLE public.lead_sources ADD COLUMN IF NOT EXISTS label text;

CREATE UNIQUE INDEX IF NOT EXISTS lead_sources_workspace_name_uniq
  ON public.lead_sources (workspace_id, lower(name))
  WHERE workspace_id IS NOT NULL;