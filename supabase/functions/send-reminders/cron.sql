-- Run the reminder job at the top of every hour. Run once in the SQL editor
-- after deploying the function; replace <CRON_SECRET> with the secret set on
-- the function. To remove: select cron.unschedule('atler-send-reminders');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'atler-send-reminders',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://cnxurdingdhhdcjgujkz.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
