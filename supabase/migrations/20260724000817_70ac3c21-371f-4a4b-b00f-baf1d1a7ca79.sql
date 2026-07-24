ALTER TABLE public.prospecting_queues
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'dynamic',
  ADD COLUMN IF NOT EXISTS item_ids uuid[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='prospecting_queues_kind_check') THEN
    ALTER TABLE public.prospecting_queues
      ADD CONSTRAINT prospecting_queues_kind_check CHECK (kind IN ('dynamic','manual'));
  END IF;
END $$;