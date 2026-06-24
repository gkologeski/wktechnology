
-- 1) Primeiro adiciona as colunas em ats_interviews (sem FK ainda)
ALTER TABLE public.ats_interviews
  ADD COLUMN IF NOT EXISTS interview_kit_id uuid,
  ADD COLUMN IF NOT EXISTS async_questions_snapshot jsonb;

-- 2) Cria tabela de kits
CREATE TABLE public.ats_interview_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  pipeline_id uuid REFERENCES public.ats_pipelines(id) ON DELETE SET NULL,
  stage_value text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_interview_kits TO authenticated;
GRANT ALL ON public.ats_interview_kits TO service_role;
GRANT SELECT ON public.ats_interview_kits TO anon;

ALTER TABLE public.ats_interview_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ats_interview_kits_owner_all"
  ON public.ats_interview_kits FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ats_interview_kits_public_when_referenced"
  ON public.ats_interview_kits FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.ats_interviews i
      WHERE i.interview_kit_id = public.ats_interview_kits.id
        AND i.self_schedule_token IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.touch_ats_interview_kits_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_touch_ats_interview_kits
  BEFORE UPDATE ON public.ats_interview_kits
  FOR EACH ROW EXECUTE FUNCTION public.touch_ats_interview_kits_updated_at();

CREATE INDEX idx_ats_interview_kits_owner ON public.ats_interview_kits(owner_id);
CREATE INDEX idx_ats_interview_kits_stage ON public.ats_interview_kits(pipeline_id, stage_value);

-- 3) Agora liga a FK em ats_interviews
ALTER TABLE public.ats_interviews
  ADD CONSTRAINT ats_interviews_interview_kit_id_fkey
  FOREIGN KEY (interview_kit_id) REFERENCES public.ats_interview_kits(id) ON DELETE SET NULL;

-- 4) Respostas em vídeo assíncrono
CREATE TABLE public.ats_async_video_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  interview_id uuid NOT NULL REFERENCES public.ats_interviews(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  storage_path text NOT NULL,
  duration_sec integer,
  mime_type text,
  size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_async_video_responses TO authenticated;
GRANT ALL ON public.ats_async_video_responses TO service_role;
GRANT SELECT, INSERT ON public.ats_async_video_responses TO anon;

ALTER TABLE public.ats_async_video_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ats_avr_owner_select"
  ON public.ats_async_video_responses FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "ats_avr_owner_delete"
  ON public.ats_async_video_responses FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY "ats_avr_public_insert_via_interview"
  ON public.ats_async_video_responses FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ats_interviews i
      WHERE i.id = ats_async_video_responses.interview_id
        AND i.owner_id = ats_async_video_responses.owner_id
        AND i.self_schedule_token IS NOT NULL
        AND i.kind = 'async'
    )
  );

CREATE POLICY "ats_avr_public_select_via_interview"
  ON public.ats_async_video_responses FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.ats_interviews i
      WHERE i.id = ats_async_video_responses.interview_id
        AND i.self_schedule_token IS NOT NULL
    )
  );

CREATE INDEX idx_ats_avr_interview ON public.ats_async_video_responses(interview_id);
CREATE INDEX idx_ats_avr_owner ON public.ats_async_video_responses(owner_id);
