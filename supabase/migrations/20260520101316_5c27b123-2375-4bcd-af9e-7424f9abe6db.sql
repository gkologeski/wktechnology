
DO $$ BEGIN
  CREATE TYPE public.prospecting_status AS ENUM ('pending','running','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.prospecting_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  role_title TEXT,
  company_size TEXT,
  location TEXT,
  keywords TEXT,
  instructions TEXT,
  max_results INT NOT NULL DEFAULT 10 CHECK (max_results BETWEEN 1 AND 50),
  status public.prospecting_status NOT NULL DEFAULT 'pending',
  error TEXT,
  ran_at TIMESTAMPTZ,
  result_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospecting_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  search_id UUID NOT NULL REFERENCES public.prospecting_searches(id) ON DELETE CASCADE,
  company_name TEXT,
  contact_name TEXT,
  role_title TEXT,
  email_hint TEXT,
  domain_hint TEXT,
  location TEXT,
  reason TEXT,
  imported_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_owner ON public.prospecting_results(owner_id, search_id);
CREATE INDEX IF NOT EXISTS idx_ps_owner ON public.prospecting_searches(owner_id, created_at DESC);

ALTER TABLE public.prospecting_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psearch_all" ON public.prospecting_searches FOR ALL
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "presult_all" ON public.prospecting_results FOR ALL
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE TRIGGER prospecting_searches_set_updated_at
  BEFORE UPDATE ON public.prospecting_searches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
