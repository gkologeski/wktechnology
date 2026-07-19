
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS parent_entry_id uuid NULL REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installment_number smallint NULL,
  ADD COLUMN IF NOT EXISTS installment_total smallint NULL;

CREATE INDEX IF NOT EXISTS idx_financial_entries_parent ON public.financial_entries(parent_entry_id, installment_number);
