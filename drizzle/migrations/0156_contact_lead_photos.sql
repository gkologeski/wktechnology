ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS photo_url text, ADD COLUMN IF NOT EXISTS photo_source text, ADD COLUMN IF NOT EXISTS photo_updated_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS photo_url text, ADD COLUMN IF NOT EXISTS photo_source text, ADD COLUMN IF NOT EXISTS photo_updated_at timestamptz;
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_photo_source_chk;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_photo_source_chk CHECK (photo_source IS NULL OR photo_source IN ('manual','linkedin'));
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_photo_source_chk;
ALTER TABLE public.leads ADD CONSTRAINT leads_photo_source_chk CHECK (photo_source IS NULL OR photo_source IN ('manual','linkedin'));
COMMENT ON COLUMN public.contacts.photo_url IS 'Caminho no bucket privado contact-photos (não é URL pública).';
COMMENT ON COLUMN public.leads.photo_url IS 'Caminho no bucket privado contact-photos (não é URL pública).';