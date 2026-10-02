-- Run send-reminders-v2 hourly. The secret comes from Vault
-- ('atler_cron_secret', shared with v1's job), never from this file.
select cron.schedule(
  'atler-send-reminders-v2',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://cnxurdingdhhdcjgujkz.supabase.co/functions/v1/send-reminders-v2',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'atler_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
