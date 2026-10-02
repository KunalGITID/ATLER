-- Push reminders for v2 reuse the push_subscriptions and sent_reminders
-- tables from v1. A device records its time zone (reminders go out after
-- 9 AM local time) and which app registered it, so each app's reminder job
-- only messages its own devices.
alter table public.push_subscriptions
  add column if not exists timezone text,
  add column if not exists app smallint not null default 1 check (app in (1, 2));
