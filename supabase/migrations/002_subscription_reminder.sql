-- The app has always let users pick a renewal reminder, but there was no
-- column for it, so the choice was lost on every reload.
alter table public.subscriptions
  add column if not exists reminder text not null default 'none'
  check (reminder in ('none', '3days', '1day', 'both'));
