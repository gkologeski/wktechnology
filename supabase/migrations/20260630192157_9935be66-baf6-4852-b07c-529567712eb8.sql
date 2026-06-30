
-- =========================================================
-- Unipile integration (LinkedIn) — F1 schema
-- =========================================================

-- 1) unipile_accounts
CREATE TABLE public.unipile_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'linkedin' CHECK (provider IN ('linkedin')),
  unipile_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','disconnected','error')),
  connect_token TEXT,
  display_name TEXT,
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  daily_window JSONB NOT NULL DEFAULT '{"tz":"America/Sao_Paulo","start_hour":8,"end_hour":20}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX unipile_accounts_unique_account ON public.unipile_accounts(unipile_account_id) WHERE unipile_account_id IS NOT NULL;
CREATE INDEX unipile_accounts_owner ON public.unipile_accounts(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unipile_accounts TO authenticated;
GRANT ALL ON public.unipile_accounts TO service_role;
ALTER TABLE public.unipile_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages unipile_accounts" ON public.unipile_accounts
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 2) unipile_rate_buckets
CREATE TABLE public.unipile_rate_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.unipile_accounts(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  day_utc DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  count INTEGER NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, endpoint, day_utc)
);
CREATE INDEX unipile_rate_buckets_account ON public.unipile_rate_buckets(account_id);

GRANT SELECT ON public.unipile_rate_buckets TO authenticated;
GRANT ALL ON public.unipile_rate_buckets TO service_role;
ALTER TABLE public.unipile_rate_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads unipile_rate_buckets" ON public.unipile_rate_buckets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.unipile_accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  );

-- 3) unipile_request_log
CREATE TABLE public.unipile_request_log (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID REFERENCES public.unipile_accounts(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status INTEGER,
  latency_ms INTEGER,
  error TEXT,
  payload_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX unipile_request_log_account ON public.unipile_request_log(account_id, created_at DESC);
CREATE INDEX unipile_request_log_owner ON public.unipile_request_log(owner_id, created_at DESC);

GRANT SELECT ON public.unipile_request_log TO authenticated;
GRANT ALL ON public.unipile_request_log TO service_role;
ALTER TABLE public.unipile_request_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads unipile_request_log" ON public.unipile_request_log
  FOR SELECT USING (owner_id = auth.uid());

-- 4) unipile_message_log
CREATE TABLE public.unipile_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.unipile_accounts(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('message','invite','inmail')),
  target_identifier TEXT NOT NULL,
  candidate_id UUID,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  provider_message_id TEXT,
  idempotency_key TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);
CREATE INDEX unipile_message_log_owner ON public.unipile_message_log(owner_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.unipile_message_log TO authenticated;
GRANT ALL ON public.unipile_message_log TO service_role;
ALTER TABLE public.unipile_message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages unipile_message_log" ON public.unipile_message_log
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.unipile_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_unipile_accounts_touch BEFORE UPDATE ON public.unipile_accounts
  FOR EACH ROW EXECUTE FUNCTION public.unipile_touch_updated_at();
CREATE TRIGGER trg_unipile_rate_buckets_touch BEFORE UPDATE ON public.unipile_rate_buckets
  FOR EACH ROW EXECUTE FUNCTION public.unipile_touch_updated_at();
CREATE TRIGGER trg_unipile_message_log_touch BEFORE UPDATE ON public.unipile_message_log
  FOR EACH ROW EXECUTE FUNCTION public.unipile_touch_updated_at();
