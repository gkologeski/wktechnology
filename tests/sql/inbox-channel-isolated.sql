-- Complemento do banco isolado (rodar após inbox-isolated-rls.sql): colunas que as telas por canal usam.
ALTER TABLE public.email_threads ADD COLUMN message_count int DEFAULT 1, ADD COLUMN identity_status text, ADD COLUMN assigned_to uuid;
ALTER TABLE public.whatsapp_conversations ADD COLUMN identity_status text, ADD COLUMN twilio_number text,
  ADD COLUMN provider text, ADD COLUMN wa_phone_number_id text, ADD COLUMN last_inbound_at timestamptz,
  ADD COLUMN unread_count int DEFAULT 0, ADD COLUMN assigned_to uuid;
ALTER TABLE public.live_chat_sessions ADD COLUMN visitor_id text, ADD COLUMN visitor_url text,
  ADD COLUMN identity_status text, ADD COLUMN assignee_id uuid, ADD COLUMN owner_id uuid;
-- Responsáveis: 1/3 do A1, 1/3 do A3, 1/3 sem responsável.
UPDATE public.email_threads SET assigned_to = CASE (substr(id::text,25)::bigint % 3)
  WHEN 0 THEN 'a1000000-0000-0000-0000-000000000001'::uuid WHEN 1 THEN 'a3000000-0000-0000-0000-000000000003'::uuid END
  WHERE workspace_id = 'aaaaaaaa-0000-0000-0000-000000000000';
UPDATE public.whatsapp_conversations SET assigned_to = 'a1000000-0000-0000-0000-000000000001'
  WHERE workspace_id = 'aaaaaaaa-0000-0000-0000-000000000000' AND substr(id::text,25)::bigint % 2 = 0;
UPDATE public.live_chat_sessions SET owner_id = workspace_id;
