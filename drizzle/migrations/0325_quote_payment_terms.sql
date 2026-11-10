-- CONDICOES-PAGAMENTO: condições de pagamento na cotação e na proposta.
-- Aditivo: nenhuma coluna existente é alterada, renomeada ou removida.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_terms jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payment_terms jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Preenchimento das propostas antigas a partir das parcelas que já existiam:
-- sem entrada, parcelas mensais e o mesmo dia de vencimento.
UPDATE public.proposals
SET payment_terms = jsonb_build_object(
  'downPayment', jsonb_build_object('kind', 'none'),
  'plan', jsonb_build_object(
    'kind', 'periodic',
    'count', installments_count,
    'intervalMonths', 1,
    'dueDay', coalesce(installments_due_day, 10)
  )
)
WHERE installments_count IS NOT NULL
  AND installments_count BETWEEN 1 AND 120
  AND payment_terms = '{}'::jsonb;