ALTER TABLE public.ats_sourcing_sequence_steps
  ADD COLUMN IF NOT EXISTS variant_label TEXT NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS variant_weight INTEGER NOT NULL DEFAULT 1;

-- Replace unique(sequence_id, step_order) with unique(sequence_id, step_order, variant_label) to allow multiple A/B variants per step.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ats_sourcing_sequence_steps'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.ats_sourcing_sequence_steps DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.ats_sourcing_sequence_steps
  ADD CONSTRAINT ats_sourcing_sequence_steps_seq_step_variant_unique
  UNIQUE (sequence_id, step_order, variant_label);

CREATE INDEX IF NOT EXISTS idx_ats_sourcing_step_log_metadata_variant
  ON public.ats_sourcing_step_log USING GIN (metadata);