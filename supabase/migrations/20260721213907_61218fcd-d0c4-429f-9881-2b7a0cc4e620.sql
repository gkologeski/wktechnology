
ALTER TABLE public.project_time_entries
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoiced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_project_time_entries_invoice_id
  ON public.project_time_entries(invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_time_entries_billable_pending
  ON public.project_time_entries(workspace_id, allocation_id, entry_date)
  WHERE billable = true AND approved_at IS NOT NULL AND invoice_id IS NULL;
