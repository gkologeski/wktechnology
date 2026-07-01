
-- Adiciona suporte a "aguardar aceite do convite" nas sequências de sourcing.

-- 1) Novos campos de configuração no passo
ALTER TABLE public.ats_sourcing_sequence_steps
  ADD COLUMN IF NOT EXISTS max_wait_days integer,
  ADD COLUMN IF NOT EXISTS poll_interval_hours integer,
  ADD COLUMN IF NOT EXISTS on_timeout text;

ALTER TABLE public.ats_sourcing_sequence_steps
  DROP CONSTRAINT IF EXISTS ats_sourcing_sequence_steps_on_timeout_check;
ALTER TABLE public.ats_sourcing_sequence_steps
  ADD CONSTRAINT ats_sourcing_sequence_steps_on_timeout_check
  CHECK (on_timeout IS NULL OR on_timeout IN ('skip_messages','end_sequence','continue'));

ALTER TABLE public.ats_sourcing_sequence_steps
  DROP CONSTRAINT IF EXISTS ats_sourcing_sequence_steps_max_wait_days_check;
ALTER TABLE public.ats_sourcing_sequence_steps
  ADD CONSTRAINT ats_sourcing_sequence_steps_max_wait_days_check
  CHECK (max_wait_days IS NULL OR (max_wait_days BETWEEN 1 AND 30));

ALTER TABLE public.ats_sourcing_sequence_steps
  DROP CONSTRAINT IF EXISTS ats_sourcing_sequence_steps_poll_interval_check;
ALTER TABLE public.ats_sourcing_sequence_steps
  ADD CONSTRAINT ats_sourcing_sequence_steps_poll_interval_check
  CHECK (poll_interval_hours IS NULL OR (poll_interval_hours BETWEEN 6 AND 48));

-- 2) Log do convite: id do provedor, aceite, e status 'pending'/'accepted'
ALTER TABLE public.unipile_message_log
  ADD COLUMN IF NOT EXISTS provider_invite_id text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS unipile_message_log_pending_invites_idx
  ON public.unipile_message_log (account_id, sent_at)
  WHERE kind = 'invite' AND status = 'pending';

-- 3) Enrollment: rastreio do gate
ALTER TABLE public.ats_sourcing_enrollments
  ADD COLUMN IF NOT EXISTS waiting_since timestamp with time zone,
  ADD COLUMN IF NOT EXISTS waiting_for_invite_log_id uuid;
