-- ATLER v2: the synced copy of each user's data. The phone is the source of
-- truth for the user's edits; these tables let devices share them.
--
-- Every row carries:
--   updated_at  client time of the edit (ms)  -> last edit wins
--   deleted     tombstone, so deletes reach other devices
--   revision    server-assigned, increasing   -> "what changed since N?"

create sequence if not exists public.atler_revision;
-- The stamp trigger runs as the signed-in user, who needs the counter.
grant usage on sequence public.atler_revision to authenticated;

-- Assign a revision on every write, and never let an older edit replace a
-- newer one (it can arrive later from a device that was offline).
create or replace function public.atler_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.revision := nextval('public.atler_revision');
  return new;
end $$;

create table if not exists public.plans (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 200),
  price       bigint not null check (price >= 0),          -- paise
  cycle_unit  text not null check (cycle_unit in ('month', 'year', 'day')),
  cycle_every int  not null check (cycle_every between 1 and 3650),
  anchor      date not null,
  category_id uuid,
  status      text not null check (status in ('trial', 'active', 'paused', 'cancelled')),
  trial_ends  date,
  remind      text not null default 'off' check (remind in ('off', '3d', '1d', 'both')),
  created_on  date not null,
  updated_at  bigint not null,
  deleted     boolean not null default false,
  revision    bigint not null default 0
);

create table if not exists public.plan_events (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id     uuid not null,
  "on"        date not null,
  at          bigint not null,
  kind        text not null check (kind in ('price', 'paused', 'resumed', 'cancelled', 'restarted')),
  from_price  bigint,
  to_price    bigint,
  updated_at  bigint not null,
  deleted     boolean not null default false,
  revision    bigint not null default 0,
  check (kind <> 'price' or (from_price is not null and to_price is not null))
);

create table if not exists public.payments (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 200),
  amount      bigint not null check (amount >= 0),         -- paise
  "on"        date not null,
  category_id uuid,
  source      text not null check (source in ('manual', 'sms', 'statement')),
  updated_at  bigint not null,
  deleted     boolean not null default false,
  revision    bigint not null default 0
);

create table if not exists public.spend_categories (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 100),
  budget      bigint check (budget is null or budget > 0), -- paise per month
  updated_at  bigint not null,
  deleted     boolean not null default false,
  revision    bigint not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['plans', 'plan_events', 'payments', 'spend_categories'] loop
    execute format('create index if not exists %I on public.%I (user_id, revision)', t || '_user_revision_idx', t);
    execute format('drop trigger if exists atler_stamp on public.%I', t);
    execute format('create trigger atler_stamp before insert or update on public.%I for each row execute function public.atler_stamp()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
