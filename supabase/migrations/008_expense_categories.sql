-- Manual expenses get a category so budgets cover everyday spending, not
-- just subscriptions. Auto-logged renewals use their subscription's category.
alter table public.expenses
  add column if not exists category text not null default 'unlisted';
