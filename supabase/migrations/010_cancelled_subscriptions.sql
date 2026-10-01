-- Cancelling keeps the plan (paused) with the date it was cancelled, so Atler
-- can count what you've saved since.
alter table public.subscriptions
  add column if not exists cancelled_on date;
