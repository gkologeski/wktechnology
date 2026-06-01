-- Bug reports table
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('new_feature','existing_broken')),
  category TEXT NOT NULL,
  subtype TEXT NOT NULL,
  description TEXT NOT NULL,
  recording_path TEXT,
  recording_has_audio BOOLEAN NOT NULL DEFAULT false,
  page_url TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bug reports"
  ON public.bug_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own bug reports"
  ON public.bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own bug reports"
  ON public.bug_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER bug_reports_set_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_bug_reports_owner_created ON public.bug_reports(owner_id, created_at DESC);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-reports', 'bug-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own bug recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bug-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own bug recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'bug-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own bug recordings"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'bug-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
