
DO $$ BEGIN
  CREATE TYPE public.email_broadcast_status AS ENUM ('draft','scheduled','running','paused','completed','canceled','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.email_broadcast_recipient_status AS ENUM ('pending','sent','failed','skipped','unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  rate_per_minute INT NOT NULL DEFAULT 30 CHECK (rate_per_minute BETWEEN 1 AND 600),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status public.email_broadcast_status NOT NULL DEFAULT 'draft',
  total INT NOT NULL DEFAULT 0,
  sent INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  last_error TEXT,
  reply_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_broadcasts_owner ON public.email_broadcasts(owner_id);
CREATE INDEX IF NOT EXISTS idx_email_broadcasts_status_sched ON public.email_broadcasts(status, scheduled_at);

CREATE TABLE IF NOT EXISTS public.email_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES public.email_broadcasts(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.email_broadcast_recipient_status NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ebr_broadcast ON public.email_broadcast_recipients(broadcast_id, status);
CREATE INDEX IF NOT EXISTS idx_ebr_owner ON public.email_broadcast_recipients(owner_id);

CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, email)
);
CREATE INDEX IF NOT EXISTS idx_email_unsub_owner_email ON public.email_unsubscribes(owner_id, email);

DO $$ BEGIN
  CREATE TRIGGER trg_email_broadcasts_updated_at
  BEFORE UPDATE ON public.email_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_broadcast_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eb_select" ON public.email_broadcasts FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "eb_insert" ON public.email_broadcasts FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "eb_update" ON public.email_broadcasts FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "eb_delete" ON public.email_broadcasts FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

CREATE POLICY "ebr_select" ON public.email_broadcast_recipients FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "ebr_insert" ON public.email_broadcast_recipients FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ebr_update" ON public.email_broadcast_recipients FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "ebr_delete" ON public.email_broadcast_recipients FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

CREATE POLICY "eu_select" ON public.email_unsubscribes FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "eu_insert" ON public.email_unsubscribes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "eu_delete" ON public.email_unsubscribes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-broadcast-tick') THEN
    PERFORM cron.unschedule('email-broadcast-tick');
  END IF;
END $$;

SELECT cron.schedule(
  'email-broadcast-tick',
  '* * * * *',
  $$ SELECT net.http_post(
       url := 'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/email-broadcast-tick',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
