
DO $$ BEGIN
  CREATE TYPE public.sentiment_label AS ENUM ('positive','neutral','negative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.message_sentiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('whatsapp','email','activity')),
  source_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  label public.sentiment_label NOT NULL,
  score NUMERIC(4,3) NOT NULL,
  emotion TEXT,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_msentiments_owner ON public.message_sentiments(owner_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_msentiments_contact ON public.message_sentiments(contact_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_msentiments_lead ON public.message_sentiments(lead_id, analyzed_at DESC);

ALTER TABLE public.message_sentiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sent_select_own" ON public.message_sentiments FOR SELECT
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "sent_insert_own" ON public.message_sentiments FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "sent_update_own" ON public.message_sentiments FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "sent_delete_own" ON public.message_sentiments FOR DELETE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
