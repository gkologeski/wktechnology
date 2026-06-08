
-- ============ customer_invoices ============
CREATE TABLE public.customer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paid','overdue','cancelled','refunded')),
  gateway text CHECK (gateway IN ('asaas','pagarme','mercadopago','manual')),
  gateway_mode text DEFAULT 'sandbox' CHECK (gateway_mode IN ('sandbox','live')),
  payment_method text CHECK (payment_method IN ('boleto','pix','credit_card','manual')),
  external_id text,
  payment_url text,
  barcode text,
  pix_qr_code text,
  pix_copy_paste text,
  due_date date NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_invoices_ws ON public.customer_invoices(workspace_id);
CREATE INDEX idx_customer_invoices_status ON public.customer_invoices(workspace_id, status);
CREATE INDEX idx_customer_invoices_contact ON public.customer_invoices(contact_id);
CREATE INDEX idx_customer_invoices_due ON public.customer_invoices(workspace_id, due_date);
CREATE UNIQUE INDEX uq_customer_invoices_gateway_external ON public.customer_invoices(gateway, external_id) WHERE external_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_invoices TO authenticated;
GRANT ALL ON public.customer_invoices TO service_role;
ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_customer_invoices ON public.customer_invoices FOR SELECT TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_insert_customer_invoices ON public.customer_invoices FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_customer_invoices ON public.customer_invoices FOR UPDATE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_delete_customer_invoices ON public.customer_invoices FOR DELETE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE TRIGGER trg_customer_invoices_updated BEFORE UPDATE ON public.customer_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ customer_payments ============
CREATE TABLE public.customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  gateway text NOT NULL CHECK (gateway IN ('asaas','pagarme','mercadopago','manual')),
  external_payment_id text,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL CHECK (status IN ('pending','received','refunded','failed','chargeback')),
  method text,
  received_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_payments_invoice ON public.customer_payments(invoice_id);
CREATE INDEX idx_customer_payments_ws ON public.customer_payments(workspace_id);
CREATE UNIQUE INDEX uq_customer_payments_gw_ext ON public.customer_payments(gateway, external_payment_id) WHERE external_payment_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_customer_payments ON public.customer_payments FOR SELECT TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_insert_customer_payments ON public.customer_payments FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_customer_payments ON public.customer_payments FOR UPDATE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_delete_customer_payments ON public.customer_payments FOR DELETE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE TRIGGER trg_customer_payments_updated BEFORE UPDATE ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ payment_webhook_events ============
CREATE TABLE public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway text NOT NULL,
  event_type text,
  external_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_webhook_events_ws ON public.payment_webhook_events(workspace_id, created_at DESC);
CREATE INDEX idx_payment_webhook_events_gw ON public.payment_webhook_events(gateway, external_id);
GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_payment_webhook_events ON public.payment_webhook_events FOR SELECT TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));

-- ============ dunning_policies ============
CREATE TABLE public.dunning_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  segment_id uuid REFERENCES public.segments(id) ON DELETE SET NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dunning_policies_ws ON public.dunning_policies(workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dunning_policies TO authenticated;
GRANT ALL ON public.dunning_policies TO service_role;
ALTER TABLE public.dunning_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_dunning_policies ON public.dunning_policies FOR SELECT TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_insert_dunning_policies ON public.dunning_policies FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_dunning_policies ON public.dunning_policies FOR UPDATE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_delete_dunning_policies ON public.dunning_policies FOR DELETE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE TRIGGER trg_dunning_policies_updated BEFORE UPDATE ON public.dunning_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ dunning_runs ============
CREATE TABLE public.dunning_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.dunning_policies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  current_step int NOT NULL DEFAULT 0,
  next_run_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dunning_runs_ws ON public.dunning_runs(workspace_id);
CREATE INDEX idx_dunning_runs_next ON public.dunning_runs(status, next_run_at);
CREATE UNIQUE INDEX uq_dunning_runs_invoice ON public.dunning_runs(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dunning_runs TO authenticated;
GRANT ALL ON public.dunning_runs TO service_role;
ALTER TABLE public.dunning_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_dunning_runs ON public.dunning_runs FOR SELECT TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_insert_dunning_runs ON public.dunning_runs FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_dunning_runs ON public.dunning_runs FOR UPDATE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_delete_dunning_runs ON public.dunning_runs FOR DELETE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE TRIGGER trg_dunning_runs_updated BEFORE UPDATE ON public.dunning_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ nfse_invoices ============
CREATE TABLE public.nfse_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  external_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','issued','error','cancelled')),
  rps_number text,
  nf_number text,
  pdf_url text,
  xml_url text,
  service_code text,
  amount numeric(14,2),
  error_message text,
  issued_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfse_invoices_ws ON public.nfse_invoices(workspace_id);
CREATE INDEX idx_nfse_invoices_invoice ON public.nfse_invoices(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfse_invoices TO authenticated;
GRANT ALL ON public.nfse_invoices TO service_role;
ALTER TABLE public.nfse_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_nfse_invoices ON public.nfse_invoices FOR SELECT TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_insert_nfse_invoices ON public.nfse_invoices FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_nfse_invoices ON public.nfse_invoices FOR UPDATE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_delete_nfse_invoices ON public.nfse_invoices FOR DELETE TO authenticated USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE TRIGGER trg_nfse_invoices_updated BEFORE UPDATE ON public.nfse_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ workspaces extension ============
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS payments_settings jsonb NOT NULL DEFAULT jsonb_build_object('gateway','manual','mode','sandbox','default_method','pix'),
  ADD COLUMN IF NOT EXISTS nfse_settings jsonb NOT NULL DEFAULT jsonb_build_object('provider','nfe_io','enabled',false,'service_code',null);
