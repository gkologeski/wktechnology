ALTER TABLE public.rotation_rules DROP CONSTRAINT IF EXISTS rotation_rules_entity_check;
ALTER TABLE public.rotation_rules ADD CONSTRAINT rotation_rules_entity_check
  CHECK (entity = ANY (ARRAY['leads','deals','tickets','whatsapp_conversations','email_threads','live_chat_sessions']));