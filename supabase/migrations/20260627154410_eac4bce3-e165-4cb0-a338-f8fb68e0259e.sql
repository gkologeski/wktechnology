
-- ATS Hunting: templates + capturas via extensão Chrome.
-- Tabelas seguem o padrão ATS (owner_id = workspace).

CREATE TABLE IF NOT EXISTS public.ats_hunting_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('linkedin_inmail','linkedin_connect','linkedin_message')),
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_hunting_templates TO authenticated;
GRANT ALL ON public.ats_hunting_templates TO service_role;

ALTER TABLE public.ats_hunting_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hunting_templates_owner_all"
  ON public.ats_hunting_templates FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_hunting_templates_updated_at
  BEFORE UPDATE ON public.ats_hunting_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_hunting_templates_owner ON public.ats_hunting_templates(owner_id);


-- Auditoria append-only do que a extensão envia. raw_payload guarda o snapshot
-- dos campos públicos extraídos do DOM do LinkedIn.
CREATE TABLE IF NOT EXISTS public.ats_hunting_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  parser_version text,
  session_id text,
  captured_by uuid,
  captured_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_hunting_captures TO authenticated;
GRANT ALL ON public.ats_hunting_captures TO service_role;

ALTER TABLE public.ats_hunting_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hunting_captures_owner_all"
  ON public.ats_hunting_captures FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_hunting_captures_owner ON public.ats_hunting_captures(owner_id);
CREATE INDEX IF NOT EXISTS idx_hunting_captures_candidate ON public.ats_hunting_captures(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hunting_captures_captured_at ON public.ats_hunting_captures(captured_at DESC);


-- Índice único parcial para dedupe por linkedin_url dentro do workspace.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ats_candidates_owner_linkedin
  ON public.ats_candidates(owner_id, lower(linkedin_url))
  WHERE linkedin_url IS NOT NULL;
