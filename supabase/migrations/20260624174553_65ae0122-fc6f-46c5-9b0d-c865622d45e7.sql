
CREATE TABLE IF NOT EXISTS public.ats_stage_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  stage_value text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, stage_value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_stage_emails TO authenticated;
GRANT ALL ON public.ats_stage_emails TO service_role;
ALTER TABLE public.ats_stage_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ats_stage_emails select" ON public.ats_stage_emails FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own ats_stage_emails write" ON public.ats_stage_emails FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ats_stage_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  application_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  job_id uuid,
  stage_value text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS ats_stage_email_log_owner_app_idx ON public.ats_stage_email_log (owner_id, application_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_stage_email_log TO authenticated;
GRANT ALL ON public.ats_stage_email_log TO service_role;
ALTER TABLE public.ats_stage_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ats_stage_email_log select" ON public.ats_stage_email_log FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own ats_stage_email_log write" ON public.ats_stage_email_log FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DO $$ BEGIN
  CREATE POLICY "ats-cvs read own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ats-cvs' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ats-cvs insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ats-cvs' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "ats-cvs delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ats-cvs' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
