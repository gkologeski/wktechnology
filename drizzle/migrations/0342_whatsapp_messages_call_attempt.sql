ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS call_attempt_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_call_attempt_uniq ON public.whatsapp_messages(call_attempt_id) WHERE call_attempt_id IS NOT NULL;
COMMENT ON COLUMN public.whatsapp_messages.call_attempt_id IS 'Ligação de voz registrada na conversa da Inbox (prospecting_call_attempts.id); uma linha por ligação.';