-- Sprint G — Fase 5: Pagamentos a fornecedores (AP) via Open Finance.
CREATE TABLE IF NOT EXISTS public.bank_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  financial_entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('pix','ted','boleto')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  scheduled_for DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','processing','paid','failed','canceled')),
  -- Beneficiário
  favored_name TEXT,
  favored_document TEXT,
  pix_key TEXT,
  pix_key_type TEXT CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random') OR pix_key_type IS NULL),
  boleto_barcode TEXT,
  boleto_digitable_line TEXT,
  -- Provider tracking
  external_id TEXT,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_payments_workspace ON public.bank_payments(workspace_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_bank_payments_connection ON public.bank_payments(connection_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_payments_entry ON public.bank_payments(financial_entry_id) WHERE financial_entry_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_payments_external ON public.bank_payments(connection_id, external_id) WHERE external_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_payments TO authenticated;
GRANT ALL ON public.bank_payments TO service_role;

ALTER TABLE public.bank_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_payments_admin_select"
  ON public.bank_payments FOR SELECT
  TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "bank_payments_admin_insert"
  ON public.bank_payments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "bank_payments_admin_update"
  ON public.bank_payments FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "bank_payments_admin_delete"
  ON public.bank_payments FOR DELETE
  TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE TRIGGER trg_bank_payments_updated_at
  BEFORE UPDATE ON public.bank_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();