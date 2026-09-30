DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.saved_views'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%entity%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.saved_views DROP CONSTRAINT %I', c); END IF;
END $$;
ALTER TABLE public.saved_views ADD CONSTRAINT saved_views_entity_check
  CHECK (entity = ANY (ARRAY['leads','contacts','companies','deals','tickets','projects','people','proposals','invoices']));