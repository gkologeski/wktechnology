
CREATE TABLE IF NOT EXISTS public.financial_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('receivable','payable')),
  template jsonb NOT NULL DEFAULT '{}'::jsonb,
  cadence text NOT NULL CHECK (cadence IN ('weekly','monthly','yearly','custom_days')),
  interval_days smallint NULL,
  day_of_month smallint NULL,
  start_date date NOT NULL,
  end_date date NULL,
  max_occurrences smallint NULL,
  occurrences_generated smallint NOT NULL DEFAULT 0,
  next_run_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_generated_entry_id uuid NULL REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_recurrences TO authenticated;
GRANT ALL ON public.financial_recurrences TO service_role;

ALTER TABLE public.financial_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own recurrences"
  ON public.financial_recurrences FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner can insert own recurrences"
  ON public.financial_recurrences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update own recurrences"
  ON public.financial_recurrences FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete own recurrences"
  ON public.financial_recurrences FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_fin_recur_workspace ON public.financial_recurrences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_fin_recur_active_next ON public.financial_recurrences(active, next_run_date);

CREATE TRIGGER trg_financial_recurrences_updated_at
  BEFORE UPDATE ON public.financial_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
