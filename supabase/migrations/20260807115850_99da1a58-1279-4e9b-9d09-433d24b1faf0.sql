ALTER TABLE public.people_allocations
  ADD COLUMN IF NOT EXISTS purchase_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS people_allocations_purchase_contract_id_idx
  ON public.people_allocations (purchase_contract_id);

COMMENT ON COLUMN public.people_allocations.contract_id IS 'Contrato de prestação (cliente final).';
COMMENT ON COLUMN public.people_allocations.purchase_contract_id IS 'Contrato de compra (fornecedor/PJ) cujo contratante é uma entidade legal do workspace.';