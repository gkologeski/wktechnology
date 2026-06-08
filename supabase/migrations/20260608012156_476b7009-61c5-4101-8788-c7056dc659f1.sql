ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'mention', true,
    'assignment', true,
    'sla', true,
    'message', true,
    'task', true,
    'deal', true
  ),
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;