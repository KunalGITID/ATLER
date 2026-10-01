-- History of a subscription's price, written by the app whenever the price is
-- edited, so Atler can show "Spotify went from ₹119 to ₹139 in March".
create table if not exists public.price_changes (
  id              text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  subscription_id text not null references public.subscriptions (id) on delete cascade,
  old_price       numeric(12, 2) not null,
  new_price       numeric(12, 2) not null,
  changed_on      date not null,
  created_at      timestamptz default now()
);
create index if not exists price_changes_user_id_idx on public.price_changes (user_id);
alter table public.price_changes enable row level security;
create policy "own price changes" on public.price_changes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
