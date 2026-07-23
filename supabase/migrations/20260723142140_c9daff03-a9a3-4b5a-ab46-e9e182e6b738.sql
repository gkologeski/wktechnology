
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS monthly_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS hours_per_month integer,
  ADD COLUMN IF NOT EXISTS payment_day smallint,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS late_fee_percent numeric(6,3),
  ADD COLUMN IF NOT EXISTS late_interest_monthly_percent numeric(6,3),
  ADD COLUMN IF NOT EXISTS expense_reimbursement_days smallint,
  ADD COLUMN IF NOT EXISTS penalty_percent numeric(6,3),
  ADD COLUMN IF NOT EXISTS cure_period_days smallint,
  ADD COLUMN IF NOT EXISTS trial_period_days smallint,
  ADD COLUMN IF NOT EXISTS unilateral_termination_notice_days smallint,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS service_scope text,
  ADD COLUMN IF NOT EXISTS service_location text,
  ADD COLUMN IF NOT EXISTS governing_law text,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS confidentiality_term_months smallint,
  ADD COLUMN IF NOT EXISTS contracting_legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature_provider text,
  ADD COLUMN IF NOT EXISTS signature_document_id text,
  ADD COLUMN IF NOT EXISTS signature_operation_id text,
  ADD COLUMN IF NOT EXISTS source_file_path text,
  ADD COLUMN IF NOT EXISTS imported_from text,
  ADD COLUMN IF NOT EXISTS import_confidence numeric(4,3);

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_payment_day_range CHECK (payment_day IS NULL OR (payment_day BETWEEN 1 AND 31));
