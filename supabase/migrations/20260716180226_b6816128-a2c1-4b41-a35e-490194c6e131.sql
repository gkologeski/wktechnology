
-- Adiciona coluna parts para persistir tool calls/results do agente
ALTER TABLE public.copilot_messages
  ADD COLUMN IF NOT EXISTS parts jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_copilot_sessions_owner_kind
  ON public.copilot_sessions(owner_id, user_id);
