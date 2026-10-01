-- Caixa de entrada durável dos avisos do WhatsApp (conexão Lovable).
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;

ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins do workspace leem eventos do WhatsApp"
  ON public.whatsapp_webhook_events FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id, auth.uid()));

CREATE INDEX IF NOT EXISTS whatsapp_webhook_events_pending_idx
  ON public.whatsapp_webhook_events (next_attempt_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_wa_message_id_idx
  ON public.whatsapp_messages (wa_message_id);
