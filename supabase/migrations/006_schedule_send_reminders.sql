-- Run send-reminders at the top of every hour. The x-cron-secret value is
-- read from Vault (secret 'atler_cron_secret', created once by hand with
-- vault.create_secret) so it never appears in the job definition.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'atler-send-reminders',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://cnxurdingdhhdcjgujkz.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'atler_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
