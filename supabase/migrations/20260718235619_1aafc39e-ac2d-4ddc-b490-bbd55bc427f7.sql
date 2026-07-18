
-- Cursor de sincronização incremental por conexão
ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS last_statement_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS balance_synced_at TIMESTAMPTZ;

-- Link opcional entre conta interna e conexão bancária externa
ALTER TABLE public.financial_bank_accounts
  ADD COLUMN IF NOT EXISTS bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_account_id TEXT;

CREATE TABLE IF NOT EXISTS public.bank_statement_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.financial_bank_accounts(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  description TEXT,
  counterparty TEXT,
  category TEXT,
  balance_after NUMERIC(18,2),
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN ('pending','matched','ignored')),
  matched_payment_id UUID,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_stmt_ws_posted
  ON public.bank_statement_transactions (workspace_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_conn_posted
  ON public.bank_statement_transactions (connection_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_recon
  ON public.bank_statement_transactions (workspace_id, reconciliation_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_transactions TO authenticated;
GRANT ALL ON public.bank_statement_transactions TO service_role;

ALTER TABLE public.bank_statement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_stmt_admin_select" ON public.bank_statement_transactions
  FOR SELECT TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "bank_stmt_admin_insert" ON public.bank_statement_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "bank_stmt_admin_update" ON public.bank_statement_transactions
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "bank_stmt_admin_delete" ON public.bank_statement_transactions
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE TRIGGER trg_bank_stmt_updated
  BEFORE UPDATE ON public.bank_statement_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
