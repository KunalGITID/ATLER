-- Store money as numeric and calendar days as date instead of text, and
-- reject cycles the app can't schedule. Every table was empty when this was
-- written, but the USING clauses convert existing rows anyway.

alter table public.subscriptions
  alter column price type numeric(12, 2) using price::numeric,
  alter column start_date type date using nullif(start_date, '')::date,
  alter column last_logged_renewal type date using nullif(last_logged_renewal, '')::date,
  add constraint subscriptions_price_nonnegative check (price >= 0),
  add constraint subscriptions_cycle_valid
    check (cycle in ('Monthly', 'Yearly') or cycle ~ '^[1-9][0-9]{0,3}$');

alter table public.expenses
  alter column date type date using date::date;

-- Every list query filters on user_id.
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists categories_user_id_idx    on public.categories (user_id);
create index if not exists expenses_user_id_idx      on public.expenses (user_id);
