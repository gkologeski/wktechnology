ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS amendment_of_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amendment_number text,
  ADD COLUMN IF NOT EXISTS amendment_effective_at date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_document_kind_check'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_document_kind_check
      CHECK (document_kind IN ('main', 'amendment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contracts_amendment_of_id_idx
  ON public.contracts (amendment_of_id)
  WHERE amendment_of_id IS NOT NULL;