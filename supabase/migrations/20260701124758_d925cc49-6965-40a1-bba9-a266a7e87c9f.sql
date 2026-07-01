DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='ats_sourcing_enrollments'
      AND constraint_name='ats_sourcing_enrollments_status_check'
  ) THEN
    ALTER TABLE public.ats_sourcing_enrollments DROP CONSTRAINT ats_sourcing_enrollments_status_check;
    ALTER TABLE public.ats_sourcing_enrollments ADD CONSTRAINT ats_sourcing_enrollments_status_check
      CHECK (status = ANY (ARRAY['active','paused','completed','stopped','replied']));
  END IF;
END $$;