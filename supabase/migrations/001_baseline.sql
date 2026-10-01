-- Baseline: the schema as it existed in the hosted project before migrations
-- were tracked in this repo (captured 2026-10-01). Already applied there.

create table if not exists public.profiles (
  user_id       uuid primary key references auth.users (id),
  name          text default 'Atler',
  avatar        text,
  theme         text default 'default',
  currency      text default 'INR',
  last_notified date,
  created_at    timestamptz default now()
);

create table if not exists public.categories (
  id         text primary key,
  user_id    uuid not null references auth.users (id),
  name       text not null,
  budget     numeric,
  created_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id                  text primary key,
  user_id             uuid not null references auth.users (id),
  name                text not null,
  cycle               text not null,
  price               text not null,
  date_added          timestamptz not null,
  start_date          text,
  category            text default 'unlisted',
  last_logged_renewal text,
  paused              boolean default false,
  created_at          timestamptz default now()
);

create table if not exists public.expenses (
  id         text primary key,
  user_id    uuid not null references auth.users (id),
  name       text not null,
  amount     numeric not null,
  date       text not null,
  type       text default 'manual',
  created_at timestamptz default now()
);

alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.subscriptions enable row level security;
alter table public.expenses      enable row level security;

create policy "own profile"       on public.profiles      for all using (auth.uid() = user_id);
create policy "own categories"    on public.categories    for all using (auth.uid() = user_id);
create policy "own subscriptions" on public.subscriptions for all using (auth.uid() = user_id);
create policy "own expenses"      on public.expenses      for all using (auth.uid() = user_id);
