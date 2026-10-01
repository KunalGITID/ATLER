-- Web Push renewal reminders (supabase/functions/send-reminders).

-- Reminders go out at 9 AM in the user's own time zone.
alter table public.profiles
  add column if not exists timezone text not null default 'Asia/Kolkata';

-- One row per browser/device that allowed notifications.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- What has been sent, so the hourly job never repeats a reminder.
-- Only the Edge Function (service role) touches it: RLS on, no policies.
create table if not exists public.sent_reminders (
  subscription_id text not null,
  renewal_date    date not null,
  days_before     int  not null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  sent_at         timestamptz default now(),
  primary key (subscription_id, renewal_date, days_before)
);
alter table public.sent_reminders enable row level security;
