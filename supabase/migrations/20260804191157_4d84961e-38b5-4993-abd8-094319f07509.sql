select cron.schedule(
  'activity-reminders-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/activity-reminders-tick',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='CRON_SECRET' limit 1)),
    body := '{}'::jsonb
  );
  $$
);