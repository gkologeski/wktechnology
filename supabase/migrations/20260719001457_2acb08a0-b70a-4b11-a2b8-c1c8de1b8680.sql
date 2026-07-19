-- Bank Charges (Pix + Boleto)
CREATE TABLE public.bank_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('pix','boleto')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','canceled','expired')),
  payer_name TEXT,
  payer_document TEXT,
  description TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  boleto_barcode TEXT,
  boleto_digitable_line TEXT,
  boleto_url TEXT,
  external_id TEXT,
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_charges_owner ON public.bank_charges(owner_id);
CREATE INDEX idx_bank_charges_connection ON public.bank_charges(connection_id);
CREATE INDEX idx_bank_charges_entry ON public.bank_charges(financial_entry_id);
CREATE INDEX idx_bank_charges_status ON public.bank_charges(status);
CREATE INDEX idx_bank_charges_external ON public.bank_charges(external_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_charges TO authenticated;
GRANT ALL ON public.bank_charges TO service_role;

ALTER TABLE public.bank_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_charges_select_own" ON public.bank_charges
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "bank_charges_insert_own" ON public.bank_charges
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "bank_charges_update_own" ON public.bank_charges
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "bank_charges_delete_own" ON public.bank_charges
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE TRIGGER trg_bank_charges_updated_at
  BEFORE UPDATE ON public.bank_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
