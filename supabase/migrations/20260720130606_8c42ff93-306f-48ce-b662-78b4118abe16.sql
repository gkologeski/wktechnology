ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS counterparty_legal_entity_id uuid NULL REFERENCES public.legal_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_entries_counterparty_legal_entity
  ON public.financial_entries(counterparty_legal_entity_id)
  WHERE counterparty_legal_entity_id IS NOT NULL;

COMMENT ON COLUMN public.financial_entries.counterparty_legal_entity_id IS
  'Quando preenchido, indica a empresa contra-parte (outro CNPJ) da transação. Usado para eliminação intercompany em DRE e Fluxo de Caixa consolidados por grupo empresarial.';