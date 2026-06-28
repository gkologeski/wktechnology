
CREATE TABLE public.ats_daily_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  headline text,
  summary text,
  priorities jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ats_daily_briefings_owner_generated_idx
  ON public.ats_daily_briefings (owner_id, generated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_daily_briefings TO authenticated;
GRANT ALL ON public.ats_daily_briefings TO service_role;

ALTER TABLE public.ats_daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own briefings"
  ON public.ats_daily_briefings FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
