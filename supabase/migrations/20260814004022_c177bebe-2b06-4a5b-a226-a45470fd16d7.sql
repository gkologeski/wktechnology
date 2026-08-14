DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'activity_survey_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_survey_responses;
  END IF;
END $$;

ALTER TABLE public.activity_survey_responses REPLICA IDENTITY FULL;