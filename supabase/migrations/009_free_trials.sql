-- A free trial is a subscription whose first charge is trial_ends (the app
-- sets start_date to the same day). Reminders before that day talk about the
-- trial ending instead of a renewal.
alter table public.subscriptions
  add column if not exists trial_ends date;
