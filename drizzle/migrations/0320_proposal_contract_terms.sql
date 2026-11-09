ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS installments_count integer CHECK (installments_count IS NULL OR installments_count BETWEEN 1 AND 120);
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS installments_due_day integer CHECK (installments_due_day IS NULL OR installments_due_day BETWEEN 1 AND 31);
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 90 CHECK (validity_days BETWEEN 1 AND 3650);
COMMENT ON COLUMN public.proposals.validity_days IS 'Vigência do contrato em dias (padrão 90), copiada para o contrato.';