
-- Enums
CREATE TYPE public.billing_interval AS ENUM ('week','month','quarter','year');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','paused','canceled','past_due','completed');
CREATE TYPE public.sub_invoice_status AS ENUM ('pending','paid','failed','void');

-- Plans (catalog)
CREATE TABLE public.recurring_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  interval public.billing_interval NOT NULL DEFAULT 'month',
  interval_count INT NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  trial_days INT NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_plans ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER recurring_plans_updated_at BEFORE UPDATE ON public.recurring_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "recurring_plans owner/admin all"
  ON public.recurring_plans FOR ALL
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

-- Subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.recurring_plans(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  interval public.billing_interval NOT NULL DEFAULT 'month',
  interval_count INT NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  status public.subscription_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trial_ends_at DATE,
  next_billing_at DATE,
  ended_at TIMESTAMPTZ,
  total_cycles INT, -- null = infinite
  cycles_completed INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_subscriptions_owner ON public.subscriptions(owner_id);
CREATE INDEX idx_subscriptions_contact ON public.subscriptions(contact_id);
CREATE INDEX idx_subscriptions_next_billing ON public.subscriptions(next_billing_at);
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "subscriptions owner/admin all"
  ON public.subscriptions FOR ALL
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

-- Invoices
CREATE TABLE public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status public.sub_invoice_status NOT NULL DEFAULT 'pending',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sub_invoices_sub ON public.subscription_invoices(subscription_id);
CREATE INDEX idx_sub_invoices_owner ON public.subscription_invoices(owner_id);
CREATE INDEX idx_sub_invoices_status ON public.subscription_invoices(status);
CREATE TRIGGER subscription_invoices_updated_at BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "sub_invoices owner/admin all"
  ON public.subscription_invoices FOR ALL
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

-- Helper: add interval to a date
CREATE OR REPLACE FUNCTION public._add_billing_interval(p_date DATE, p_interval public.billing_interval, p_count INT)
RETURNS DATE
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT (p_date + (
    CASE p_interval
      WHEN 'week' THEN (p_count || ' weeks')::INTERVAL
      WHEN 'month' THEN (p_count || ' months')::INTERVAL
      WHEN 'quarter' THEN ((p_count*3) || ' months')::INTERVAL
      WHEN 'year' THEN (p_count || ' years')::INTERVAL
    END
  ))::DATE
$$;

-- Generate first invoice when subscription is created
CREATE OR REPLACE FUNCTION public.subscription_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_due DATE;
  v_seq INT;
BEGIN
  IF NEW.status = 'canceled' OR NEW.status = 'completed' THEN
    RETURN NEW;
  END IF;
  v_start := NEW.start_date;
  v_due := COALESCE(NEW.trial_ends_at, NEW.start_date);
  v_end := public._add_billing_interval(v_start, NEW.interval, NEW.interval_count) - 1;

  SELECT COUNT(*)+1 INTO v_seq FROM public.subscription_invoices WHERE subscription_id = NEW.id;
  INSERT INTO public.subscription_invoices (owner_id, subscription_id, invoice_number, amount, currency, status, period_start, period_end, due_date)
  VALUES (NEW.owner_id, NEW.id,
          'INV-' || to_char(now(),'YYYYMM') || '-' || lpad(v_seq::text,4,'0') || '-' || substr(NEW.id::text,1,4),
          NEW.amount, NEW.currency, 'pending', v_start, v_end, v_due);

  UPDATE public.subscriptions SET next_billing_at = v_due WHERE id = NEW.id AND next_billing_at IS NULL;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_subscription_after_insert
AFTER INSERT ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.subscription_after_insert();

-- When invoice is marked paid, advance subscription and create next invoice
CREATE OR REPLACE FUNCTION public.subscription_invoice_after_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_next_start DATE;
  v_next_end DATE;
  v_next_due DATE;
  v_seq INT;
BEGIN
  IF NEW.status <> 'paid' OR (OLD.status = 'paid') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = NEW.subscription_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE public.subscriptions
     SET cycles_completed = cycles_completed + 1
   WHERE id = v_sub.id;

  -- Check if completed
  IF v_sub.total_cycles IS NOT NULL AND (v_sub.cycles_completed + 1) >= v_sub.total_cycles THEN
    UPDATE public.subscriptions
       SET status = 'completed', ended_at = now(), next_billing_at = NULL
     WHERE id = v_sub.id;
    RETURN NEW;
  END IF;

  IF v_sub.status IN ('canceled','completed','paused') THEN
    RETURN NEW;
  END IF;

  v_next_start := NEW.period_end + 1;
  v_next_end := public._add_billing_interval(v_next_start, v_sub.interval, v_sub.interval_count) - 1;
  v_next_due := v_next_start;

  SELECT COUNT(*)+1 INTO v_seq FROM public.subscription_invoices WHERE subscription_id = v_sub.id;
  INSERT INTO public.subscription_invoices (owner_id, subscription_id, invoice_number, amount, currency, status, period_start, period_end, due_date)
  VALUES (v_sub.owner_id, v_sub.id,
          'INV-' || to_char(now(),'YYYYMM') || '-' || lpad(v_seq::text,4,'0') || '-' || substr(v_sub.id::text,1,4),
          v_sub.amount, v_sub.currency, 'pending', v_next_start, v_next_end, v_next_due);

  UPDATE public.subscriptions SET next_billing_at = v_next_due, status = 'active' WHERE id = v_sub.id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sub_invoice_after_paid
AFTER UPDATE OF status ON public.subscription_invoices
FOR EACH ROW EXECUTE FUNCTION public.subscription_invoice_after_paid();
