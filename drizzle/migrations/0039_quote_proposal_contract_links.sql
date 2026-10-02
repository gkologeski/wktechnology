ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_line text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS service_line text;
CREATE INDEX IF NOT EXISTS proposals_quote_id_idx ON public.proposals(quote_id);
CREATE INDEX IF NOT EXISTS contracts_proposal_id_idx ON public.contracts(proposal_id);
CREATE INDEX IF NOT EXISTS contracts_quote_id_idx ON public.contracts(quote_id);