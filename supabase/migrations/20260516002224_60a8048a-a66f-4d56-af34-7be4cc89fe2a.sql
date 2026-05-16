-- Habilita extensões necessárias para o cron de importação HubSpot
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('hubspot-import-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda tick a cada minuto, chamando a rota pública estável
SELECT cron.schedule(
  'hubspot-import-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/hubspot-tick',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);