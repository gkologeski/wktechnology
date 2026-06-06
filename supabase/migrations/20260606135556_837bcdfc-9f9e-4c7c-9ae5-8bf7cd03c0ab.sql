ALTER TABLE public.prospecting_call_attempts
  ADD COLUMN IF NOT EXISTS vapi_request jsonb,
  ADD COLUMN IF NOT EXISTS vapi_response jsonb;