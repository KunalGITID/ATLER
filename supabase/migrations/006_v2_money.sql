-- ATLER v2: bills and EMIs, shared plans, foreign currencies, notes, tags,
-- splits, income and goals. New columns all have defaults, so rows written by
-- an older app version stay valid (an upsert only sets the columns it sends).

alter table public.plans
  add column if not exists kind text not null default 'subscription'
    check (kind in ('subscription', 'bill', 'rent', 'emi', 'sip', 'insurance')),
  add column if not exists autopay boolean not null default true,
  add column if not exists ends_on date,
  add column if not exists shared_by int not null default 1 check (shared_by between 1 and 50),
  add column if not exists foreign_currency text check (foreign_currency in ('USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY')),
  add column if not exists foreign_amount bigint check (foreign_amount is null or foreign_amount >= 0);

alter table public.plan_events drop constraint if exists plan_events_kind_check;
alter table public.plan_events add constraint plan_events_kind_check
  check (kind in ('price', 'paused', 'resumed', 'cancelled', 'restarted', 'paid', 'reviewed'));

alter table public.payments drop constraint if exists payments_source_check;
alter table public.payments add constraint payments_source_check
  check (source in ('manual', 'sms', 'statement', 'receipt', 'import'));
alter table public.payments
  add column if not exists note text not null default '' check (length(note) <= 500),
  add column if not exists tags text[] not null default '{}' check (cardinality(tags) <= 20),
  -- [{ "who": "Asha", "amount": 25000, "settled": false }, …] in paise
  add column if not exists split jsonb not null default '[]' check (jsonb_typeof(split) = 'array'),
  add column if not exists foreign_currency text check (foreign_currency in ('USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY')),
  add column if not exists foreign_amount bigint check (foreign_amount is null or foreign_amount >= 0);

create table if not exists public.incomes (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 200),
  amount      bigint not null check (amount >= 0),         -- paise
  "on"        date not null,
  repeat      text not null default 'none' check (repeat in ('none', 'monthly')),
  updated_at  bigint not null,
  deleted     boolean not null default false,
  revision    bigint not null default 0
);

create table if not exists public.goals (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(name) between 1 and 200),
  target      bigint not null check (target > 0),          -- paise
  saved       bigint not null default 0 check (saved >= 0),
  by_date     date,
  updated_at  bigint not null,
  deleted     boolean not null default false,
  revision    bigint not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['incomes', 'goals'] loop
    execute format('create index if not exists %I on public.%I (user_id, revision)', t || '_user_revision_idx', t);
    execute format('drop trigger if exists atler_stamp on public.%I', t);
    execute format('create trigger atler_stamp before insert or update on public.%I for each row execute function public.atler_stamp()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
