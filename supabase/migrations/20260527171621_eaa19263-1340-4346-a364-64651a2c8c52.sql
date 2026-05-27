
CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sources TO authenticated;
GRANT ALL ON public.lead_sources TO service_role;

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_sources select" ON public.lead_sources
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.shares_workspace_with(owner_id));

CREATE POLICY "lead_sources insert" ON public.lead_sources
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "lead_sources update" ON public.lead_sources
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.shares_workspace_with(owner_id));

CREATE POLICY "lead_sources delete" ON public.lead_sources
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.shares_workspace_with(owner_id));

CREATE TRIGGER lead_sources_set_updated_at
BEFORE UPDATE ON public.lead_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.lead_sources (owner_id, name)
SELECT DISTINCT owner_id, source
FROM public.leads
WHERE source IS NOT NULL AND source <> ''
ON CONFLICT (owner_id, name) DO NOTHING;
